import { isCampusFocusedQuestion, validateCampusGroundingQuality } from "@/ai/outputQuality";
import type { AnswerBasis, ChatRole, SearchOptions, SearchResponse, SearchResult, SourceAnchor } from "@/types/search";
import { normalizeQuery } from "@/retrieval/queryNormalizer";

import { answerSafeLocalChatWithContext, responseForUnsafeRequest } from "./safeLocalChatService";
import { classifyStudentQuestionIntent } from "./questionIntentService";
import {
  buildAnswerContract,
  buildContractClarificationResponse,
  withAnswerContractMetadata,
  type AnswerContract
} from "./answerContractService";
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
  buildDeterministicSourceResponseFromDraft,
  retrieveSourceAnswerDraft,
  type SourceAnswerDraft
} from "./sourceAnswerService";
import { getDeviceCapabilityReport, getSelectedAIMode, type SelectedAIMode } from "./modeSelectionService";
import { buildCanteenFoodResponse } from "./canteenAnswerService";
import {
  buildGeneratedModeUnavailableResponse,
  buildModeScopeResponse,
  classifyHakiDomains,
  composeHakiResponse,
  friendlyGuidanceResponse,
  withResearcherMetadata,
  sourceAnswerBasis,
  withChatRoleMetadata
} from "./chatRoleService";

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

function buildSourceDraftClarificationResponse(question: string, sourceDraft: SourceAnswerDraft): SearchResponse | null {
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

function buildOfficialSourceAnswer(
  question: string,
  intent: ReturnType<typeof classifyStudentQuestionIntent>,
  sourceDraft: SourceAnswerDraft
): SearchResponse {
  if (intent.type === "safe_question" && (intent.capability === "summary" || intent.capability === "instruction")) {
    return buildDeterministicCapabilityResponse(question, intent.capability, sourceDraft);
  }

  return buildDeterministicSourceResponseFromDraft(question, sourceDraft);
}

function taskContextForContract(
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

async function buildEnglishOnlyRedirect(question: string): Promise<SearchResponse> {
  const selectedMode = await getSelectedAIMode();
  return {
    question,
    requestedChatRole: "haki",
    answerBasis: "safety_or_app_guidance",
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

type SafeQuestionIntent = Extract<ReturnType<typeof classifyStudentQuestionIntent>, { type: "safe_question" }>;
type ContextualSourceResolution =
  | { kind: "none" }
  | { kind: "clarify" }
  | { intent: SafeQuestionIntent; kind: "source"; retrievalQuestion: string };

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

function resolveContextualSourceRequest(
  question: string,
  intent: ReturnType<typeof classifyStudentQuestionIntent>,
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

function withRole(
  response: SearchResponse,
  chatRole: ChatRole,
  answerBasis: AnswerBasis
): SearchResponse {
  return withChatRoleMetadata(response, chatRole, answerBasis);
}

function withSourceRole(response: SearchResponse, chatRole: ChatRole): SearchResponse {
  return withRole(response, chatRole, sourceAnswerBasis(response));
}

const UNIVERSAL_DETERMINISTIC_SCENARIOS = new Set([
  "adversarial",
  "capability_discovery",
  "clarification",
  "conversation_goodbye",
  "conversation_greeting",
  "conversation_thanks"
]);

function friendSupportTaskContext(
  intent: ReturnType<typeof classifyStudentQuestionIntent>,
  contract: AnswerContract
): string {
  return [
    taskContextForContract(intent, contract),
    "Respond only to the student's emotional or practical support need. Do not include campus procedures, requirements, fees, deadlines, office locations, or contact details. Do not claim clinical credentials or diagnose. The application handles campus-information routing separately."
  ]
    .filter(Boolean)
    .join("\n");
}

function researcherTaskContext(
  intent: ReturnType<typeof classifyStudentQuestionIntent>,
  contract: AnswerContract
): string {
  return [
    taskContextForContract(intent, contract),
    "Respond only to facts or general knowledge outside campus. Do not provide TUPT procedures, fees, deadlines, offices, locations, contacts, or personal-support advice. The chat screen already displays the mode's accuracy restriction above the conversation, so do not repeat it in this answer."
  ]
    .filter(Boolean)
    .join("\n");
}

async function answerWithFriendlyGuidance(
  question: string,
  intent: ReturnType<typeof classifyStudentQuestionIntent>,
  contract: AnswerContract,
  options: SearchOptions,
  selectedMode: SelectedAIMode,
  hasSafeLocalChat: boolean,
  omittedDomains: Array<"campus_information" | "external_fact"> = []
): Promise<SearchResponse> {
  if (!hasSafeLocalChat) {
    return buildGeneratedModeUnavailableResponse(question, "friendly_buddy", selectedMode.mode);
  }
  const response = await answerSafeLocalChatWithContext(question, {
    chatRole: "friendly_buddy",
    conversationContext: options.conversationContext,
    conversationState: options.conversationState,
    intent,
    onToken: options.onToken,
    originalQuestion: question,
    profileContext: options.profileContext,
    taskContext: friendSupportTaskContext(intent, contract),
    ...(options.abortSignal ? { abortSignal: options.abortSignal } : {})
  });
  const fallback = await maybeBuildLocalAnswerQualityFallback(question, intent, response);
  return friendlyGuidanceResponse(question, fallback ?? response, omittedDomains);
}

async function answerWithResearcherFacts(
  question: string,
  intent: ReturnType<typeof classifyStudentQuestionIntent>,
  contract: AnswerContract,
  options: SearchOptions,
  selectedMode: SelectedAIMode,
  hasSafeLocalChat: boolean,
  role: "researcher" | "haki" = "researcher"
): Promise<SearchResponse> {
  if (!hasSafeLocalChat) {
    return buildGeneratedModeUnavailableResponse(question, role, selectedMode.mode);
  }
  const response = await answerSafeLocalChatWithContext(question, {
    chatRole: "researcher",
    conversationContext: options.conversationContext,
    conversationState: options.conversationState,
    intent,
    onToken: options.onToken,
    originalQuestion: question,
    profileContext: options.profileContext,
    taskContext: researcherTaskContext(intent, contract),
    ...(options.abortSignal ? { abortSignal: options.abortSignal } : {})
  });
  const fallback = await maybeBuildLocalAnswerQualityFallback(question, intent, response);
  return withResearcherMetadata(withAnswerContractMetadata(fallback ?? response, contract), role);
}

async function answerWithSavedSources(
  question: string,
  intent: SafeQuestionIntent,
  scopedOptions: SearchOptions,
  selectedMode: SelectedAIMode,
  clarifyWeakSourceQuery: boolean,
  retrievalQuestion = question
): Promise<SearchResponse> {
  const sourceDraft = await retrieveSourceAnswerDraft(retrievalQuestion, scopedOptions, selectedMode);
  const sourceClarification = buildSourceDraftClarificationResponse(question, sourceDraft);
  if (sourceClarification) {
    return sourceClarification;
  }

  if (!sourceDraft.reliable) {
    if (clarifyWeakSourceQuery && shouldClarifyWeakSourceQuery(question, intent)) {
      return buildAmbiguousSourceClarificationResponse(question, selectedMode);
    }

    return buildSourceMissFallbackResponse(question, intent, selectedMode.mode);
  }

  return buildOfficialSourceAnswer(question, intent, sourceDraft);
}

export async function answerStudentQuestion(
  question: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const initialIntent = options.intent ?? classifyStudentQuestionIntent(question);
  const initialContract = buildAnswerContract(question, initialIntent);
  const requestedChatRole = options.chatRole ?? "haki";
  const selectedMode = await getSelectedAIMode();
  const hasSafeLocalChat = canUseSafeLocalChat(selectedMode);
  const chatRole: ChatRole = requestedChatRole;

  if (initialIntent.type === "unsafe_request") {
    return withRole(await responseForUnsafeRequest(question), chatRole, "safety_or_app_guidance");
  }

  if (options.continuation) {
    if (!hasSafeLocalChat || chatRole === "information_officer") {
      return buildGeneratedModeUnavailableResponse(question, chatRole === "information_officer" ? "haki" : chatRole, selectedMode.mode);
    }
    const response = await answerSafeLocalChatWithContext(question, {
      chatRole,
      conversationContext: options.conversationContext,
      conversationState: options.conversationState,
      intent: initialIntent,
      onToken: options.onToken,
      originalQuestion: question,
      profileContext: options.profileContext,
      taskContext: taskContextForContract(initialIntent, initialContract),
      ...(options.abortSignal ? { abortSignal: options.abortSignal } : {})
    });
    return withRole(
      withAnswerContractMetadata({ ...response, question }, initialContract),
      chatRole,
      chatRole === "friendly_buddy" ? "friendly_guidance" : chatRole === "researcher" ? "researcher_facts" : "haki_guidance"
    );
  }

  const wellbeingResponse = buildWellbeingSupportResponse(question, initialIntent, selectedMode.mode);
  if (wellbeingResponse) {
    return withRole(wellbeingResponse, chatRole, "safety_or_app_guidance");
  }

  if (isTagalogLike(initialIntent.language)) {
    return withRole(await buildEnglishOnlyRedirect(question), chatRole, "safety_or_app_guidance");
  }

  if (initialIntent.scenario === "device_specification") {
    return withRole(
      buildDeviceSpecificationResponse(question, selectedMode.mode, await getDeviceCapabilityReport()),
      chatRole,
      "safety_or_app_guidance"
    );
  }

  const profileResponse = buildProfileContextResponse(question, selectedMode.mode, options.profileContext);
  if (profileResponse) {
    return withRole(profileResponse, chatRole, "safety_or_app_guidance");
  }

  const contextualSource = resolveContextualSourceRequest(question, initialIntent, chatRole, options.conversationState);
  if (contextualSource.kind === "clarify") {
    return withSourceRole(buildAmbiguousSourceClarificationResponse(question, selectedMode), chatRole);
  }

  const intent = contextualSource.kind === "source" ? contextualSource.intent : initialIntent;
  const contract = contextualSource.kind === "source" ? buildAnswerContract(question, intent) : initialContract;
  const scopedOptions = optionsWithIntentScope(options, intent);
  const domains = classifyHakiDomains(question, intent);
  const retrievalQuestion = contextualSource.kind === "source" ? contextualSource.retrievalQuestion : question;
  const contractClarification = buildContractClarificationResponse(question, contract, selectedMode);
  const quickResponse = buildQuickScenarioResponse(question, intent, selectedMode.mode);

  if (quickResponse && UNIVERSAL_DETERMINISTIC_SCENARIOS.has(intent.scenario)) {
    return withRole(quickResponse, chatRole, "safety_or_app_guidance");
  }

  if (intent.capability === "image_generation") {
    return withRole(buildImageGenerationResponse(question, selectedMode.mode), chatRole, "safety_or_app_guidance");
  }

  const organizationOfficersResponse = chatRole === "haki"
    ? buildOrganizationOfficersResponse(question, intent, selectedMode.mode)
    : null;
  if (organizationOfficersResponse && chatRole === "haki") {
    return withRole(organizationOfficersResponse, chatRole, "safety_or_app_guidance");
  }

  const canteenFoodResponse = chatRole === "haki" ? buildCanteenFoodResponse(question, intent, selectedMode.mode) : null;
  if (canteenFoodResponse && chatRole === "haki") {
    return withRole(canteenFoodResponse, chatRole, "campus_sources");
  }

  if (contractClarification && (chatRole === "haki" || chatRole === "information_officer")) {
    return withSourceRole(contractClarification, chatRole);
  }

  if (chatRole === "information_officer") {
    if (!domains.includes("campus_information")) {
      return buildModeScopeResponse(question, chatRole, domains, selectedMode.mode);
    }
    return withSourceRole(
      await answerWithSavedSources(question, intent, scopedOptions, selectedMode, false, retrievalQuestion),
      chatRole
    );
  }

  if (chatRole === "friendly_buddy") {
    if (!domains.includes("supportive_advice")) {
      return buildModeScopeResponse(question, chatRole, domains, selectedMode.mode);
    }
    const omitted = domains.filter(
      (domain): domain is "campus_information" | "external_fact" => domain !== "supportive_advice"
    );
    return answerWithFriendlyGuidance(question, intent, contract, options, selectedMode, hasSafeLocalChat, omitted);
  }

  if (chatRole === "researcher") {
    if (!domains.includes("external_fact")) {
      return buildModeScopeResponse(question, chatRole, domains, selectedMode.mode);
    }
    return answerWithResearcherFacts(question, intent, contract, options, selectedMode, hasSafeLocalChat);
  }

  if (quickResponse) {
    return withRole(quickResponse, "haki", "safety_or_app_guidance");
  }

  const campusResponse = domains.includes("campus_information")
    ? withSourceRole(await answerWithSavedSources(question, intent, scopedOptions, selectedMode, true, retrievalQuestion), "haki")
    : undefined;
  const friendlyResponse = domains.includes("supportive_advice")
    ? await answerWithFriendlyGuidance(question, intent, contract, options, selectedMode, hasSafeLocalChat)
    : undefined;
  const researcherResponse = domains.includes("external_fact")
    ? await answerWithResearcherFacts(question, intent, contract, options, selectedMode, hasSafeLocalChat, "haki")
    : undefined;

  return composeHakiResponse(question, campusResponse, friendlyResponse, researcherResponse);
}
