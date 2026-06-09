import { normalizeQuery } from "@/retrieval/queryNormalizer";
import type { ChatRole, SearchOptions, SourceAnchor } from "@/types/search";

import { buildAnswerContract, type AnswerContract } from "./answerContractService";
import { buildCapabilityTaskContext } from "./chatCapabilityService";
import { getSelectedAIMode, type SelectedAIMode } from "./modeSelectionService";
import { classifyStudentQuestionIntent } from "./questionIntentService";

export type StudentQuestionIntent = ReturnType<typeof classifyStudentQuestionIntent>;
export type SafeQuestionIntent = Extract<StudentQuestionIntent, { type: "safe_question" }>;

export interface AnswerPipelineContext {
  chatRole: ChatRole;
  hasSafeLocalChat: boolean;
  initialContract: AnswerContract;
  initialIntent: StudentQuestionIntent;
  selectedMode: SelectedAIMode;
}

export type ContextualSourceResolution =
  | { kind: "none" }
  | { kind: "clarify" }
  | { intent: SafeQuestionIntent; kind: "source"; retrievalQuestion: string };

export const UNIVERSAL_DETERMINISTIC_SCENARIOS = new Set([
  "adversarial",
  "capability_discovery",
  "clarification",
  "conversation_goodbye",
  "conversation_greeting",
  "conversation_thanks"
]);

export function canUseSafeLocalChat(selectedMode: SelectedAIMode): boolean {
  return Boolean(
    selectedMode.mode.capabilities.safeChat &&
      selectedMode.mode.summaryProviderId &&
      selectedMode.summaryProvider?.answerSafeChat
  );
}

export async function createAnswerPipelineContext(
  question: string,
  options: SearchOptions
): Promise<AnswerPipelineContext> {
  const initialIntent = options.intent ?? classifyStudentQuestionIntent(question);
  const initialContract = buildAnswerContract(question, initialIntent);
  const chatRole = options.chatRole ?? "haki";
  const selectedMode = await getSelectedAIMode();

  return {
    chatRole,
    hasSafeLocalChat: canUseSafeLocalChat(selectedMode),
    initialContract,
    initialIntent,
    selectedMode
  };
}

export function optionsWithIntentScope(
  options: SearchOptions,
  intent: StudentQuestionIntent
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

const GENERIC_SOURCE_FOLLOW_UP_PATTERN =
  /\b(requirements?|documents?|steps?|fees?|cost|how much|where (?:do i go|is it|should i go)|when (?:is it|do i)|contact|what about (?:it|that|this)|what (?:do|should) i (?:bring|submit|do) next)\b/i;
const NAMED_SOURCE_TARGET_PATTERN =
  /\b(good moral|gmc|temporary id|lost (?:or damaged )?id|damaged id|dental|admission slip|complaint|feedback|registrar|clinic|guidance|osa|student affairs|canteen|library|enrollment|clearance|medical certificate)\b/i;

function isGenericSourceFollowUp(question: string): boolean {
  const normalized = normalizeQuery(question);
  return (
    normalized.split(" ").filter(Boolean).length <= 10 &&
    GENERIC_SOURCE_FOLLOW_UP_PATTERN.test(normalized) &&
    !NAMED_SOURCE_TARGET_PATTERN.test(normalized)
  );
}

function scopeFromSourceAnchor(anchor: SourceAnchor): NonNullable<SearchOptions["scope"]> {
  return {
    ...(anchor.office ? { office: anchor.office } : {}),
    ...(anchor.category ? { category: anchor.category } : {}),
    documentId: anchor.documentId
  };
}

export function resolveContextualSourceRequest(
  question: string,
  intent: StudentQuestionIntent,
  chatRole: ChatRole,
  conversationState: SearchOptions["conversationState"]
): ContextualSourceResolution {
  if (
    (chatRole !== "haki" && chatRole !== "information_officer") ||
    intent.type !== "safe_question" ||
    intent.sourceScope ||
    !isGenericSourceFollowUp(question)
  ) {
    return { kind: "none" };
  }

  if (conversationState?.hasAmbiguousSourceAnchor) {
    return { kind: "clarify" };
  }

  const anchor = conversationState?.lastSourceAnchor;
  if (!anchor) {
    return { kind: "none" };
  }

  return {
    intent: {
      ...intent,
      route: "source_context",
      scenario: "campus_office",
      sourceScope: scopeFromSourceAnchor(anchor)
    },
    kind: "source",
    retrievalQuestion: `${question} ${anchor.label}`
  };
}

export function taskContextForContract(intent: StudentQuestionIntent, contract: AnswerContract): string {
  if (intent.type !== "safe_question") {
    return "";
  }

  const baseContext = buildCapabilityTaskContext(intent.capability, intent.scenario, intent.language);
  if (!contract.needsFactNotice) {
    return baseContext;
  }

  return [
    baseContext,
    "For general facts outside saved TUPT sources, answer briefly. The chat screen already displays the accuracy restriction above the conversation, so do not repeat a warning in this answer."
  ]
    .filter(Boolean)
    .join("\n");
}

export function friendSupportTaskContext(intent: StudentQuestionIntent, contract: AnswerContract): string {
  return [
    taskContextForContract(intent, contract),
    "Respond only to the student's emotional or practical support need. Do not include campus procedures, requirements, fees, deadlines, office locations, or contact details. Do not claim clinical credentials or diagnose. The application handles campus-information routing separately."
  ]
    .filter(Boolean)
    .join("\n");
}

export function researcherTaskContext(intent: StudentQuestionIntent, contract: AnswerContract): string {
  return [
    taskContextForContract(intent, contract),
    "Respond only to facts or general knowledge outside campus. Do not provide TUPT procedures, fees, deadlines, offices, locations, contacts, or personal-support advice. The chat screen already displays the mode's accuracy restriction above the conversation, so do not repeat it in this answer."
  ]
    .filter(Boolean)
    .join("\n");
}
