import type { SearchOptions, SearchResult } from "@/types/search";
import type { LocalAIProvider } from "@/ai/LocalAIProvider";

import type { Retriever } from "./Retriever";

export class VectorRetriever implements Retriever {
  constructor(private readonly embeddingProvider: LocalAIProvider | null = null) {}

  async search(query: string, _options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.embeddingProvider?.embedText) {
      return [];
    }

    // Placeholder for the custom-development-build path:
    // 1. Generate the query embedding with the local provider.
    // 2. Load chunk_embeddings rows for the same model.
    // 3. Rank by cosine similarity.
    // 4. Hydrate SearchResult rows from chunks/documents.
    //
    // The query embedding call is intentionally kept here so native provider
    // failures are surfaced to the caller and can trigger FTS5 fallback.
    await this.embeddingProvider.embedText(query);
    return [];
  }
}
