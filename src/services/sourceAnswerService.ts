import type { SQLiteDatabase } from "expo-sqlite";

import { provenanceForSummaryProvider } from "@/ai/DeviceAIMode";
import type { AnswerProvenance, DeviceAIMode } from "@/ai/DeviceAIMode";
import { providerFailureAction } from "@/ai/providerFailurePolicy";
import { MEDIUM_CONFIDENCE_NOTE, SAFE_FALLBACK_MESSAGE, STRICT_LOCAL_SUMMARIZATION_INSTRUCTION } from "@/ai/prompts";
import { getDatabase } from "@/db/database";
import { FTSRetriever } from "@/retrieval/FTSRetriever";
import { HybridRetriever } from "@/retrieval/HybridRetriever";
import type { Retriever } from "@/retrieval/Retriever";
import { VectorRetriever } from "@/retrieval/VectorRetriever";
import { calculateConfidence } from "@/retrieval/confidence";
import { normalizeQuery, tokenizeQuery } from "@/retrieval/queryNormalizer";
import type { SearchOptions, SearchResponse, SearchResult } from "@/types/search";
import { getPreferredModelTier } from "@/utils/aiUtils";
import { DEFAULT_RETRIEVAL_LIMIT, MAX_PROVIDER_RETRIES } from "@/utils/constants";

import {
  disableAIProviderForSession,
  forceFallbackModeForResponse,
  getSelectedAIMode,
  refreshDeviceCapabilities,
  type SelectedAIMode
} from "./modeSelectionService";
import { LOST_ID_PATTERNS, matchesAny } from "./questionScenarioService";
import { getDirectAnswer } from "./searchResultText";
import { sourceChunksForSafeChat } from "./sourceChunkAdapter";

export interface SourceAnswerAmbiguity {
  clarificationQuestion: string;
  kind: "dental_care_procedure" | "multiple_close_source_matches";
  options: string[];
}

export interface SourceAnswerMismatch {
  actualOffice?: string;
  clarificationQuestion: string;
  kind: "registrar_document_osa_mismatch";
  reason: string;
  rejectedChunkId: string;
}

export interface SourceAnswerDraft {
  ambiguity?: SourceAnswerAmbiguity;
  confidence: SearchResponse["confidence"];
  issue?: {
    actualOffice?: string | null;
    expectedOffice?: string;
    message: string;
    type: "scope_mismatch";
  };
  mismatch?: SourceAnswerMismatch;
  normalizedQuestion: string;
  provenance: AnswerProvenance;
  reliable: boolean;
  results: SearchResult[];
  selectedMode: SelectedAIMode;
  topResult?: SearchResult;
}

class StaticRetriever implements Retriever {
  constructor(private readonly results: SearchResult[]) {}

  async search(_query: string, _options?: SearchOptions): Promise<SearchResult[]> {
    return this.results;
  }
}

// getPreferredModelTier is imported from @/utils/aiUtils (shared with safeLocalChatService)

const DENTAL_CARE_OPTIONS = [
  "dental care consultation",
  "dental treatment",
  "dental emergency treatment"
];

const GOOD_MORAL_QUERY_PATTERN = /\b(gmc|good moral|good moral character|certificate of good moral|good moral certificate|moral character)\b/i;
const REGISTRAR_DOCUMENT_QUERY_PATTERN =
  /\b(registrar|registrar'?s office|records?|academic records?|documents?|document request|certificate|certification|cor|certificate of registration|tor|transcript|honorable dismissal)\b/i;
const OSA_QUERY_PATTERN =
  /\b(osa|student affairs|student welfare|scholarship|organization|organizations?|orgs?|clubs?|discipline|orientation)\b/i;

function hasDentalCareAmbiguity(question: string): boolean {
  const normalized = normalizeQuery(question);
  const mentionsDentalCare = /\bdental\b.*\bcare\b|\bcare\b.*\bdental\b/.test(normalized);
  if (!mentionsDentalCare) {
    return false;
  }

  return !/\b(consultation|consult|treatment|emergency|urgent|toothache|pain)\b/.test(normalized);
}

function ambiguityForQuestion(question: string): SourceAnswerAmbiguity | undefined {
  if (!hasDentalCareAmbiguity(question)) {
    return undefined;
  }

  return {
    clarificationQuestion:
      "I have 1 quick question: do you mean dental care consultation, dental treatment, or dental emergency treatment?",
    kind: "dental_care_procedure",
    options: DENTAL_CARE_OPTIONS
  };
}

const SOURCE_PROCEDURE_QUERY_PATTERN =
  /\b(how|what|which|where|when|procedure|process|steps?|requirements?|request|apply|get|avail|file|submit)\b/i;

function optionLabel(result: SearchResult): string | null {
  return (result.processName ?? result.sectionTitle ?? result.answer ?? result.documentTitle)?.trim() || null;
}

function normalizedLabel(result: SearchResult): string {
  return normalizeQuery(optionLabel(result) ?? result.chunkId);
}

function tokensMatch(left: string, right: string): boolean {
  if (left === right) {
    return true;
  }

  const leftSingular = left.endsWith("s") ? left.slice(0, -1) : left;
  const rightSingular = right.endsWith("s") ? right.slice(0, -1) : right;
  if (leftSingular === rightSingular) {
    return true;
  }

  const leftRoot = left.endsWith("ing") ? left.slice(0, -3) : left;
  const rightRoot = right.endsWith("ing") ? right.slice(0, -3) : right;
  return leftRoot.length >= 4 && rightRoot.length >= 4 && (leftRoot === rightRoot || leftRoot === `${rightRoot}e` || `${leftRoot}e` === rightRoot);
}

function resultMatchesQueryExactly(result: SearchResult, normalizedQuestion: string): boolean {
  const queryTokens = tokenizeQuery(normalizedQuestion);
  const labels = [
    result.processName,
    result.sectionTitle,
    result.answer,
    result.synonyms.join(" "),
    result.tags.join(" ")
  ]
    .map((value) => normalizeQuery(value ?? ""))
    .filter(Boolean);

  return labels.some((label) => {
    if (label.length < 8) {
      return false;
    }

    if (normalizedQuestion.includes(label) || label.includes(normalizedQuestion)) {
      return true;
    }

    const labelTokens = tokenizeQuery(label);
    return queryTokens.length >= 2 && queryTokens.every((token) => labelTokens.some((labelToken) => tokensMatch(token, labelToken)));
  });
}

function hasSpecificNamedMatch(question: string, results: SearchResult[]): boolean {
  const normalizedQuestion = normalizeQuery(question);
  const topResult = results[0];
  return Boolean(topResult && resultMatchesQueryExactly(topResult, normalizedQuestion));
}

function isProcedureResult(result: SearchResult): boolean {
  const text = sourceText(result);
  return /\b(procedure|process|request|issuance|consultation|treatment|assessment|complaint|feedback)\b/.test(text);
}

function distinctOptionResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const distinct: SearchResult[] = [];

  for (const result of results) {
    const label = normalizedLabel(result);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    distinct.push(result);
  }

  return distinct;
}

function hasCloseScore(top: SearchResult, candidate: SearchResult): boolean {
  const topScore = top.rankScore || Math.abs(top.bm25Score) || 0;
  const candidateScore = candidate.rankScore || Math.abs(candidate.bm25Score) || 0;
  if (topScore <= 0 || candidateScore <= 0) {
    return true;
  }

  return candidateScore >= topScore * 0.62 || topScore - candidateScore <= 4;
}

function sameSourceFamily(top: SearchResult, candidate: SearchResult): boolean {
  if (top.documentId && candidate.documentId && top.documentId === candidate.documentId) return true;
  if (officeMatches(top.office, candidate.office ?? undefined)) return true;
  return Boolean(top.category && candidate.category && top.category === candidate.category);
}

function formatOptions(options: string[]): string {
  if (options.length <= 2) return options.join(" or ");
  return `${options.slice(0, -1).join(", ")}, or ${options[options.length - 1]}`;
}

function closeMatchAmbiguity(question: string, results: SearchResult[]): SourceAnswerAmbiguity | undefined {
  if (!SOURCE_PROCEDURE_QUERY_PATTERN.test(question) || results.length < 3 || hasDentalCareAmbiguity(question)) {
    return undefined;
  }

  if (hasSpecificNamedMatch(question, results)) {
    return undefined;
  }

  const topResult = results[0];
  if (!topResult || !isProcedureResult(topResult)) {
    return undefined;
  }

  const candidates = distinctOptionResults(
    results.filter((result) => sameSourceFamily(topResult, result) && isProcedureResult(result) && hasCloseScore(topResult, result))
  ).slice(0, 3);

  if (candidates.length < 3) {
    return undefined;
  }

  const options = candidates.map((result) => optionLabel(result)).filter((label): label is string => Boolean(label));
  if (options.length < 3) {
    return undefined;
  }

  return {
    clarificationQuestion: `I have 1 quick question: which TUPT process do you mean - ${formatOptions(options)}?`,
    kind: "multiple_close_source_matches",
    options
  };
}

function sourceText(result: SearchResult): string {
  return normalizeQuery(
    [
      result.chunkId,
      result.documentId,
      result.documentTitle,
      result.sectionTitle,
      result.processName,
      result.office,
      result.category,
      result.answer,
      result.citation,
      result.tags.join(" "),
      result.synonyms.join(" ")
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function isLostOrTemporaryIdSource(result: SearchResult): boolean {
  const text = sourceText(result);
  return (
    /\blost\b.*\bid\b|\bid\b.*\blost\b/.test(text) ||
    /\bdamaged\b.*\bid\b|\bid\b.*\bdamaged\b/.test(text) ||
    /\breplacement\b.*\bid\b|\bid\b.*\breplacement\b/.test(text) ||
    /\btemporary\b.*\bid\b|\bid\b.*\btemporary\b/.test(text)
  );
}

function isRegistrarDocumentQuery(question: string): boolean {
  return REGISTRAR_DOCUMENT_QUERY_PATTERN.test(question);
}

function isSpecificallyOsaQuery(question: string): boolean {
  return OSA_QUERY_PATTERN.test(question) || GOOD_MORAL_QUERY_PATTERN.test(question);
}

function mismatchForQuestion(question: string, topResult: SearchResult | undefined): SourceAnswerMismatch | undefined {
  if (!topResult || matchesAny(question, LOST_ID_PATTERNS)) {
    return undefined;
  }

  if (!isRegistrarDocumentQuery(question) || isSpecificallyOsaQuery(question) || !isLostOrTemporaryIdSource(topResult)) {
    return undefined;
  }

  return {
    ...(topResult.office ? { actualOffice: topResult.office } : {}),
    clarificationQuestion: "I have 1 quick question: which Registrar document or record do you need?",
    kind: "registrar_document_osa_mismatch",
    reason: "The top retrieved source is for OSA lost/damaged ID handling, but the question asks about Registrar/document records.",
    rejectedChunkId: topResult.chunkId
  };
}

function normalizeOffice(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/^tup-?taguig\s+/i, "")
    .replace(/\boffice of the\b/g, "")
    .replace(/\band\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function officeMatches(actual: string | null | undefined, requested: string | undefined): boolean {
  const left = normalizeOffice(actual);
  const right = normalizeOffice(requested);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function scopeMismatchIssue(topResult: SearchResult | undefined, options: SearchOptions): SourceAnswerDraft["issue"] | undefined {
  const expectedOffice = options.scope?.office;
  if (!expectedOffice || !topResult || officeMatches(topResult.office, expectedOffice)) {
    return undefined;
  }

  return {
    actualOffice: topResult.office,
    expectedOffice,
    message: `Top source belongs to ${topResult.office ?? "another office"} instead of ${expectedOffice}.`,
    type: "scope_mismatch"
  };
}

function responseForNoReliableAnswer(
  question: string,
  normalizedQuestion: string,
  mode: DeviceAIMode,
  provenance: AnswerProvenance
): SearchResponse {
  return {
    question,
    requestedChatRole: "haki",
    answerBasis: "campus_sources_unavailable",
    normalizedQuestion,
    responseType: "source",
    results: [],
    confidence: "low",
    reliable: false,
    answerText: SAFE_FALLBACK_MESSAGE,
    citationsUsed: [],
    provenance,
    activeMode: mode
  };
}

function modeWithVectorFallback(mode: DeviceAIMode, reason: string): DeviceAIMode {
  return {
    ...mode,
    provenance: "Retrieved directly from source",
    retrieverStrategy: "fts5",
    embeddingProviderId: null,
    embeddingProviderName: null,
    capabilities: {
      ...mode.capabilities,
      embeddings: false,
      reranking: false,
      unavailableReasons: [...mode.capabilities.unavailableReasons, reason],
      notes: [...mode.capabilities.notes, reason]
    },
    fallbackReason: reason
  };
}

async function runRetrieval(
  db: SQLiteDatabase,
  question: string,
  options: SearchOptions,
  selectedMode: SelectedAIMode,
  attempt = 0
): Promise<{ results: SearchResult[]; selectedMode: SelectedAIMode; provenance: AnswerProvenance }> {
  const { mode, embeddingProvider } = selectedMode;
  const ftsRetriever = new FTSRetriever(db);
  const ftsResults = await ftsRetriever.search(question, options);

  if (!embeddingProvider || !mode.capabilities.embeddings) {
    return {
      results: ftsResults,
      selectedMode,
      provenance: "Retrieved directly from source"
    };
  }

  try {
    const vectorRetriever = new VectorRetriever(db, embeddingProvider);
    const vectorResults = await vectorRetriever.search(question, options);

    if (vectorResults.length === 0) {
      return {
        results: ftsResults,
        selectedMode,
        provenance: ftsResults.length > 0 ? "Retrieved directly from source" : mode.provenance
      };
    }

    const hybridRetriever = new HybridRetriever([
      new StaticRetriever(ftsResults),
      new StaticRetriever(vectorResults)
    ]);

    const results = await hybridRetriever.search(question, options);
    return {
      results,
      selectedMode,
      provenance: ftsResults.length > 0 ? "Retrieved with hybrid search" : "Retrieved with semantic search"
    };
  } catch {
    const reason = "Vector retrieval failed; using FTS5 for this answer.";
    return {
      results: ftsResults,
      selectedMode: {
        mode: modeWithVectorFallback(mode, reason),
        summaryProvider: selectedMode.summaryProvider,
        embeddingProvider: null
      },
      provenance: "Retrieved directly from source"
    };
  }
}

async function maybeSummarizeFromSources(
  question: string,
  selectedMode: SelectedAIMode,
  results: SearchResult[],
  attempt = 0
): Promise<
  | { ok: true; answerText: string; citationsUsed: string[]; provenance: AnswerProvenance; mode: DeviceAIMode }
  | { ok: false; noReliableAnswer: boolean; mode: DeviceAIMode; provenance: AnswerProvenance }
> {
  const { mode, summaryProvider } = selectedMode;
  const topResult = results[0];
  if (!topResult || !summaryProvider || !mode.capabilities.summary || !mode.summaryProviderId) {
    return {
      ok: true,
      answerText: topResult ? getDirectAnswer(topResult) : SAFE_FALLBACK_MESSAGE,
      citationsUsed: topResult ? [topResult.chunkId] : [],
      provenance: mode.provenance === "Retrieved with semantic search" ? mode.provenance : "Retrieved directly from source",
      mode
    };
  }

  try {
    const preferredModelTier = getPreferredModelTier(mode);
    const sources = sourceChunksForSafeChat(results, preferredModelTier);
    if (sources.length === 0) {
      return {
        ok: false,
        noReliableAnswer: true,
        mode,
        provenance: provenanceForSummaryProvider(mode.summaryProviderId)
      };
    }
    const summary = await summaryProvider.summarizeFromSources({
      question,
      instruction: STRICT_LOCAL_SUMMARIZATION_INSTRUCTION,
      ...(preferredModelTier ? { preferredModelTier } : {}),
      sources
    });

    if (summary.status === "no_reliable_answer") {
      return {
        ok: false,
        noReliableAnswer: true,
        mode,
        provenance: provenanceForSummaryProvider(mode.summaryProviderId)
      };
    }

    return {
      ok: true,
      answerText: summary.text,
      citationsUsed: summary.citationIds,
      provenance: provenanceForSummaryProvider(mode.summaryProviderId),
      mode
    };
  } catch (error) {
    const action = providerFailureAction(error, attempt, MAX_PROVIDER_RETRIES);
    if (action === "disable_provider") {
      await disableAIProviderForSession(summaryProvider.id, error);
      if (attempt < MAX_PROVIDER_RETRIES) {
        const fallbackSelection = await getSelectedAIMode();
        return maybeSummarizeFromSources(question, fallbackSelection, results, attempt + 1);
      }
    } else if (action === "retry_provider") {
      await refreshDeviceCapabilities();
      const retrySelection = await getSelectedAIMode();
      return maybeSummarizeFromSources(question, retrySelection, results, attempt + 1);
    }

    return {
      ok: true,
      answerText: getDirectAnswer(topResult),
      citationsUsed: [topResult.chunkId],
      provenance: "Retrieved directly from source",
      mode: forceFallbackModeForResponse(mode, "Local summarization failed; using source search for this answer.")
    };
  }
}

export async function retrieveSourceAnswerDraft(
  question: string,
  options: SearchOptions = {},
  selectedModeOverride?: SelectedAIMode
): Promise<SourceAnswerDraft> {
  const normalizedQuestion = normalizeQuery(question);
  const db = await getDatabase();
  const selectedMode = selectedModeOverride ?? await getSelectedAIMode();
  const retrieval = await runRetrieval(
    db,
    normalizedQuestion,
    { limit: DEFAULT_RETRIEVAL_LIMIT, ...options },
    selectedMode
  );

  const confidence = calculateConfidence(retrieval.results, question);
  const topResult = retrieval.results[0];
  const ambiguity = ambiguityForQuestion(question) ?? closeMatchAmbiguity(question, retrieval.results);
  const issue = scopeMismatchIssue(topResult, options);
  const mismatch = mismatchForQuestion(question, topResult);
  const hasSourceIssue = Boolean(ambiguity || issue || mismatch);
  const reliable = !hasSourceIssue && (confidence === "high" || confidence === "medium") && Boolean(topResult);

  return {
    ...(ambiguity ? { ambiguity } : {}),
    confidence: hasSourceIssue ? "low" : confidence,
    ...(issue ? { issue } : {}),
    ...(mismatch ? { mismatch } : {}),
    normalizedQuestion,
    provenance: retrieval.provenance,
    reliable,
    results: retrieval.results,
    selectedMode: retrieval.selectedMode,
    ...(topResult ? { topResult } : {})
  };
}

export function buildDeterministicSourceResponseFromDraft(
  question: string,
  draft: SourceAnswerDraft
): SearchResponse {
  const topResult = draft.topResult;

  if (!draft.reliable || !topResult) {
    return responseForNoReliableAnswer(question, draft.normalizedQuestion, draft.selectedMode.mode, draft.provenance);
  }

  const verificationNote = draft.confidence === "medium" ? MEDIUM_CONFIDENCE_NOTE : undefined;

  return {
    question,
    requestedChatRole: "haki",
    answerBasis: "campus_sources",
    normalizedQuestion: draft.normalizedQuestion,
    responseType: "source",
    results: draft.results,
    confidence: draft.confidence,
    reliable: true,
    topResult,
    answerText: getDirectAnswer(topResult),
    citationsUsed: [topResult.chunkId],
    provenance: draft.provenance,
    activeMode: draft.selectedMode.mode,
    ...(verificationNote ? { verificationNote } : {})
  };
}

export async function buildSourceResponseFromDraft(
  question: string,
  draft: SourceAnswerDraft
): Promise<SearchResponse> {
  const topResult = draft.topResult;

  if (!draft.reliable || !topResult) {
    return responseForNoReliableAnswer(question, draft.normalizedQuestion, draft.selectedMode.mode, draft.provenance);
  }

  const summary = await maybeSummarizeFromSources(
    question,
    draft.selectedMode,
    draft.results
  );

  if (!summary.ok && summary.noReliableAnswer) {
    return responseForNoReliableAnswer(question, draft.normalizedQuestion, summary.mode, summary.provenance);
  }

  const verificationNote = draft.confidence === "medium" ? MEDIUM_CONFIDENCE_NOTE : undefined;

  return {
    question,
    requestedChatRole: "haki",
    answerBasis: "campus_sources",
    normalizedQuestion: draft.normalizedQuestion,
    responseType: "source",
    results: draft.results,
    confidence: draft.confidence,
    reliable: true,
    topResult,
    answerText: summary.ok ? summary.answerText : getDirectAnswer(topResult),
    citationsUsed: summary.ok ? summary.citationsUsed : [topResult.chunkId],
    provenance: summary.ok ? summary.provenance : draft.provenance,
    activeMode: summary.ok ? summary.mode : draft.selectedMode.mode,
    ...(verificationNote ? { verificationNote } : {})
  };
}

export async function answerFromSources(
  question: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const draft = await retrieveSourceAnswerDraft(question, options);
  return buildSourceResponseFromDraft(question, draft);
}
