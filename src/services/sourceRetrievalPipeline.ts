import type { AnswerProvenance, DeviceAIMode } from "@/ai/DeviceAIMode";
import { getDatabase } from "@/db/database";
import { FTSRetriever } from "@/retrieval/FTSRetriever";
import { HybridRetriever } from "@/retrieval/HybridRetriever";
import type { Retriever } from "@/retrieval/Retriever";
import { VectorRetriever } from "@/retrieval/VectorRetriever";
import type { SearchOptions, SearchResult } from "@/types/search";

import type { SelectedAIMode } from "./modeSelectionService";

export interface SourceRetrievalResult {
  provenance: AnswerProvenance;
  results: SearchResult[];
  selectedMode: SelectedAIMode;
}

class StaticRetriever implements Retriever {
  constructor(private readonly results: SearchResult[]) {}

  async search(_query: string, _options?: SearchOptions): Promise<SearchResult[]> {
    return this.results;
  }
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

export async function retrieveRankedSources(
  question: string,
  options: SearchOptions,
  selectedMode: SelectedAIMode
): Promise<SourceRetrievalResult> {
  const db = await getDatabase();
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
