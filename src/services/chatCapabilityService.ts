import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import { MEDIUM_CONFIDENCE_NOTE, SAFE_FALLBACK_MESSAGE } from "@/ai/prompts";
import { normalizeQuery } from "@/retrieval/queryNormalizer";
import type { SearchResponse, SearchResponseType, SearchResult } from "@/types/search";

import {
  buildDeterministicSafeAnswerText,
  buildQuickScenarioResponse,
  buildSourceMissFallbackResponse
} from "./scenarioResponseService";
import { replyLanguageInstruction } from "./replyLanguageService";
import type { QuestionScenario, ReplyLanguage, StudentChatCapability } from "./studentChatTypes";
import type { SourceAnswerDraft } from "./sourceAnswerService";

export {
  buildDeterministicSafeAnswerText,
  buildQuickScenarioResponse,
  buildSourceMissFallbackResponse
} from "./scenarioResponseService";

function responseTypeForCapability(capability: StudentChatCapability): SearchResponseType {
  switch (capability) {
    case "general_advice":
      return "general_advice";
    case "image_generation":
      return "image_generation";
    case "instruction":
      return "instruction";
    case "summary":
      return "summary";
    case "university_answer":
      return "source";
  }
}

function directAnswer(result: SearchResult): string {
  return result.answer?.trim() || result.content.trim();
}

function compact(value: string, maxLength = 700): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function firstSentences(value: string, maxSentences = 3): string {
  const sentences = value
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return compact((sentences.length ? sentences.slice(0, maxSentences).join(" ") : value).trim());
}

function formatNumberedList(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item.trim()}`).join("\n");
}

function sourceReference(result: SearchResult): string {
  const parts = [result.office, result.sectionTitle ?? result.processName, result.documentTitle].filter(Boolean);
  return parts.length ? parts.join(" - ") : result.documentTitle;
}

function buildSummaryText(draft: SourceAnswerDraft): string {
  const topResult = draft.topResult;
  if (!draft.reliable || !topResult) return SAFE_FALLBACK_MESSAGE;

  const points = draft.results
    .slice(0, 3)
    .map((result) => firstSentences(directAnswer(result), 2))
    .filter(Boolean);
  const uniquePoints = Array.from(new Set(points));

  return [
    "Here is the short version:",
    "",
    uniquePoints.length > 1 ? formatNumberedList(uniquePoints) : uniquePoints[0],
    "",
    `Source basis: ${sourceReference(topResult)}.`
  ]
    .filter(Boolean)
    .join("\n");
}

function buildInstructionText(draft: SourceAnswerDraft): string {
  const topResult = draft.topResult;
  if (!draft.reliable || !topResult) return SAFE_FALLBACK_MESSAGE;

  const steps = topResult.steps?.filter(Boolean) ?? [];
  const prerequisites = topResult.prerequisites?.filter(Boolean) ?? [];
  const lines = ["Here is what you can do:"];

  lines.push("", steps.length > 0 ? formatNumberedList(steps) : firstSentences(directAnswer(topResult), 4));

  if (prerequisites.length > 0) {
    lines.push("", "Prepare these first:", formatNumberedList(prerequisites));
  }

  if (topResult.office) {
    lines.push("", `Best office to verify: ${topResult.office}.`);
  }

  return lines.join("\n");
}

export function buildCapabilityQuestion(
  question: string,
  capability: StudentChatCapability,
  scenario?: QuestionScenario,
  language: ReplyLanguage = "english"
): string {
  const scenarioLine = scenario ? `Student scenario: ${scenario}. ` : "";
  const languageLine = `${replyLanguageInstruction(language)} `;
  switch (capability) {
    case "summary":
      return `${scenarioLine}${languageLine}Student request type: summary. Answer naturally in plain language.\nQuestion: ${question}`;
    case "instruction":
      return `${scenarioLine}${languageLine}Student request type: practical instructions. Answer naturally and use steps only when they help.\nQuestion: ${question}`;
    case "general_advice":
      return `${scenarioLine}${languageLine}Student request type: safe general advice. Answer like a helpful student guide.\nQuestion: ${question}`;
    default:
      return question;
  }
}

export function buildDeterministicCapabilityResponse(
  question: string,
  capability: StudentChatCapability,
  draft: SourceAnswerDraft
): SearchResponse {
  const topResult = draft.topResult;
  const answerText = capability === "instruction" ? buildInstructionText(draft) : buildSummaryText(draft);

  return {
    question,
    normalizedQuestion: draft.normalizedQuestion,
    responseType: responseTypeForCapability(capability),
    results: draft.results,
    confidence: draft.confidence,
    reliable: draft.reliable,
    ...(topResult ? { topResult } : {}),
    answerText,
    citationsUsed: topResult ? [topResult.chunkId] : [],
    provenance: draft.provenance,
    activeMode: draft.selectedMode.mode,
    ...(draft.confidence === "medium" ? { verificationNote: MEDIUM_CONFIDENCE_NOTE } : {})
  };
}

export function buildGeneralAdviceUnavailableResponse(question: string, mode: DeviceAIMode): SearchResponse {
  const answerText = buildDeterministicSafeAnswerText(question, "general_advice");
  const needsMoreContext = answerText.startsWith("I need a bit more context");

  return {
    question,
    normalizedQuestion: normalizeQuery(question),
    responseType: "general_advice",
    results: [],
    confidence: needsMoreContext ? "low" : "medium",
    reliable: !needsMoreContext,
    answerText,
    citationsUsed: [],
    provenance: needsMoreContext ? "General chat unavailable without local AI" : "Answered with safe student guidance",
    activeMode: mode
  };
}

export function buildSafeQuestionFallbackResponse(
  question: string,
  capability: StudentChatCapability,
  mode: DeviceAIMode,
  scenario: QuestionScenario = "unknown_general"
): SearchResponse {
  const answerText = buildDeterministicSafeAnswerText(question, capability, scenario);
  const needsMoreContext = answerText.startsWith("I need a bit more context");

  return {
    question,
    normalizedQuestion: normalizeQuery(question),
    responseType: capability === "instruction" ? "instruction" : "general_advice",
    results: [],
    confidence: needsMoreContext ? "low" : "medium",
    reliable: !needsMoreContext,
    answerText,
    citationsUsed: [],
    provenance: "Answered with safe student guidance",
    activeMode: mode
  };
}

export function buildImageGenerationResponse(question: string, mode: DeviceAIMode): SearchResponse {
  return {
    question,
    normalizedQuestion: normalizeQuery(question),
    responseType: "image_generation",
    results: [],
    confidence: "low",
    reliable: false,
    answerText:
      "Image generation is not enabled in this build yet. I can help write the image prompt, poster copy, layout idea, or infographic outline for now. On high-end devices, this should become an optional local model download instead of a required feature.",
    citationsUsed: [],
    provenance: mode.provenance,
    activeMode: mode
  };
}
