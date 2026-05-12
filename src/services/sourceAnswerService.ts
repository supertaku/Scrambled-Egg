import type { SQLiteDatabase } from "expo-sqlite";

import { provenanceForSummaryProvider } from "@/ai/DeviceAIMode";
import type { AnswerProvenance, DeviceAIMode } from "@/ai/DeviceAIMode";
import { MEDIUM_CONFIDENCE_NOTE, SAFE_FALLBACK_MESSAGE, STRICT_LOCAL_SUMMARIZATION_INSTRUCTION } from "@/ai/prompts";
import { getDatabase } from "@/db/database";
import { FTSRetriever } from "@/retrieval/FTSRetriever";
import { HybridRetriever } from "@/retrieval/HybridRetriever";
import type { Retriever } from "@/retrieval/Retriever";
import { VectorRetriever } from "@/retrieval/VectorRetriever";
import { calculateConfidence } from "@/retrieval/confidence";
import { normalizeQuery } from "@/retrieval/queryNormalizer";
import type { SearchOptions, SearchResponse, SearchResult } from "@/types/search";
import { getPreferredModelTier } from "@/utils/aiUtils";
import { DEFAULT_RETRIEVAL_LIMIT, MAX_PROVIDER_RETRIES } from "@/utils/constants";

import {
  disableAIProviderForSession,
  forceFallbackModeForResponse,
  getSelectedAIMode,
  type SelectedAIMode
} from "./modeSelectionService";
import { getDirectAnswer } from "./searchResultText";
import { sourceChunksForSafeChat } from "./sourceChunkAdapter";

export interface SourceAnswerDraft {
  confidence: SearchResponse["confidence"];
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

function responseForNoReliableAnswer(
  question: string,
  normalizedQuestion: string,
  mode: DeviceAIMode,
  provenance: AnswerProvenance
): SearchResponse {
  return {
    question,
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
  } catch (error) {
    disableAIProviderForSession(embeddingProvider.id, error);
    if (attempt < MAX_PROVIDER_RETRIES) {
      const fallbackSelection = await getSelectedAIMode();
      return runRetrieval(db, question, options, fallbackSelection, attempt + 1);
    }

    return {
      results: ftsResults,
      selectedMode: {
        mode: forceFallbackModeForResponse(mode, "Vector retrieval failed; using FTS5 for this answer."),
        summaryProvider: null,
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
    disableAIProviderForSession(summaryProvider.id, error);
    if (attempt < MAX_PROVIDER_RETRIES) {
      const fallbackSelection = await getSelectedAIMode();
      return maybeSummarizeFromSources(question, fallbackSelection, results, attempt + 1);
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
  const reliable = (confidence === "high" || confidence === "medium") && Boolean(topResult);

  return {
    confidence,
    normalizedQuestion,
    provenance: retrieval.provenance,
    reliable,
    results: retrieval.results,
    selectedMode: retrieval.selectedMode,
    ...(topResult ? { topResult } : {})
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
