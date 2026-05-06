import type { SearchOptions, SearchResult } from "@/types/search";

export interface Retriever {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}
