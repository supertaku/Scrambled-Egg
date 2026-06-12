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

const MIN_OFFICE_CONTAINMENT_LENGTH = 7;

function officeNamesMatch(requested: string, candidate: string): boolean {
  if (!requested || !candidate) return false;
  if (requested === candidate) return true;

  const shorter = requested.length <= candidate.length ? requested : candidate;
  if (shorter.length < MIN_OFFICE_CONTAINMENT_LENGTH) return false;
  return requested.includes(candidate) || candidate.includes(requested);
}

function addOfficeScopeClause(
  whereClause: string,
  params: (string | number)[],
  officeAliases: string[] | undefined
): string {
  if (!officeAliases?.length) return whereClause;
  params.push(...officeAliases);
  return `${whereClause} AND c.office IN (${officeAliases.map(() => "?").join(", ")})`;
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
    const officeAliases = await this.resolveOfficeAliases(options.scope?.office);

    for (const ftsQuery of ftsQueries) {
      try {
        const rows = await this.runFtsSearch(ftsQuery, limit, options, officeAliases);
        if (rows.length > 0) {
          return this.toRankedResults(rows, query).slice(0, limit);
        }
      } catch {
        continue;
      }
    }

    // Scope relaxation: if a heuristic office scope was set but produced zero
    // matches, retry once without the office filter (keep category/documentId).
    // Office classification is regex-based and can mis-bucket queries; we'd
    // rather return cross-office results than nothing.
    if (options.scope?.office) {
      const { office: _droppedOffice, ...scopeWithoutOffice } = options.scope;
      void _droppedOffice;
      const relaxedOptions: SearchOptions = {
        ...options,
        scope: scopeWithoutOffice
      };
      for (const ftsQuery of ftsQueries) {
        try {
          const rows = await this.runFtsSearch(ftsQuery, limit, relaxedOptions, undefined);
          if (rows.length > 0) {
            return this.toRankedResults(rows, query).slice(0, limit);
          }
        } catch {
          continue;
        }
      }
    }

    return this.fallbackLikeSearch(query, limit, options, officeAliases);
  }

  private async resolveOfficeAliases(office: string | undefined): Promise<string[] | undefined> {
    if (!office) return undefined;

    const aliases = new Set([office]);
    const requested = normalizeOffice(office);
    if (!requested) return Array.from(aliases);

    try {
      const rows = await this.db.getAllAsync<{ office: string }>(
        "SELECT DISTINCT office FROM chunks WHERE office IS NOT NULL AND office != ''"
      );
      for (const row of rows) {
        if (officeNamesMatch(requested, normalizeOffice(row.office))) {
          aliases.add(row.office);
        }
      }
    } catch {
      // Alias expansion is best effort; exact scope and later relaxation remain available.
    }

    return Array.from(aliases);
  }

  private async runFtsSearch(
    ftsQuery: string,
    limit: number,
    options: SearchOptions,
    officeAliases: string[] | undefined
  ): Promise<SearchRow[]> {
    let whereClause = "chunks_fts MATCH ?";
    const params: (string | number)[] = [ftsQuery];

    whereClause = addOfficeScopeClause(whereClause, params, options.scope?.office ? officeAliases : undefined);
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

  private async fallbackLikeSearch(
    query: string,
    limit: number,
    options: SearchOptions,
    officeAliases: string[] | undefined
  ): Promise<SearchResult[]> {
    const tokens = tokenizeQuery(query);
    if (tokens.length === 0) {
      return [];
    }

    // Build a LIKE-OR across up to the first 4 tokens (was: first token only).
    // First-token-only fallback degenerated multi-word queries like
    // "registrar office hours" into "%registrar%" matches over the entire
    // corpus, which threw away the rest of the query's signal.
    const candidateTokens = tokens.slice(0, 4);
    const TOKEN_FIELDS = [
      "lower(c.section_title)",
      "lower(c.process_name)",
      "lower(c.content)",
      "lower(c.answer)",
      "lower(c.citation)",
      "lower(c.category)",
      "lower(c.office)",
      "lower(c.tags)",
      "lower(c.synonyms)"
    ];
    const params: (string | number)[] = [];
    const orClause = candidateTokens
      .map((token) => {
        const pattern = `%${token}%`;
        const clauses = TOKEN_FIELDS.map((field) => {
          params.push(pattern);
          return `${field} LIKE ?`;
        });
        return `(${clauses.join(" OR ")})`;
      })
      .join(" OR ");
    let whereClause = `(${orClause})`;

    whereClause = addOfficeScopeClause(whereClause, params, options.scope?.office ? officeAliases : undefined);
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
    const rowByChunkId = new Map(rows.map((row) => [row.chunk_id, row]));
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
      steps: null,
      prerequisites: null,
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

    const ranked = rankSearchResults(results, query);
    return ranked.map((result, index) => {
      if (index >= 5) {
        return result;
      }

      const row = rowByChunkId.get(result.chunkId);
      return {
        ...result,
        steps: safeStringArrayFromJson(row?.steps ?? null),
        prerequisites: safeStringArrayFromJson(row?.prerequisites ?? null)
      };
    });
  }
}
