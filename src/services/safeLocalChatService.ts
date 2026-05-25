import type { AnswerProvenance, DeviceAIMode } from "@/ai/DeviceAIMode";
import type { SafeChatResult } from "@/ai/LocalAIProvider";
import {
  FRIENDLY_BUDDY_LOCAL_CHAT_INSTRUCTION,
  HAKI_LOCAL_CHAT_INSTRUCTION,
  RESEARCHER_LOCAL_CHAT_INSTRUCTION,
  SAFE_FALLBACK_MESSAGE,
  SAFE_LOCAL_CHAT_REFUSAL_MESSAGE,
  SAFE_LOCAL_CHAT_UNAVAILABLE_MESSAGE
} from "@/ai/prompts";
import { normalizeQuery } from "@/retrieval/queryNormalizer";
import type { AnswerBasis, ChatRole, SearchOptions, SearchResponse, SearchResult } from "@/types/search";
import { getPreferredModelTier } from "@/utils/aiUtils";
import { MAX_PROVIDER_RETRIES } from "@/utils/constants";
import { logger } from "@/utils/logger";

import {
  disableAIProviderForSession,
  forceFallbackModeForResponse,
  getSelectedAIMode,
  type SelectedAIMode
} from "./modeSelectionService";
import { buildSafeQuestionFallbackResponse } from "./chatCapabilityService";
import { buildSafeRetryQuestion, looksLikeGenericSafetyRefusal } from "./modelRefusalUtils";
import { classifyStudentQuestionIntent, type StudentQuestionIntent } from "./questionIntentService";
import { buildUnsafeRequestMessageForCategory } from "./refusalResponseBuilder";
import { detectReplyLanguage, replyLanguageInstruction } from "./replyLanguageService";
import type { SourceAnswerDraft } from "./sourceAnswerService";
import { sourceChunksForSafeChat } from "./sourceChunkAdapter";
import { formatConversationState } from "./conversationStateService";

export function buildUnsafeRequestMessage(question: string): string {
  const intent = classifyStudentQuestionIntent(question);
  if (intent.type !== "unsafe_request") {
    return SAFE_LOCAL_CHAT_REFUSAL_MESSAGE;
  }

  return buildUnsafeRequestMessageForCategory(intent.category, {
    language: intent.language,
    question
  });
}

function canUseSafeFallback(intent: StudentQuestionIntent): intent is Extract<
  StudentQuestionIntent,
  { type: "safe_question" }
> {
  return intent.type === "safe_question" && intent.route === "obvious_general";
}

const APP_CONTEXT =
  "You are Haki. The default campus is Technological University of the Philippines - Taguig (TUPT) in Taguig City, Metro Manila, Philippines. Help TUPT students with campus questions, study advice, and safe general knowledge. For TUPT-specific answers, use the provided source context when available. Never invent another university, country, campus building, office, deadline, fee, residence hall, website, or source.";

function appContextForQuestion(question: string, options: SafeLocalChatOptions): string {
  const language = options.intent?.language ?? detectReplyLanguage(options.originalQuestion ?? question);
  const hasSourceContext = Boolean(options.sourceDraft?.results.length);
  const conversationState = formatConversationState(options.conversationState);
  const groundingInstruction = hasSourceContext
    ? "When university source context is provided, base your TUPT-related answer on it. Do not contradict the sources. If sources are marked 'weak or uncertain', acknowledge that and suggest verifying with the relevant office."
    : "";
  const roleContext =
    options.chatRole === "friendly_buddy"
      ? "Friendly Buddy provides emotional and personal support only. Do not state, summarize, or repeat official campus facts; direct campus-information questions to Information Officer."
      : options.chatRole === "researcher"
        ? "Researcher answers facts outside campus only. Do not answer TUPT facts, procedures, or personal-support portions."
        : "Default Haki uses generated text only for non-campus guidance or facts. Official campus facts are composed separately from saved sources.";
  return [APP_CONTEXT, roleContext, groundingInstruction, conversationState, replyLanguageInstruction(language)]
    .filter(Boolean)
    .join("\n");
}

function toSafeChatResponse(input: {
  citationsUsed?: string[] | undefined;
  confidence?: SearchResponse["confidence"] | undefined;
  question: string;
  normalizedQuestion: string;
  answerText: string;
  mode: DeviceAIMode;
  provenance: AnswerProvenance;
  reliable?: boolean;
  results?: SearchResult[] | undefined;
  topResult?: SearchResult | undefined;
  isIncomplete?: boolean;
  requestedChatRole?: ChatRole | undefined;
  answerBasis?: AnswerBasis | undefined;
}): SearchResponse {
  return {
    question: input.question,
    requestedChatRole: input.requestedChatRole ?? "haki",
    answerBasis: input.answerBasis ?? "haki_guidance",
    normalizedQuestion: input.normalizedQuestion,
    responseType: input.reliable === false ? "refusal" : "safe_local_chat",
    results: input.results ?? [],
    confidence: input.confidence ?? (input.reliable === false ? "low" : "medium"),
    reliable: input.reliable ?? true,
    ...(input.topResult ? { topResult: input.topResult } : {}),
    answerText: input.answerText,
    citationsUsed: input.citationsUsed ?? [],
    provenance: input.provenance,
    activeMode: input.mode,
    ...(input.isIncomplete !== undefined ? { isIncomplete: input.isIncomplete } : {})
  };
}

export interface SafeLocalChatOptions {
  chatRole?: ChatRole;
  conversationContext?: SearchOptions["conversationContext"];
  conversationState?: SearchOptions["conversationState"];
  intent?: StudentQuestionIntent;
  onToken?: SearchOptions["onToken"];
  originalQuestion?: string;
  profileContext?: SearchOptions["profileContext"];
  sourceDraft?: SourceAnswerDraft;
  taskContext?: string;
  abortSignal?: AbortSignal;
}

function filterCitationIds(result: SafeChatResult, sourceDraft: SourceAnswerDraft | undefined): string[] {
  if (!sourceDraft || !Array.isArray(result.citationIds)) {
    return [];
  }

  const allowed = new Set(sourceDraft.results.map((source) => source.chunkId));
  return result.citationIds.filter((citationId) => allowed.has(citationId));
}

function shouldRetrySafeQuestion(
  intent: StudentQuestionIntent,
  localAnswer: { result: SafeChatResult; mode: DeviceAIMode } | null
): boolean {
  return (
    intent.type === "safe_question" &&
    Boolean(localAnswer) &&
    (localAnswer?.result.status === "refused" || looksLikeGenericSafetyRefusal(localAnswer?.result.text ?? ""))
  );
}

function retryOptionsWithoutStreaming(options: SafeLocalChatOptions): SafeLocalChatOptions {
  const retryOptions = { ...options };
  delete retryOptions.onToken;
  return retryOptions;
}

function isAbortLikeError(error: unknown): boolean {
  if (error instanceof Error) {
    return /abort|cancel|stop/i.test(`${error.name} ${error.message}`);
  }

  return typeof error === "string" && /abort|cancel|stop/i.test(error);
}

async function runLocalSafeChat(
  question: string,
  selectedMode: SelectedAIMode,
  options: SafeLocalChatOptions,
  attempt = 0
): Promise<{ result: SafeChatResult; mode: DeviceAIMode } | null> {
  const { mode, summaryProvider } = selectedMode;

  if (!summaryProvider?.answerSafeChat || !mode.capabilities.safeChat || !mode.summaryProviderId) {
    return null;
  }

  try {
    const preferredModelTier = getPreferredModelTier(mode);
    const instruction =
      options.chatRole === "friendly_buddy"
        ? FRIENDLY_BUDDY_LOCAL_CHAT_INSTRUCTION
        : options.chatRole === "researcher"
          ? RESEARCHER_LOCAL_CHAT_INSTRUCTION
          : HAKI_LOCAL_CHAT_INSTRUCTION;
    const input = {
      question,
      ...(options.chatRole ? { chatRole: options.chatRole } : {}),
      instruction,
      ...(preferredModelTier ? { preferredModelTier } : {}),
      appContext: appContextForQuestion(question, options),
      ...(options.conversationContext?.length ? { conversationContext: options.conversationContext } : {}),
      ...(options.profileContext ? { profileContext: options.profileContext } : {}),
      ...(options.sourceDraft?.results.length ? { sourceContext: sourceChunksForSafeChat(options.sourceDraft.results, preferredModelTier) } : {}),
      ...(options.sourceDraft ? { sourceConfidence: options.sourceDraft.confidence } : {}),
      ...(options.sourceDraft ? { sourceReliable: options.sourceDraft.reliable } : {}),
      ...(options.taskContext ? { taskContext: options.taskContext } : {}),
      ...(options.intent?.type === "safe_question" ? { scenario: options.intent.scenario, capability: options.intent.capability } : {}),
      ...(options.abortSignal ? { abortSignal: options.abortSignal } : {})
    };
    const result =
      options.onToken && summaryProvider.streamSafeChat
        ? await summaryProvider.streamSafeChat(input, options.onToken)
        : await summaryProvider.answerSafeChat(input);

    return { result, mode };
  } catch (error) {
    if (options.abortSignal?.aborted || isAbortLikeError(error)) {
      return {
        result: {
          status: "incomplete",
          text: "",
          providerId: summaryProvider.id,
          providerName: summaryProvider.name
        },
        mode
      };
    }

    disableAIProviderForSession(summaryProvider.id, error);
    if (attempt < MAX_PROVIDER_RETRIES) {
      const fallbackSelection = await getSelectedAIMode();
      return runLocalSafeChat(question, fallbackSelection, options, attempt + 1);
    }

    return {
      result: {
        status: "refused",
        text: SAFE_LOCAL_CHAT_UNAVAILABLE_MESSAGE,
        providerId: "fallback",
        providerName: "FTS5 fallback"
      },
      mode: forceFallbackModeForResponse(mode, "Local safe chat failed; using FTS5 fallback.")
    };
  }
}

export async function answerSafeLocalChat(question: string): Promise<SearchResponse> {
  return answerSafeLocalChatWithContext(question);
}

export async function answerSafeLocalChatWithContext(
  question: string,
  options: SafeLocalChatOptions = {}
): Promise<SearchResponse> {
  const intent = options.intent ?? classifyStudentQuestionIntent(question);
  if (intent.type === "unsafe_request") {
    return responseForUnsafeRequest(question);
  }

  const normalizedQuestion = normalizeQuery(question);
  const selectedMode = await getSelectedAIMode();
  let localAnswer = await runLocalSafeChat(question, selectedMode, options);
  const sourceDraft = options.sourceDraft;
  const sourceResults = sourceDraft?.results ?? [];
  const fallbackQuestion = options.originalQuestion ?? question;

  if (shouldRetrySafeQuestion(intent, localAnswer)) {
    logger.ai.warn("Local safe chat appeared to over-refuse; retrying with clearer safe prompt.", {
      capability: intent.capability,
      route: intent.route,
      providerId: localAnswer?.result.providerId,
      hasSourceContext: Boolean(sourceDraft?.results.length)
    });

    const retryQuestion = buildSafeRetryQuestion(fallbackQuestion, intent.capability, intent.scenario, intent.language);
    const retryAnswer = await runLocalSafeChat(
      retryQuestion,
      selectedMode,
      retryOptionsWithoutStreaming(options)
    );

    if (retryAnswer?.result.text && retryAnswer.result.status !== "refused" && !looksLikeGenericSafetyRefusal(retryAnswer.result.text)) {
      localAnswer = retryAnswer;
    }
  }

  const citationsUsed = localAnswer ? filterCitationIds(localAnswer.result, sourceDraft) : [];

  if (localAnswer && (localAnswer.result.status === "refused" || looksLikeGenericSafetyRefusal(localAnswer.result.text))) {
    if (canUseSafeFallback(intent)) {
      logger.ai.warn("Using safe deterministic fallback after local model over-refusal.", {
        capability: intent.capability,
        providerId: localAnswer.result.providerId
      });
      return buildSafeQuestionFallbackResponse(fallbackQuestion, intent.capability, localAnswer.mode, intent.scenario);
    }

    return toSafeChatResponse({
      citationsUsed,
      confidence: sourceDraft?.confidence,
      question,
      normalizedQuestion,
      answerText: SAFE_FALLBACK_MESSAGE,
      mode: localAnswer.mode,
      provenance: "Answered with local safe chat",
      reliable: false,
      results: sourceResults,
        topResult: sourceDraft?.topResult,
        requestedChatRole: options.chatRole,
        answerBasis: options.chatRole === "friendly_buddy" ? "friendly_guidance" : options.chatRole === "researcher" ? "researcher_facts" : "haki_guidance"
    });
  }

  if (localAnswer?.result.text) {
    return toSafeChatResponse({
      citationsUsed,
      confidence: sourceDraft?.confidence ?? "medium",
      question,
      normalizedQuestion,
      answerText: localAnswer.result.text,
      mode: localAnswer.mode,
      provenance: "Answered with local safe chat",
      results: sourceResults,
      topResult: sourceDraft?.topResult,
      isIncomplete: localAnswer.result.status === "incomplete",
      requestedChatRole: options.chatRole,
      answerBasis: options.chatRole === "friendly_buddy" ? "friendly_guidance" : options.chatRole === "researcher" ? "researcher_facts" : "haki_guidance"
    });
  }

  return toSafeChatResponse({
    confidence: sourceDraft?.confidence,
    question,
    normalizedQuestion,
    answerText: SAFE_LOCAL_CHAT_UNAVAILABLE_MESSAGE,
    mode: selectedMode.mode,
    provenance: "General chat unavailable without local AI",
    reliable: false,
    results: sourceResults,
    topResult: sourceDraft?.topResult,
    requestedChatRole: options.chatRole,
    answerBasis: options.chatRole === "friendly_buddy" ? "friendly_guidance" : options.chatRole === "researcher" ? "researcher_facts" : "haki_guidance"
  });
}

export async function responseForUnsafeRequest(question: string): Promise<SearchResponse> {
  const selectedMode = await getSelectedAIMode();
  return toSafeChatResponse({
    question,
    normalizedQuestion: normalizeQuery(question),
    answerText: buildUnsafeRequestMessage(question),
    requestedChatRole: "haki",
    answerBasis: "safety_or_app_guidance",
    mode: selectedMode.mode,
    provenance: selectedMode.mode.capabilities.safeChat
      ? "Answered with local safe chat"
      : "General chat unavailable without local AI",
    reliable: false
  });
}
