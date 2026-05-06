import type { SearchOptions, SearchResult } from "@/types/search";

import type { Retriever } from "./Retriever";
import { reciprocalRankFusion } from "./rrf";

export class HybridRetriever implements Retriever {
  constructor(private readonly retrievers: Retriever[] = []) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (this.retrievers.length === 0) {
      return [];
    }

    if (this.retrievers.length === 1) {
      const retriever = this.retrievers[0];
      return retriever ? retriever.search(query, options) : [];
    }

    const settledResults = await Promise.allSettled(
      this.retrievers.map((retriever) => retriever.search(query, options))
    );
    const resultSets = settledResults
      .filter((result): result is PromiseFulfilledResult<SearchResult[]> => result.status === "fulfilled")
      .map((result) => result.value)
      .filter((results) => results.length > 0);

    return reciprocalRankFusion(resultSets, 60, options.limit ?? 8);
  }
}
