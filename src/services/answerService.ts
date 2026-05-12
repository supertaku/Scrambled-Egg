import { isCampusFocusedQuestion, validateCampusGroundingQuality } from "@/ai/outputQuality";
import type { SearchOptions, SearchResponse, SearchResult } from "@/types/search";
import { normalizeQuery } from "@/retrieval/queryNormalizer";

import { answerSafeLocalChatWithContext, responseForUnsafeRequest } from "./safeLocalChatService";
import { classifyStudentQuestionIntent } from "./questionIntentService";
import { isTagalogLike } from "./replyLanguageService";
import {
  buildCapabilityTaskContext,
  buildDeterministicCapabilityResponse,
  buildDeviceSpecificationResponse,
  buildImageGenerationResponse,
  buildOrganizationOfficersResponse,
  buildProfileContextResponse,
  buildQuickScenarioResponse,
  buildSourceMissFallbackResponse,
  buildSafeQuestionFallbackResponse,
  buildWellbeingSupportResponse
} from "./chatCapabilityService";
import {
  buildSourceResponseFromDraft,
  retrieveSourceAnswerDraft,
  type SourceAnswerDraft
} from "./sourceAnswerService";
import { getDeviceCapabilityReport, getSelectedAIMode, type SelectedAIMode } from "./modeSelectionService";

function shouldUseDeterministicSourceAnswer(
  selectedMode: SelectedAIMode,
  intent: ReturnType<typeof classifyStudentQuestionIntent>
): boolean {
  if (intent.type !== "safe_question" || intent.route !== "source_context") {
    return false;
  }

  const tier = selectedMode.mode.capabilities.modelTier;
  return tier === "tiny" || tier === "minimum";
}

function stringValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sourceEvidenceFromResult(result: SearchResult): string[] {
  return [
    result.documentTitle,
    result.sectionTitle,
    result.processName,
    result.content,
    result.answer,
    result.citation,
    result.category,
    result.office,
    result.officeLocation,
    result.contactInfo,
    result.tags.join(" "),
    result.synonyms.join(" "),
    result.steps?.join(" "),
    result.prerequisites?.join(" ")
  ].flatMap((value) => {
    const text = stringValue(value);
    return text ? [text] : [];
  });
}

function sourceEvidenceFromDraft(sourceDraft: SourceAnswerDraft | undefined): string[] {
  return sourceDraft?.results.flatMap(sourceEvidenceFromResult) ?? [];
}

const CAMPUS_GENERAL_GUARD_SCENARIOS = new Set([
  "relationship_advice",
  "study_advice",
  "wellbeing_safety",
  "campus_life",
  "campus_office",
  "student_admin",
  "academic_support"
]);

function shouldApplyCampusOutputGuard(
  question: string,
  intent: ReturnType<typeof classifyStudentQuestionIntent>,
  sourceDraft?: SourceAnswerDraft | undefined
): boolean {
  if (intent.type !== "safe_question") {
    return false;
  }

  if (intent.route === "source_context" || (sourceDraft?.results.length ?? 0) > 0) {
    return true;
  }

  return CAMPUS_GENERAL_GUARD_SCENARIOS.has(intent.scenario) && isCampusFocusedQuestion(question);
}

const AMBIGUOUS_REFERENCE_PATTERN = /\b(it|this|that|they|them|those|there|one)\b/i;
const BROAD_SOURCE_ACTION_PATTERN = /\b(how|where|when|who|what|process|procedure|requirements?|steps?|file|submit|request|apply)\b/i;
const SPECIFIC_SOURCE_SIGNAL_PATTERN =
  /\b(registrar|clinic|guidance|osa|student affairs|library|cashier|accounting|canteen|department|office|id|cor|clearance|complaint|feedback|enrollment|scholarship|grade|grades)\b/i;

function shouldClarifyWeakSourceQuery(
  question: string,
  intent: ReturnType<typeof classifyStudentQuestionIntent>
): boolean {
  if (intent.type !== "safe_question" || intent.route !== "source_context") {
    return false;
  }

  if (intent.sourceScope) {
    return false;
  }

  const normalized = normalizeQuery(question);
  const wordCount = normalized.split(" ").filter(Boolean).length;
  return (
    intent.scenario === "clarification" ||
    wordCount <= 4 ||
    AMBIGUOUS_REFERENCE_PATTERN.test(normalized) ||
    (BROAD_SOURCE_ACTION_PATTERN.test(normalized) && !SPECIFIC_SOURCE_SIGNAL_PATTERN.test(normalized))
  );
}

function buildAmbiguousSourceClarificationResponse(
  question: string,
  selectedMode: SelectedAIMode
): SearchResponse {
  return {
    question,
    normalizedQuestion: normalizeQuery(question),
    responseType: "source",
    results: [],
    confidence: "low",
    reliable: false,
    answerText: "I have 1 quick question: which TUPT office, document, or process are you asking about?",
    citationsUsed: [],
    provenance: "No reliable saved source found",
    activeMode: selectedMode.mode
  };
}

export async function maybeBuildLocalAnswerQualityFallback(
  question: string,
  intent: ReturnType<typeof classifyStudentQuestionIntent>,
  localAnswer: SearchResponse,
  sourceDraft?: SourceAnswerDraft | undefined
): Promise<SearchResponse | null> {
  const answerText = localAnswer.answerText?.trim();
  if (!answerText || !shouldApplyCampusOutputGuard(question, intent, sourceDraft)) {
    return null;
  }

  const quality = validateCampusGroundingQuality({
    answerText,
    question,
    sourceEvidence: sourceEvidenceFromDraft(sourceDraft)
  });

  if (quality.ok || intent.type !== "safe_question") {
    return null;
  }

  if (sourceDraft?.reliable) {
    if (intent.capability === "summary" || intent.capability === "instruction") {
      return buildDeterministicCapabilityResponse(question, intent.capability, sourceDraft);
    }

    return buildSourceResponseFromDraft(question, sourceDraft);
  }

  if (intent.route === "source_context" && shouldClarifyWeakSourceQuery(question, intent)) {
    return buildAmbiguousSourceClarificationResponse(question, {
      mode: localAnswer.activeMode,
      summaryProvider: null,
      embeddingProvider: null
    });
  }

  if (isCampusFocusedQuestion(question)) {
    return buildSafeQuestionFallbackResponse(question, intent.capability, localAnswer.activeMode, intent.scenario);
  }

  return null;
}

async function buildEnglishOnlyRedirect(question: string): Promise<SearchResponse> {
  const selectedMode = await getSelectedAIMode();
  return {
    question,
    normalizedQuestion: normalizeQuery(question),
    responseType: "general_advice",
    results: [],
    confidence: "high",
    reliable: true,
    answerText:
      "Please send your message in English so I can understand it accurately. I can help once you restate the question in English.",
    citationsUsed: [],
    provenance: "Answered with safe student guidance",
    activeMode: selectedMode.mode
  };
}

function canUseSafeLocalChat(selectedMode: SelectedAIMode): boolean {
  return Boolean(
    selectedMode.mode.capabilities.safeChat &&
      selectedMode.mode.summaryProviderId &&
      selectedMode.summaryProvider?.answerSafeChat
  );
}

function optionsWithIntentScope(
  options: SearchOptions,
  intent: ReturnType<typeof classifyStudentQuestionIntent>
): SearchOptions {
  if (intent.type !== "safe_question" || !intent.sourceScope) {
    return options;
  }

  return {
    ...options,
    scope: {
      ...intent.sourceScope,
      ...(options.scope ?? {})
    }
  };
}

export async function answerStudentQuestion(
  question: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  // Reuse the caller's precomputed intent when available so we don't re-run
  // regex classification and so the router stays aligned with the hook's
  // conversation state / follow-up detection.
  const intent = options.intent ?? classifyStudentQuestionIntent(question);

  if (intent.type === "unsafe_request") {
    return responseForUnsafeRequest(question);
  }

  const selectedMode = await getSelectedAIMode();
  const hasSafeLocalChat = canUseSafeLocalChat(selectedMode);
  const scopedOptions = optionsWithIntentScope(options, intent);

  // Continuation prompts are not real questions: they ask the model to finish
  // its previous answer. Skip retrieval and scenario shortcuts entirely and
  // route straight to the chat provider with the existing conversation tail.
  if (options.continuation) {
    if (!hasSafeLocalChat) {
      return buildSourceMissFallbackResponse(question, intent, selectedMode.mode);
    }
    const response = await answerSafeLocalChatWithContext(question, {
      conversationContext: options.conversationContext,
      conversationState: options.conversationState,
      intent,
      onToken: options.onToken,
      originalQuestion: question,
      profileContext: options.profileContext,
      taskContext: buildCapabilityTaskContext(intent.capability, intent.scenario, intent.language),
      ...(options.abortSignal ? { abortSignal: options.abortSignal } : {})
    });
    return { ...response, question };
  }

  if (intent.scenario === "device_specification") {
    return buildDeviceSpecificationResponse(question, selectedMode.mode, await getDeviceCapabilityReport());
  }

  const wellbeingResponse = buildWellbeingSupportResponse(question, intent, selectedMode.mode);
  if (wellbeingResponse) {
    return wellbeingResponse;
  }

  if (isTagalogLike(intent.language)) {
    return buildEnglishOnlyRedirect(question);
  }

  if (intent.capability === "image_generation") {
    return buildImageGenerationResponse(question, selectedMode.mode);
  }

  const organizationOfficersResponse = buildOrganizationOfficersResponse(question, intent, selectedMode.mode);
  if (organizationOfficersResponse) {
    return organizationOfficersResponse;
  }

  const profileResponse = buildProfileContextResponse(question, selectedMode.mode, options.profileContext);
  if (profileResponse) {
    return profileResponse;
  }

  const quickResponse = buildQuickScenarioResponse(question, intent, selectedMode.mode);
  if (quickResponse) {
    return quickResponse;
  }

  if (!hasSafeLocalChat) {
    if (intent.route === "obvious_general") {
      return buildSafeQuestionFallbackResponse(question, intent.capability, selectedMode.mode, intent.scenario);
    }

    const sourceDraft = await retrieveSourceAnswerDraft(question, scopedOptions, selectedMode);
    if (!sourceDraft.reliable) {
      return buildSourceMissFallbackResponse(question, intent, selectedMode.mode);
    }

    if (intent.capability === "summary" || intent.capability === "instruction") {
      return buildDeterministicCapabilityResponse(question, intent.capability, sourceDraft);
    }

    return buildSourceResponseFromDraft(question, sourceDraft);
  }

  if (intent.route === "obvious_general") {
    const response = await answerSafeLocalChatWithContext(question, {
      conversationContext: options.conversationContext,
      intent,
      onToken: options.onToken,
      originalQuestion: question,
      profileContext: options.profileContext,
      taskContext: buildCapabilityTaskContext(intent.capability, intent.scenario, intent.language),
      ...(options.abortSignal ? { abortSignal: options.abortSignal } : {})
    });
    const qualityFallback = await maybeBuildLocalAnswerQualityFallback(question, intent, response);
    if (qualityFallback) {
      return qualityFallback;
    }

    return {
      ...response,
      question,
      responseType: intent.capability === "university_answer" ? response.responseType ?? "safe_local_chat" : intent.capability
    };
  }

  const sourceDraft = await retrieveSourceAnswerDraft(question, scopedOptions, selectedMode);

  // Weak retrieval is not an unsafe request; steer students toward clarification or official verification.
  if (!sourceDraft.reliable) {
    if (shouldClarifyWeakSourceQuery(question, intent)) {
      return buildAmbiguousSourceClarificationResponse(question, selectedMode);
    }

    return buildSourceMissFallbackResponse(question, intent, selectedMode.mode);
  }

  if (
    shouldUseDeterministicSourceAnswer(selectedMode, intent) &&
    (intent.capability === "summary" || intent.capability === "instruction")
  ) {
    return buildDeterministicCapabilityResponse(question, intent.capability, sourceDraft);
  }

  const localAnswer = await answerSafeLocalChatWithContext(question, {
    conversationContext: options.conversationContext,
    intent,
    onToken: options.onToken,
    originalQuestion: question,
    profileContext: options.profileContext,
    sourceDraft,
    taskContext: buildCapabilityTaskContext(intent.capability, intent.scenario, intent.language),
    ...(options.abortSignal ? { abortSignal: options.abortSignal } : {})
  });
  const responseType =
    intent.capability === "summary" || intent.capability === "instruction"
      ? intent.capability
      : localAnswer.responseType ?? "safe_local_chat";

  if (localAnswer.reliable) {
    const qualityFallback = await maybeBuildLocalAnswerQualityFallback(question, intent, localAnswer, sourceDraft);
    if (qualityFallback) {
      return qualityFallback;
    }

    return {
      ...localAnswer,
      question,
      normalizedQuestion: sourceDraft.normalizedQuestion,
      responseType
    };
  }

  if (intent.capability === "summary" || intent.capability === "instruction") {
    return buildDeterministicCapabilityResponse(question, intent.capability, sourceDraft);
  }

  return buildSourceResponseFromDraft(question, sourceDraft);
}
