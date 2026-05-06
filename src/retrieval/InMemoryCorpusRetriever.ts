import type { StructuredDocument } from "../types/document";
import type { SearchOptions, SearchResult } from "../types/search";

import type { Retriever } from "./Retriever";
import { normalizeQuery, tokenizeQuery } from "./queryNormalizer";
import { rankSearchResults } from "./ranking";
import { expandToken } from "./synonymIndex";

function optionalList(items: string[] | undefined): string[] {
  return items ?? [];
}

function toNullableList(items: string[] | undefined): string[] | null {
  return items && items.length > 0 ? items : null;
}

function matchesScope(result: SearchResult, options: SearchOptions): boolean {
  if (options.scope?.office && result.office !== options.scope.office) {
    return false;
  }
  if (options.scope?.category && result.category !== options.scope.category) {
    return false;
  }
  if (options.scope?.documentId && result.documentId !== options.scope.documentId) {
    return false;
  }
  return true;
}

function buildHaystack(result: SearchResult): string {
  return normalizeQuery(
    [
      result.documentTitle,
      result.documentType,
      result.sectionTitle,
      result.processName,
      result.office,
      result.category,
      result.answer,
      result.content,
      result.citation,
      result.tags.join(" "),
      result.synonyms.join(" ")
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export class InMemoryCorpusRetriever implements Retriever {
  private readonly corpus: SearchResult[];

  constructor(documents: StructuredDocument[]) {
    this.corpus = documents.flatMap((document, documentIndex) =>
      document.chunks.map<SearchResult>((chunk, chunkIndex) => ({
        id: documentIndex * 1000 + chunkIndex + 1,
        chunkId: chunk.chunk_id,
        documentId: document.document_id,
        documentTitle: document.document_title,
        documentType: document.document_type ?? null,
        sectionTitle: chunk.section_title ?? null,
        processName: chunk.process_name ?? null,
        content: chunk.content,
        answer: chunk.answer ?? null,
        citation: chunk.citation ?? null,
        pageNumber: chunk.page_number ?? null,
        category: document.category ?? null,
        office: document.office ?? null,
        tags: optionalList(chunk.tags),
        lastUpdated: document.last_updated ?? null,
        synonyms: optionalList(chunk.synonyms),
        steps: toNullableList(chunk.steps),
        prerequisites: toNullableList(chunk.prerequisites),
        officeLocation: chunk.office_location ?? null,
        contactInfo: chunk.contact_info ?? null,
        priority: chunk.priority ?? 0,
        snippet: null,
        contentHighlight: null,
        bm25Score: 0,
        rankScore: 0,
        confidence: "low"
      }))
    );
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const tokens = tokenizeQuery(query);
    if (tokens.length === 0) {
      return [];
    }

    const scored = this.corpus
      .filter((result) => matchesScope(result, options))
      .map((result) => {
        const haystack = buildHaystack(result);
        const matchedTokens = tokens.filter((token) =>
          expandToken(token).some((variation) => haystack.includes(normalizeQuery(variation)))
        );
        return {
          result,
          matchedTokens
        };
      })
      .filter(({ matchedTokens }) => matchedTokens.length > 0)
      .map(({ result, matchedTokens }) => ({
        ...result,
        bm25Score: -matchedTokens.length
      }));

    return rankSearchResults(scored, query).slice(0, options.limit ?? 8);
  }
}
