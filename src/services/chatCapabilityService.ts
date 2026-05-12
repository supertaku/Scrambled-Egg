import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import type { DeviceCapabilityReport } from "@/ai/CapabilityDetector";
import { ORGANIZATION_OFFICERS_MOCK_NOTICE, mockOrganizationOfficers } from "@/data/organizationOfficers";
import { MEDIUM_CONFIDENCE_NOTE, SAFE_FALLBACK_MESSAGE } from "@/ai/prompts";
import { normalizeQuery } from "@/retrieval/queryNormalizer";
import type { SearchResponse, SearchResponseType, SearchResult } from "@/types/search";

import {
  buildDeterministicSafeAnswerText,
  buildQuickScenarioResponse,
  buildSourceMissFallbackResponse
} from "./scenarioResponseService";
import { replyLanguageInstruction } from "./replyLanguageService";
import type { QuestionScenario, ReplyLanguage, StudentChatCapability, StudentQuestionIntent } from "./studentChatTypes";
import type { SourceAnswerDraft } from "./sourceAnswerService";
import { getDirectAnswer } from "./searchResultText";

export {
  buildDeterministicSafeAnswerText,
  buildQuickScenarioResponse,
  buildSourceMissFallbackResponse
};
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

function formatGB(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not reported" : `${value.toFixed(1)}GB`;
}

function formatCapability(value: boolean): string {
  return value ? "Available" : "Unavailable";
}

function activeModelName(mode: DeviceAIMode, report: DeviceCapabilityReport): string {
  return (
    mode.capabilities.modelName ??
    report.providers.find((provider) => provider.id === mode.summaryProviderId)?.modelName ??
    "No active model reported"
  );
}

function isOrganizationOfficerQuestion(question: string): boolean {
  return (
    /\b(org|orgs|organization|organizations|council|officers?|president|vice president|secretary|treasurer|auditor)\b/i.test(question) &&
    /\b(officers?|president|vice president|secretary|treasurer|auditor|who is|who are|org chart|organization chart)\b/i.test(question)
  );
}

function officerMatchesQuestion(question: string, organization: string): boolean {
  const normalizedQuestion = normalizeQuery(question);
  const normalizedOrg = normalizeQuery(organization);
  return normalizedOrg
    .split(" ")
    .filter((token) => token.length > 3)
    .some((token) => normalizedQuestion.includes(token));
}

const EMOTIONAL_DISTRESS_PATTERNS = [
  /\b(i am|i'm|im|feeling)?\s*(depressed|depression|hopeless|lonely|overwhelmed|burned out|burnout)\b/i,
  /\b(ayoko na|pagod na ako|gusto ko mawala|di ko na kaya|hindi ko na kaya|sobrang bigat)\b/i
];

function isEmotionalDistressQuestion(question: string): boolean {
  return EMOTIONAL_DISTRESS_PATTERNS.some((pattern) => pattern.test(question));
}

function profileLine(profileContext: string | undefined, label: string): string | null {
  const line = profileContext
    ?.split("\n")
    .map((item) => item.trim())
    .find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return line?.slice(label.length + 1).trim() || null;
}

function isProfileQuestion(question: string): boolean {
  return /\b(who am i|what do you know about me|my profile|what is my name|what course am i|what program am i|what year am i|how old (am )?i|my age)\b/i.test(question);
}

function buildSummaryText(draft: SourceAnswerDraft): string {
  const topResult = draft.topResult;
  if (!draft.reliable || !topResult) return SAFE_FALLBACK_MESSAGE;

  const points = draft.results
    .slice(0, 3)
    .map((result) => firstSentences(getDirectAnswer(result), 2))
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

  lines.push("", steps.length > 0 ? formatNumberedList(steps) : firstSentences(getDirectAnswer(topResult), 4));

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
  return question;
}

function capabilityFormatHint(capability: StudentChatCapability, scenario?: QuestionScenario): string {
  switch (capability) {
    case "summary":
      return "Format: 2-4 bullet points or short sentences covering the key facts.";
    case "instruction":
      return "Format: numbered steps. Keep each step to one clear sentence. List any required items or documents before the steps if relevant.";
    case "general_advice":
      if (scenario === "coding_help") {
        return "Format: show the code in a fenced code block, then add a 1-2 sentence explanation.";
      }
      if (scenario === "study_advice" || scenario === "relationship_advice") {
        return "Format: 2-5 sentences of practical, actionable advice.";
      }
      if (scenario === "creative_brainstorm") {
        return "Format: 3-5 short ideas or bullet points.";
      }
      return "Format: 2-5 sentences of clear, practical guidance.";
    default:
      return "Answer the user's question directly and concisely.";
  }
}

export function buildCapabilityTaskContext(
  capability: StudentChatCapability,
  scenario?: QuestionScenario,
  language: ReplyLanguage = "english"
): string {
  const formatHint = capabilityFormatHint(capability, scenario);
  return [replyLanguageInstruction(language), formatHint].filter(Boolean).join("\n");
}

export function buildDeviceSpecificationResponse(
  question: string,
  mode: DeviceAIMode,
  report: DeviceCapabilityReport
): SearchResponse {
  const answerText = [
    "Here are the device details Haki can read right now:",
    "",
    `1. Platform: ${report.platform} ${report.osVersion}`,
    `2. ABI: ${(report.architecture ?? report.supportedAbis.join(", ")) || "Not reported"}`,
    `3. RAM: ${formatGB(report.memoryGB)}; app heap: ${report.memoryClass ?? "Not reported"}`,
    `4. Free storage: ${formatGB(report.freeStorageGB)}`,
    `5. Active local AI: ${mode.summaryProviderName ?? mode.label}`,
    `6. Active model: ${activeModelName(mode, report)}`,
    `7. Active tier: ${mode.capabilities.modelTier ?? "unknown"}; recommended tier: ${report.recommendedModelTier}`,
    `8. Safe chat: ${formatCapability(report.safeChatAvailable)}; summarization: ${formatCapability(report.summarizationAvailable)}; embeddings: ${formatCapability(report.embeddingsAvailable)}`,
    `9. Context window: ${mode.capabilities.contextWindowTokens ?? "Not reported"} tokens`
  ].join("\n");

  return {
    question,
    normalizedQuestion: normalizeQuery(question),
    responseType: "general_advice",
    results: [],
    confidence: "high",
    reliable: true,
    answerText,
    citationsUsed: [],
    provenance: "Answered with safe student guidance",
    activeMode: mode
  };
}

export function buildOrganizationOfficersResponse(
  question: string,
  intent: StudentQuestionIntent,
  mode: DeviceAIMode
): SearchResponse | null {
  if (intent.type !== "safe_question" || !isOrganizationOfficerQuestion(question)) {
    return null;
  }

  const matchingOfficers = mockOrganizationOfficers.filter((officer) =>
    officerMatchesQuestion(question, officer.organization)
  );
  const officers = matchingOfficers.length > 0 ? matchingOfficers : mockOrganizationOfficers.slice(0, 5);
  const officerLines = officers.map(
    (officer) => `${officer.role}: ${officer.name} (${officer.organization}, ${officer.yearLevel})`
  );
  const answerText = [
    "Here is the current mock officer list Haki can use for testing:",
    "",
    ...officerLines,
    "",
    ORGANIZATION_OFFICERS_MOCK_NOTICE
  ].join("\n");

  return {
    question,
    normalizedQuestion: normalizeQuery(question),
    responseType: "general_advice",
    results: [],
    confidence: "medium",
    reliable: true,
    answerText,
    citationsUsed: [],
    provenance: "Answered with safe student guidance",
    activeMode: mode
  };
}

export function buildWellbeingSupportResponse(
  question: string,
  intent: StudentQuestionIntent,
  mode: DeviceAIMode
): SearchResponse | null {
  if (intent.type !== "safe_question" || intent.scenario !== "wellbeing_safety" || !isEmotionalDistressQuestion(question)) {
    return null;
  }

  // English-only policy (AGENTS.md): always reply in English regardless of the
  // detected language. Wellbeing safety messages especially must be clear and
  // un-codeswitched so emergency numbers and resources aren't lost in
  // translation.
  const answerText =
    "I hear you. That feels heavy, and you do not have to handle it alone. If you feel unsafe or might hurt yourself, contact emergency help, 911 in the Philippines, NCMH Crisis Hotline, or someone near you now. If you can, message a trusted friend or family member and consider reaching out to Guidance or counseling support.";

  return {
    question,
    normalizedQuestion: normalizeQuery(question),
    responseType: "general_advice",
    results: [],
    confidence: "high",
    reliable: true,
    answerText,
    citationsUsed: [],
    provenance: "Answered with safe student guidance",
    activeMode: mode
  };
}

export function buildProfileContextResponse(
  question: string,
  mode: DeviceAIMode,
  profileContext?: string | undefined
): SearchResponse | null {
  if (!isProfileQuestion(question)) {
    return null;
  }

  const normalized = normalizeQuery(question);
  const name = profileLine(profileContext, "Name");
  const course = profileLine(profileContext, "Course/program");
  const year = profileLine(profileContext, "Year level");

  if (/\b(age|old)\b/.test(normalized)) {
    return {
      question,
      normalizedQuestion: normalizeQuery(question),
      responseType: "general_advice",
      results: [],
      confidence: "high",
      reliable: true,
      answerText: "I do not have your age saved in your profile. I only have the profile details you entered in the app.",
      citationsUsed: [],
      provenance: "Answered with safe student guidance",
      activeMode: mode
    };
  }

  const details = [
    name ? `Name: ${name}` : null,
    course ? `Course/program: ${course}` : null,
    year ? `Year level: ${year}` : null
  ].filter(Boolean);

  return {
    question,
    normalizedQuestion: normalizeQuery(question),
    responseType: "general_advice",
    results: [],
    confidence: details.length > 0 ? "high" : "low",
    reliable: details.length > 0,
    answerText: details.length > 0
      ? `Here is what I have saved in your profile:\n\n${details.join("\n")}`
      : "I do not have profile details saved for you yet.",
    citationsUsed: [],
    provenance: "Answered with safe student guidance",
    activeMode: mode
  };
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
