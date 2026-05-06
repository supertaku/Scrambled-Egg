import type { SQLiteDatabase } from "expo-sqlite";

import type { SearchOptions, SearchResult } from "@/types/search";

import type { Retriever } from "./Retriever";
import { buildSafeFtsQueries, tokenizeQuery } from "./queryNormalizer";
import { rankSearchResults } from "./ranking";

interface SearchRow {
  id: number;
  chunk_id: string;
  document_id: string;
  document_title: string;
  document_type: string | null;
  section_title: string | null;
  process_name: string | null;
  content: string;
  answer: string | null;
  citation: string | null;
  page_number: number | null;
  category: string | null;
  office: string | null;
  tags: string | null;
  synonyms: string | null;
  steps: string | null;
  prerequisites: string | null;
  office_location: string | null;
  contact_info: string | null;
  priority: number;
  last_updated: string | null;
  snippet: string | null;
  content_highlight: string | null;
  score: number;
}

export function safeStringArrayFromJson(value: string | null): string[] | null {
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return null;
    }

    const items = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

export class FTSRetriever implements Retriever {
  constructor(private readonly db: SQLiteDatabase) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = options.limit ?? 8;
    const ftsQueries = buildSafeFtsQueries(query);
    if (ftsQueries.length === 0) {
      return [];
    }

    for (const ftsQuery of ftsQueries) {
      try {
        const rows = await this.runFtsSearch(ftsQuery, limit, options);
        if (rows.length > 0) {
          return this.toRankedResults(rows, query).slice(0, limit);
        }
      } catch {
        continue;
      }
    }

    return this.fallbackLikeSearch(query, limit, options);
  }

  private async runFtsSearch(ftsQuery: string, limit: number, options: SearchOptions): Promise<SearchRow[]> {
    let whereClause = "chunks_fts MATCH ?";
    const params: (string | number)[] = [ftsQuery];

    if (options.scope?.office) {
      whereClause += " AND c.office = ?";
      params.push(options.scope.office);
    }
    if (options.scope?.category) {
      whereClause += " AND c.category = ?";
      params.push(options.scope.category);
    }
    if (options.scope?.documentId) {
      whereClause += " AND c.document_id = ?";
      params.push(options.scope.documentId);
    }

    params.push(limit);

    return this.db.getAllAsync<SearchRow>(
      `
      SELECT
        c.id,
        c.chunk_id,
        c.document_id,
        c.document_title,
        d.document_type,
        c.section_title,
        c.process_name,
        c.content,
        c.answer,
        c.citation,
        c.page_number,
        c.category,
        c.office,
        c.tags,
        c.synonyms,
        c.steps,
        c.prerequisites,
        c.office_location,
        c.contact_info,
        c.priority,
        d.last_updated,
        snippet(chunks_fts, -1, '[match]', '[/match]', '...', 32) AS snippet,
        highlight(chunks_fts, 2, '[match]', '[/match]') AS content_highlight,
        bm25(chunks_fts, 10.0, 10.0, 3.0, 6.0, 3.0, 2.0, 2.0, 2.0, 8.0) AS score
      FROM chunks_fts
      JOIN chunks c ON c.id = chunks_fts.rowid
      JOIN documents d ON d.document_id = c.document_id
      WHERE ${whereClause}
      ORDER BY score ASC
      LIMIT ?
      `,
      params
    );
  }

  private async fallbackLikeSearch(query: string, limit: number, options: SearchOptions): Promise<SearchResult[]> {
    const tokens = tokenizeQuery(query);
    if (tokens.length === 0) {
      return [];
    }

    const firstToken = tokens[0];
    if (!firstToken) {
      return [];
    }

    const pattern = `%${firstToken}%`;
    let whereClause = `
      (lower(c.section_title) LIKE ?
      OR lower(c.process_name) LIKE ?
      OR lower(c.content) LIKE ?
      OR lower(c.answer) LIKE ?
      OR lower(c.citation) LIKE ?
      OR lower(c.category) LIKE ?
      OR lower(c.office) LIKE ?
      OR lower(c.tags) LIKE ?
      OR lower(c.synonyms) LIKE ?)
    `;
    const params: (string | number)[] = [
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern
    ];

    if (options.scope?.office) {
      whereClause += " AND c.office = ?";
      params.push(options.scope.office);
    }
    if (options.scope?.category) {
      whereClause += " AND c.category = ?";
      params.push(options.scope.category);
    }
    if (options.scope?.documentId) {
      whereClause += " AND c.document_id = ?";
      params.push(options.scope.documentId);
    }

    params.push(limit);

    const rows = await this.db.getAllAsync<SearchRow>(
      `
      SELECT
        c.id,
        c.chunk_id,
        c.document_id,
        c.document_title,
        d.document_type,
        c.section_title,
        c.process_name,
        c.content,
        c.answer,
        c.citation,
        c.page_number,
        c.category,
        c.office,
        c.tags,
        c.synonyms,
        c.steps,
        c.prerequisites,
        c.office_location,
        c.contact_info,
        c.priority,
        d.last_updated,
        NULL AS snippet,
        NULL AS content_highlight,
        0 AS score
      FROM chunks c
      JOIN documents d ON d.document_id = c.document_id
      WHERE ${whereClause}
      LIMIT ?
      `,
      params
    );

    return this.toRankedResults(rows, query).slice(0, limit);
  }

  private toRankedResults(rows: SearchRow[], query: string): SearchResult[] {
    const results = rows.map<SearchResult>((row) => ({
      id: row.id,
      chunkId: row.chunk_id,
      documentId: row.document_id,
      documentTitle: row.document_title,
      documentType: row.document_type,
      sectionTitle: row.section_title,
      processName: row.process_name,
      content: row.content,
      answer: row.answer,
      citation: row.citation,
      pageNumber: row.page_number,
      category: row.category,
      office: row.office,
      tags: row.tags ? row.tags.split(" ").filter(Boolean) : [],
      synonyms: row.synonyms ? row.synonyms.split(" ").filter(Boolean) : [],
      steps: safeStringArrayFromJson(row.steps),
      prerequisites: safeStringArrayFromJson(row.prerequisites),
      officeLocation: row.office_location,
      contactInfo: row.contact_info,
      priority: row.priority,
      lastUpdated: row.last_updated,
      snippet: row.snippet,
      contentHighlight: row.content_highlight,
      bm25Score: row.score,
      rankScore: 0,
      confidence: "low"
    }));

    return rankSearchResults(results, query);
  }
}
