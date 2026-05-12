import type { SQLiteDatabase } from "expo-sqlite";

import type { LocalAIProvider } from "@/ai/LocalAIProvider";
import type { SearchOptions, SearchResult } from "@/types/search";

import { safeStringArrayFromJson } from "./FTSRetriever";
import type { Retriever } from "./Retriever";
import { rankSearchResults } from "./ranking";

/**
 * Scaling roadmap: this retriever scans up to MAX_VECTOR_CANDIDATES rows and scores cosine
 * similarity in memory. When chunk counts or latency exceed product thresholds, swap this
 * implementation for ANN-backed storage (for example sqlite-vec or another SQLite extension)
 * while keeping the Retriever interface and HybridRetriever fusion unchanged.
 */

interface VectorSearchRow {
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
  model_name: string;
  embedding: unknown;
  dimension: number | null;
}

const MIN_VECTOR_SIMILARITY = 0.62;
const MAX_VECTOR_CANDIDATES = 512;

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

function officeMatches(actual: string | null, requested: string | undefined): boolean {
  if (!requested) return true;
  const left = normalizeOffice(actual);
  const right = normalizeOffice(requested);
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm <= 0) return [];
  return vector.map((value) => value / norm);
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += (left[index] ?? 0) * (right[index] ?? 0);
  }
  return dot;
}

function decodeEmbedding(value: unknown, expectedDimension: number): number[] | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    const numeric = value.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
    return numeric.length === expectedDimension ? numeric : null;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return decodeEmbedding(parsed, expectedDimension);
      }
    } catch {
      return null;
    }
  }

  const bytes =
    value instanceof Uint8Array
      ? value
      : value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : ArrayBuffer.isView(value)
          ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
          : null;

  if (!bytes || bytes.byteLength !== expectedDimension * Float32Array.BYTES_PER_ELEMENT) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const vector: number[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += Float32Array.BYTES_PER_ELEMENT) {
    const valueAtOffset = view.getFloat32(offset, true);
    if (!Number.isFinite(valueAtOffset)) return null;
    vector.push(valueAtOffset);
  }

  return vector;
}

function providerModelNames(provider: LocalAIProvider, modelName: string | null | undefined): string[] {
  return Array.from(new Set([provider.id, provider.name, modelName].filter((item): item is string => Boolean(item?.trim()))));
}

export class VectorRetriever implements Retriever {
  constructor(
    private readonly db: SQLiteDatabase,
    private readonly embeddingProvider: LocalAIProvider | null = null
  ) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.embeddingProvider?.embedText) {
      return [];
    }

    const queryEmbedding = normalizeVector(await this.embeddingProvider.embedText(query));
    if (queryEmbedding.length === 0) {
      return [];
    }

    const capabilities = await this.embeddingProvider.getCapabilities();
    const rows = await this.loadCandidateRows(
      providerModelNames(this.embeddingProvider, capabilities.modelName),
      queryEmbedding.length,
      options
    );
    const limit = options.limit ?? 8;

    const scored = rows
      .map((row) => {
        const embedding = decodeEmbedding(row.embedding, queryEmbedding.length);
        if (!embedding) return null;

        const semanticScore = cosineSimilarity(queryEmbedding, normalizeVector(embedding));
        if (semanticScore < MIN_VECTOR_SIMILARITY) return null;

        return this.toSearchResult(row, semanticScore);
      })
      .filter((result): result is SearchResult => Boolean(result))
      .sort((a, b) => (b.semanticScore ?? 0) - (a.semanticScore ?? 0))
      .slice(0, Math.max(limit * 2, limit));

    return rankSearchResults(scored, query).slice(0, limit);
  }

  private async loadCandidateRows(
    modelNames: string[],
    dimension: number,
    options: SearchOptions
  ): Promise<VectorSearchRow[]> {
    let whereClause = "ce.embedding IS NOT NULL AND ce.dimension = ?";
    const params: (string | number)[] = [dimension];

    if (modelNames.length > 0) {
      whereClause += ` AND ce.model_name IN (${modelNames.map(() => "?").join(", ")})`;
      params.push(...modelNames);
    }
    if (options.scope?.category) {
      whereClause += " AND c.category = ?";
      params.push(options.scope.category);
    }
    if (options.scope?.documentId) {
      whereClause += " AND c.document_id = ?";
      params.push(options.scope.documentId);
    }

    params.push(MAX_VECTOR_CANDIDATES);

    const rows = await this.db.getAllAsync<VectorSearchRow>(
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
        ce.model_name,
        ce.embedding,
        ce.dimension
      FROM chunk_embeddings ce
      JOIN chunks c ON c.chunk_id = ce.chunk_id
      JOIN documents d ON d.document_id = c.document_id
      WHERE ${whereClause}
      LIMIT ?
      `,
      params
    );

    return options.scope?.office ? rows.filter((row) => officeMatches(row.office, options.scope?.office)) : rows;
  }

  private toSearchResult(row: VectorSearchRow, semanticScore: number): SearchResult {
    return {
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
      snippet: null,
      contentHighlight: null,
      bm25Score: 0,
      rankScore: Number((semanticScore * 10).toFixed(3)),
      semanticScore: Number(semanticScore.toFixed(6)),
      confidence: "low"
    };
  }
}
