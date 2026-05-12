import type { LocalModelTier, SourceChunkForSummary } from "@/ai/LocalAIProvider";
import { pruneSourcesForTier } from "@/ai/tokenBudget";
import type { SearchResult } from "@/types/search";

function toSourceChunk(result: SearchResult): SourceChunkForSummary {
  return {
    citationId: result.chunkId,
    chunkId: result.chunkId,
    documentTitle: result.documentTitle,
    sectionTitle: result.sectionTitle,
    processName: result.processName,
    content: result.content,
    answer: result.answer,
    citation: result.citation,
    pageNumber: result.pageNumber,
    category: result.category,
    office: result.office,
    lastUpdated: result.lastUpdated
  };
}

/** Maps retrieval hits into tier-pruned chunks for summarization / safe local chat prompts. */
export function sourceChunksForSafeChat(results: SearchResult[], tier?: LocalModelTier): SourceChunkForSummary[] {
  return pruneSourcesForTier(results.map(toSourceChunk), tier);
}
