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

const STEP_DETAIL_MAX_LENGTH = 150;
const SUMMARY_POINT_MAX_LENGTH = 180;
const EXTRA_DETAIL_MAX_LENGTH = 160;
const MAX_VISIBLE_INSTRUCTION_STEPS = 6;

interface FormattedSourceStep {
  title: string;
  detail?: string;
}

function normalizeInline(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function compact(value: string, maxLength = 700): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const clipped = normalized.slice(0, maxLength - 3).trim();
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped).trim()}...`;
}

function splitSentences(value: string): string[] {
  return normalizeInline(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function firstSentences(value: string, maxSentences = 3, maxLength = 700): string {
  const sentences = splitSentences(value);
  return compact((sentences.length ? sentences.slice(0, maxSentences).join(" ") : value).trim(), maxLength);
}

function formatNumberedList(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item.trim()}`).join("\n");
}

function uniqueCompact(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = normalizeInline(item);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function terminalPunctuation(value: string): string {
  return /[.!?)]$/.test(value) ? value : `${value}.`;
}

function cleanStepTitle(value: string): string {
  return compact(
    normalizeInline(value)
      .replace(/^step\s+\d+\s*[:.)-]\s*/i, "")
      .replace(/[.:]\s*$/u, ""),
    90
  );
}

function sourceStep(title: string, detail: string): FormattedSourceStep {
  const cleanTitle = cleanStepTitle(title);
  const cleanDetail = firstSentences(detail, 1, STEP_DETAIL_MAX_LENGTH);
  return cleanDetail ? { title: cleanTitle, detail: cleanDetail } : { title: cleanTitle };
}

function splitSourceStep(value: string): FormattedSourceStep | null {
  const normalized = normalizeInline(value).replace(/^step\s+\d+\s*[:.)-]\s*/i, "");
  if (!normalized) return null;

  const colonIndex = normalized.indexOf(":");
  if (colonIndex > 0 && colonIndex <= 100) {
    return sourceStep(normalized.slice(0, colonIndex), normalized.slice(colonIndex + 1));
  }

  const [titleSentence, ...detailSentences] = splitSentences(normalized);
  if (titleSentence && detailSentences.length > 0 && titleSentence.length <= 110) {
    return sourceStep(titleSentence, detailSentences.join(" "));
  }

  return { title: cleanStepTitle(firstSentences(normalized, 1, STEP_DETAIL_MAX_LENGTH)) };
}

function parseContentSteps(content: string): FormattedSourceStep[] {
  const normalized = normalizeInline(content);
  const markers = Array.from(normalized.matchAll(/\bstep\s+\d+\s*:\s*/gi));
  if (markers.length === 0) return [];

  return markers
    .map((marker, index) => {
      const nextMarker = markers[index + 1];
      const start = (marker.index ?? 0) + marker[0].length;
      const end = nextMarker?.index ?? normalized.length;
      return splitSourceStep(normalized.slice(start, end));
    })
    .filter((step): step is FormattedSourceStep => Boolean(step?.title));
}

function parseAnswerStepTitles(answer: string): FormattedSourceStep[] {
  const match = normalizeInline(answer).match(/follow(?: these)? steps?:\s*(.+)$/i);
  const listText = match?.[1]?.replace(/[.]\s*$/u, "");
  if (!listText) return [];

  return listText
    .split(/\s*,\s*/)
    .map((title) => cleanStepTitle(title))
    .filter(Boolean)
    .map((title) => ({ title }));
}

function sourceSteps(result: SearchResult): FormattedSourceStep[] {
  const explicitSteps = result.steps?.map(splitSourceStep).filter((step): step is FormattedSourceStep => Boolean(step?.title)) ?? [];
  if (explicitSteps.length > 0) return explicitSteps;

  const contentSteps = parseContentSteps(result.content);
  if (contentSteps.length > 0) return contentSteps;

  const answerSteps = parseAnswerStepTitles(getDirectAnswer(result));
  if (answerSteps.length > 0) return answerSteps;

  const fallback = firstSentences(getDirectAnswer(result), 1, SUMMARY_POINT_MAX_LENGTH);
  return fallback ? [{ title: fallback }] : [];
}

function formatSourceStep(step: FormattedSourceStep): string {
  return step.detail ? `${step.title}: ${terminalPunctuation(step.detail)}` : terminalPunctuation(step.title);
}

function textHasFeeSignal(value: string): boolean {
  return /(?:\u20b1|PHP|P)\s?\d/i.test(value) || /\b(fees?|payment|cashier|amount)\b/i.test(value);
}

function textHasRequirementSignal(value: string): boolean {
  return (
    /\b(requirements?|prerequisites?|documents?)\b/i.test(value) ||
    (/\b(must present|presents?|submits?|following documents|required|prepare)\b/i.test(value) &&
      /\b(document|form|certificate|receipt|affidavit|id|identification)\b/i.test(value))
  );
}

function extractMatchingSourceDetails(result: SearchResult, matcher: (value: string) => boolean): string[] {
  const stepDetails = sourceSteps(result)
    .filter((step) => matcher(`${step.title} ${step.detail ?? ""}`))
    .map(formatSourceStep);

  const sentenceDetails = splitSentences(getDirectAnswer(result))
    .filter(matcher)
    .map((sentence) => firstSentences(sentence, 1, EXTRA_DETAIL_MAX_LENGTH));

  return uniqueCompact([...stepDetails, ...sentenceDetails]).slice(0, 2);
}

function requirementDetails(result: SearchResult): string[] {
  const prerequisites = result.prerequisites
    ?.map((item) => firstSentences(item, 1, EXTRA_DETAIL_MAX_LENGTH))
    .filter(Boolean) ?? [];

  if (prerequisites.length > 0) {
    return uniqueCompact(prerequisites).slice(0, 2);
  }

  return uniqueCompact(
    sourceSteps(result)
      .filter((step) => textHasRequirementSignal(`${step.title} ${step.detail ?? ""}`))
      .map((step) => step.title)
  ).slice(0, 2);
}

function feeDetails(result: SearchResult): string[] {
  const stepFees = sourceSteps(result)
    .filter((step) => textHasFeeSignal(`${step.title} ${step.detail ?? ""}`))
    .map(formatSourceStep);

  return stepFees.length > 0
    ? uniqueCompact(stepFees).slice(0, 2)
    : extractMatchingSourceDetails(result, textHasFeeSignal);
}

function joinDetails(details: string[]): string {
  return details.map(terminalPunctuation).join(" ");
}

function verificationTarget(result: SearchResult): string | null {
  const office = normalizeInline(result.office);
  const officeLocation = normalizeInline(result.officeLocation);

  if (office && officeLocation && office.toLowerCase() !== officeLocation.toLowerCase()) {
    return `${office} (${compact(officeLocation, 90)})`;
  }

  return office || officeLocation || null;
}

function removeDetailsAlreadyShown(details: string[], includedText: string): string[] {
  const included = normalizeInline(includedText).toLowerCase();
  if (!included) return details;

  return details.filter((detail) => {
    const normalizedDetail = normalizeInline(detail).toLowerCase();
    const detailTitle = normalizedDetail.split(":")[0]?.trim() ?? "";
    return !included.includes(normalizedDetail) && (!detailTitle || !included.includes(detailTitle));
  });
}

function sourceExtraLines(result: SearchResult, includedText = ""): string[] {
  const requirements = removeDetailsAlreadyShown(requirementDetails(result), includedText);
  const fees = removeDetailsAlreadyShown(feeDetails(result), includedText);
  const contactInfo = normalizeInline(result.contactInfo);
  const verification = verificationTarget(result);

  return [
    requirements.length > 0 ? `Requirements: ${joinDetails(requirements)}` : null,
    fees.length > 0 ? `Fees: ${joinDetails(fees)}` : null,
    contactInfo ? `Contact: ${terminalPunctuation(contactInfo)}` : null,
    verification ? `Verify with: ${terminalPunctuation(verification)}` : null
  ].filter((line): line is string => Boolean(line));
}

function summaryPoint(result: SearchResult): string {
  const steps = sourceSteps(result);
  if (steps.length > 1) {
    const stepTitles = steps.slice(0, 4).map((step) => step.title);
    const remainingCount = steps.length - stepTitles.length;
    const suffix = remainingCount > 0 ? `, plus ${remainingCount} more` : "";
    return compact(`Main steps: ${stepTitles.join("; ")}${suffix}.`, SUMMARY_POINT_MAX_LENGTH);
  }

  return firstSentences(getDirectAnswer(result), 1, SUMMARY_POINT_MAX_LENGTH);
}

function dentalCareClarificationText(question: string): string | null {
  const normalized = normalizeQuery(question);
  const mentionsDentalCare = /\bdental\b.*\bcare\b|\bcare\b.*\bdental\b/.test(normalized);
  const hasSpecificDentalTarget = /\b(consultation|consult|treatment|emergency|urgent|toothache|pain)\b/.test(normalized);
  if (!mentionsDentalCare || hasSpecificDentalTarget) {
    return null;
  }

  return "I have 1 quick question: do you mean dental care consultation, dental treatment, or dental emergency treatment?";
}

function sourceClarificationText(question: string, draft: SourceAnswerDraft): string | null {
  return draft.ambiguity?.clarificationQuestion ?? draft.mismatch?.clarificationQuestion ?? dentalCareClarificationText(question);
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

function summaryResults(draft: SourceAnswerDraft): SearchResult[] {
  const topResult = draft.topResult;
  if (!draft.reliable || !topResult) return [];

  const matchingResults = draft.results.filter((result) => result.documentId === topResult.documentId);
  return matchingResults.some((result) => result.chunkId === topResult.chunkId)
    ? matchingResults.slice(0, 3)
    : [topResult, ...matchingResults].slice(0, 3);
}

function buildSummaryText(draft: SourceAnswerDraft, citedResults: SearchResult[]): string {
  const topResult = draft.topResult;
  if (!draft.reliable || !topResult) return SAFE_FALLBACK_MESSAGE;

  const points = citedResults
    .map(summaryPoint)
    .filter(Boolean);
  const uniquePoints = uniqueCompact(points);
  const extraLines = sourceExtraLines(topResult);

  return [
    "Short version:",
    "",
    uniquePoints.length > 1 ? formatNumberedList(uniquePoints) : uniquePoints[0],
    "",
    ...extraLines
  ]
    .filter(Boolean)
    .join("\n");
}

function buildInstructionText(draft: SourceAnswerDraft): string {
  const topResult = draft.topResult;
  if (!draft.reliable || !topResult) return SAFE_FALLBACK_MESSAGE;

  const steps = sourceSteps(topResult);
  const visibleSteps = steps.slice(0, MAX_VISIBLE_INSTRUCTION_STEPS).map(formatSourceStep);
  const extraLines = sourceExtraLines(topResult, visibleSteps.join("\n"));
  const hiddenStepCount = Math.max(0, steps.length - visibleSteps.length);
  const lines = ["Quick answer:"];

  lines.push("", visibleSteps.length > 0 ? formatNumberedList(visibleSteps) : `1. ${firstSentences(getDirectAnswer(topResult), 1, SUMMARY_POINT_MAX_LENGTH)}`);
  if (hiddenStepCount > 0) lines.push("", `The reference section has ${hiddenStepCount} more item${hiddenStepCount === 1 ? "" : "s"}.`);
  if (extraLines.length > 0) lines.push("", ...extraLines);

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
    requestedChatRole: "haki",
    answerBasis: "safety_or_app_guidance",
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
    requestedChatRole: "haki",
    answerBasis: "safety_or_app_guidance",
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
    requestedChatRole: "haki",
    answerBasis: "safety_or_app_guidance",
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
  const section = profileLine(profileContext, "Section");

  if (/\b(age|old)\b/.test(normalized)) {
    return {
      question,
      requestedChatRole: "haki",
      answerBasis: "safety_or_app_guidance",
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
    year ? `Year level: ${year}` : null,
    section ? `Section: ${section}` : null
  ].filter(Boolean);

  return {
    question,
    requestedChatRole: "haki",
    answerBasis: "safety_or_app_guidance",
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
  const clarificationText = sourceClarificationText(question, draft);
  if (clarificationText) {
    return {
      question,
      requestedChatRole: "haki",
      answerBasis: "campus_sources_unavailable",
      normalizedQuestion: draft.normalizedQuestion,
      responseType: "source",
      results: [],
      confidence: "low",
      reliable: false,
      answerText: clarificationText,
      citationsUsed: [],
      provenance: "No reliable saved source found",
      activeMode: draft.selectedMode.mode
    };
  }

  const citedResults = !draft.reliable || !topResult
    ? []
    : capability === "instruction"
      ? [topResult]
      : summaryResults(draft);
  const answerText = capability === "instruction"
    ? buildInstructionText(draft)
    : buildSummaryText(draft, citedResults);

  return {
    question,
    requestedChatRole: "haki",
    answerBasis: draft.reliable && Boolean(topResult) ? "campus_sources" : "campus_sources_unavailable",
    normalizedQuestion: draft.normalizedQuestion,
    responseType: responseTypeForCapability(capability),
    results: draft.results,
    confidence: draft.confidence,
    reliable: draft.reliable,
    ...(topResult ? { topResult } : {}),
    answerText,
    citationsUsed: citedResults.map((result) => result.chunkId),
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
    requestedChatRole: "haki",
    answerBasis: "haki_guidance",
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
    requestedChatRole: "haki",
    answerBasis: "haki_guidance",
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
    requestedChatRole: "haki",
    answerBasis: "safety_or_app_guidance",
    normalizedQuestion: normalizeQuery(question),
    responseType: "image_generation",
    results: [],
    confidence: "low",
    reliable: false,
    answerText:
      "Creating images is not available here yet. I can still help write an image idea, poster text, layout plan, or infographic outline.",
    citationsUsed: [],
    provenance: mode.provenance,
    activeMode: mode
  };
}
