import { isCampusFocusedQuestion, validateCampusGroundingQuality } from "@/ai/outputQuality";
import { normalizeQuery } from "@/retrieval/queryNormalizer";
import type { SearchResponse, SearchResult } from "@/types/search";

import {
  buildCapabilityTaskContext,
  buildDeterministicCapabilityResponse,
  buildSafeQuestionFallbackResponse
} from "./chatCapabilityService";
import type { AnswerContract } from "./answerContractService";
import type { SelectedAIMode } from "./modeSelectionService";
import { classifyStudentQuestionIntent } from "./questionIntentService";
import {
  buildDeterministicSourceResponseFromDraft,
  type SourceAnswerDraft
} from "./sourceAnswerService";
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

export function shouldClarifyWeakSourceQuery(
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

export function buildAmbiguousSourceClarificationResponse(
  question: string,
  selectedMode: SelectedAIMode
): SearchResponse {
  return {
    question,
    requestedChatRole: "haki",
    answerBasis: "campus_sources_unavailable",
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

export function buildSourceDraftClarificationResponse(question: string, sourceDraft: SourceAnswerDraft): SearchResponse | null {
  const answerText = sourceDraft.ambiguity?.clarificationQuestion ?? sourceDraft.mismatch?.clarificationQuestion;
  if (!answerText) {
    return null;
  }

  return {
    question,
    requestedChatRole: "haki",
    answerBasis: "campus_sources_unavailable",
    normalizedQuestion: sourceDraft.normalizedQuestion,
    responseType: "source",
    results: [],
    confidence: "low",
    reliable: false,
    answerText,
    citationsUsed: [],
    provenance: "No reliable saved source found",
    activeMode: sourceDraft.selectedMode.mode
  };
}

export function buildOfficialSourceAnswer(
  question: string,
  intent: ReturnType<typeof classifyStudentQuestionIntent>,
  sourceDraft: SourceAnswerDraft
): SearchResponse {
  if (intent.type === "safe_question" && (intent.capability === "summary" || intent.capability === "instruction")) {
    return buildDeterministicCapabilityResponse(question, intent.capability, sourceDraft);
  }

  return buildDeterministicSourceResponseFromDraft(question, sourceDraft);
}

export function taskContextForContract(
  intent: ReturnType<typeof classifyStudentQuestionIntent>,
  contract: AnswerContract
): string {
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
    return buildOfficialSourceAnswer(question, intent, sourceDraft);
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

