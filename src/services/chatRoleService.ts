import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import { validateCampusGroundingQuality } from "@/ai/outputQuality";
import { normalizeQuery } from "@/retrieval/queryNormalizer";
import type { AnswerBasis, ChatRole, SearchResponse, SuggestedModeAction } from "@/types/search";

import type { StudentQuestionIntent } from "./studentChatTypes";

export type HakiDomain = "campus_information" | "supportive_advice" | "external_fact";

const SUPPORT_SCENARIOS = new Set(["relationship_advice", "study_advice"]);
const EXTERNAL_FACT_SCENARIOS = new Set([
  "coding_help",
  "creative_brainstorm",
  "general_knowledge",
  "off_topic_silly",
  "summary_or_translation",
  "unknown_general"
]);
const SUPPORT_SIGNAL =
  /\b(feel|feeling|stress(?:ed|ful)?|worried|worry|anxious|anxiety|embarrass(?:ed|ing)?|overwhelmed|scared|afraid|nervous|upset|lonely|sad|struggling|need support|need advice|relationship|crush|study advice|hard for me|difficult for me)\b/i;
const EXTERNAL_FACT_SIGNAL =
  /\b(also|and)\b.{0,80}\b(what is|who is|explain|define|history|science|research|fact|facts?|python|javascript|code)\b/i;
const CAMPUS_INFORMATION_DETAIL_SIGNAL =
  /\b(?:fees?|deadline|requirements?|procedures?|application forms?|affidavits?|receipts?|office locations?|gate[- ]?pass)\b|(?:\b(?:submit|bring|fill(?:\s+out)?|pay|present|proceed|apply|go\s+to|visit|contact|ask|get|obtain)\b.{0,60}\b(?:osa|registrar|cashier|student affairs|office|clinic|guidance|library|department)\b)|(?:\b(?:osa|registrar|cashier|student affairs|office|clinic|guidance|library|department)\b.{0,60}\b(?:submit|bring|fill(?:\s+out)?|pay|present|proceed|apply|go\s+to|visit|contact|ask|get|obtain|require)\b)|(?:\u20b1|\bFM-[A-Z0-9-]+\b)/i;

const LEGACY_INLINE_RESEARCHER_REMINDER =
  "Reminder: Haki can make mistakes. Please verify important facts with reliable sources.";

function action(mode: ChatRole): SuggestedModeAction {
  const names: Record<ChatRole, string> = {
    haki: "Haki",
    information_officer: "Information Officer",
    friendly_buddy: "Friendly Buddy",
    researcher: "Researcher"
  };
  return {
    label: `Switch to ${names[mode]} and answer`,
    mode,
    rerunQuestion: true
  };
}

export function classifyHakiDomains(question: string, intent: StudentQuestionIntent): HakiDomain[] {
  if (intent.type !== "safe_question") return [];

  const domains: HakiDomain[] = [];
  if (intent.route === "source_context") {
    domains.push("campus_information");
  }
  if (SUPPORT_SCENARIOS.has(intent.scenario) || SUPPORT_SIGNAL.test(question)) {
    domains.push("supportive_advice");
  }
  if (
    EXTERNAL_FACT_SCENARIOS.has(intent.scenario) ||
    (intent.route === "source_context" && EXTERNAL_FACT_SIGNAL.test(question))
  ) {
    domains.push("external_fact");
  }

  if (domains.length === 0 && intent.route === "obvious_general") {
    domains.push("external_fact");
  }
  return [...new Set(domains)];
}

export function sourceAnswerBasis(response: SearchResponse): AnswerBasis {
  return response.reliable && Boolean(response.topResult ?? response.results[0])
    ? "campus_sources"
    : "campus_sources_unavailable";
}

export function withChatRoleMetadata(
  response: SearchResponse,
  requestedChatRole: ChatRole,
  answerBasis: AnswerBasis
): SearchResponse {
  return {
    ...response,
    requestedChatRole,
    answerBasis
  };
}

function switchActions(domains: HakiDomain[], currentRole: ChatRole): SuggestedModeAction[] {
  const modes = domains.map((domain): ChatRole => {
    if (domain === "campus_information") return "information_officer";
    if (domain === "supportive_advice") return "friendly_buddy";
    return "researcher";
  });
  const distinct = [...new Set(modes)].filter((mode) => mode !== currentRole);
  if (!distinct.includes("haki") && currentRole !== "haki") distinct.push("haki");
  return distinct.map(action);
}

export function buildModeScopeResponse(
  question: string,
  currentRole: Exclude<ChatRole, "haki">,
  domains: HakiDomain[],
  mode: DeviceAIMode
): SearchResponse {
  return {
    question,
    requestedChatRole: currentRole,
    answerBasis: currentRole === "friendly_buddy" ? "friendly_guidance" : currentRole === "researcher" ? "researcher_facts" : "campus_sources_unavailable",
    normalizedQuestion: normalizeQuery(question),
    responseType: "general_advice",
    results: [],
    confidence: "high",
    reliable: true,
    answerText: "This question fits another Haki mode. Choose a switch option below to continue.",
    citationsUsed: [],
    provenance: "Answered with safe student guidance",
    activeMode: mode,
    suggestedModeActions: switchActions(domains, currentRole)
  };
}

export function buildGeneratedModeUnavailableResponse(
  question: string,
  role: "friendly_buddy" | "researcher" | "haki",
  mode: DeviceAIMode
): SearchResponse {
  return {
    question,
    requestedChatRole: role,
    answerBasis: role === "friendly_buddy" ? "friendly_guidance" : role === "researcher" ? "researcher_facts" : "haki_guidance",
    normalizedQuestion: normalizeQuery(question),
    responseType: "safe_local_chat",
    results: [],
    confidence: "low",
    reliable: false,
    answerText:
      "Saved campus information is available now, but this response needs a local chat model. Set up a chat model to unlock Friendly Buddy and Researcher help.",
    citationsUsed: [],
    provenance: "General chat unavailable without local AI",
    activeMode: mode
  };
}

export function withResearcherMetadata(response: SearchResponse, role: ChatRole = "researcher"): SearchResponse {
  const answerText = response.answerText?.trim();
  return {
    ...response,
    requestedChatRole: role,
    answerBasis: role === "researcher" ? "researcher_facts" : "haki_guidance",
    ...(answerText
      ? { answerText: answerText.replace(LEGACY_INLINE_RESEARCHER_REMINDER, "").trim() }
      : {})
  };
}

function canDisplayFriendlyGuidance(question: string, guidanceResponse: SearchResponse): boolean {
  const guidance = guidanceResponse.answerText?.trim();
  if (!guidanceResponse.reliable || !guidance || CAMPUS_INFORMATION_DETAIL_SIGNAL.test(guidance)) {
    return false;
  }
  return validateCampusGroundingQuality({ answerText: guidance, question }).ok;
}

function stripSources(response: SearchResponse): SearchResponse {
  const stripped = { ...response, results: [], citationsUsed: [] };
  delete stripped.topResult;
  delete stripped.verificationNote;
  return stripped;
}

export function friendlyGuidanceResponse(
  question: string,
  response: SearchResponse,
  omittedDomains: HakiDomain[] = []
): SearchResponse {
  if (!canDisplayFriendlyGuidance(question, response)) {
    return {
      ...stripSources(response),
      answerText: "I can help with how this situation feels, but I cannot safely provide a personal response just now.",
      reliable: false,
      requestedChatRole: "friendly_buddy",
      answerBasis: "friendly_guidance",
      ...(omittedDomains.length ? { suggestedModeActions: switchActions(omittedDomains, "friendly_buddy") } : {})
    };
  }
  return {
    ...stripSources(response),
    requestedChatRole: "friendly_buddy",
    answerBasis: "friendly_guidance",
    ...(omittedDomains.length ? { suggestedModeActions: switchActions(omittedDomains, "friendly_buddy") } : {})
  };
}

export function composeHakiResponse(
  question: string,
  campusResponse?: SearchResponse,
  friendlyResponse?: SearchResponse,
  researcherResponse?: SearchResponse
): SearchResponse {
  const usableFriendly = friendlyResponse?.provenance === "General chat unavailable without local AI"
    ? friendlyResponse
    : friendlyResponse
      ? friendlyGuidanceResponse(question, friendlyResponse)
      : undefined;
  const responses = [campusResponse, usableFriendly, researcherResponse].filter(
    (response): response is SearchResponse => Boolean(response)
  );
  const base = campusResponse ?? usableFriendly ?? researcherResponse;
  if (!base) {
    throw new Error("composeHakiResponse requires at least one response");
  }
  if (responses.length === 1) {
    const basis = campusResponse
      ? sourceAnswerBasis(campusResponse)
      : researcherResponse
        ? "researcher_facts"
        : "haki_guidance";
    return withChatRoleMetadata(base, "haki", basis);
  }

  const blocks = [
    campusResponse?.answerText?.trim()
      ? `Campus information from saved sources:\n${campusResponse.answerText.trim()}`
      : null,
    usableFriendly?.answerText?.trim()
      ? `Supportive guidance:\n${usableFriendly.answerText.trim()}`
      : null,
    researcherResponse?.answerText?.trim()
      ? `General information:\n${researcherResponse.answerText.trim()}`
      : null
  ].filter((value): value is string => Boolean(value));
  return {
    ...base,
    question,
    requestedChatRole: "haki",
    answerBasis: "haki_composed",
    responseType: "safe_local_chat",
    answerText: blocks.join("\n\n"),
    reliable: responses.every((response) => response.reliable),
    results: campusResponse?.results ?? [],
    ...(campusResponse?.topResult ? { topResult: campusResponse.topResult } : {}),
    citationsUsed: campusResponse?.citationsUsed ?? []
  };
}
