export interface DocumentChunkInput {
  chunk_id: string;
  section_title?: string | undefined;
  process_name?: string | undefined;
  content: string;
  answer?: string | undefined;
  citation?: string | undefined;
  page_number?: number | undefined;
  tags?: string[] | undefined;
  synonyms?: string[] | undefined;
  steps?: string[] | undefined;
  prerequisites?: string[] | undefined;
  office_location?: string | undefined;
  contact_info?: string | undefined;
  priority?: number | undefined;
}

export interface StructuredDocument {
  document_id: string;
  document_title: string;
  document_type?: string | undefined;
  category?: string | undefined;
  office?: string | undefined;
  version?: string | undefined;
  last_updated?: string | undefined;
  authored_by?: string | undefined;
  source_url?: string | undefined;
  chunks: DocumentChunkInput[];
}

export interface DocumentSummary {
  id: number;
  documentId: string;
  documentTitle: string;
  documentType: string | null;
  category: string | null;
  office: string | null;
  version: string | null;
  lastUpdated: string | null;
  chunkCount: number;
}

export interface ImportPreview {
  documentCount: number;
  chunkCount: number;
  documents: Array<{
    documentId: string;
    documentTitle: string;
    chunkCount: number;
  }>;
}

export interface ImportResult {
  insertedDocuments: number;
  skippedDocuments: number;
  insertedChunks: number;
  skippedChunks: number;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; documents: StructuredDocument[]; preview: ImportPreview }
  | { ok: false; issues: ValidationIssue[] };
