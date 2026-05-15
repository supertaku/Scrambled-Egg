/**
 * Flattened, searchable topic index derived from seed-documents.json.
 * Each entry represents one chunk (procedure / policy section) that can be
 * displayed on its own detail page.
 */

import rawDocuments from "@/data/seed-documents.json";

export interface LibraryTopic {
  chunkId: string;
  sectionTitle: string;
  processName: string;
  category: string;
  documentId: string;
  documentTitle: string;
  documentType: string;
  office: string;
  officeLocation: string;
  contactInfo: string;
  content: string;
  steps: string[];
  answer: string;
  tags: string[];
  lastUpdated: string;
}

interface RawChunk {
  chunk_id: string;
  section_title: string;
  process_name?: string;
  content: string;
  steps?: string[];
  answer?: string;
  citation?: string;
  office_location?: string;
  contact_info?: string;
  tags?: string[];
}

interface RawDocument {
  document_id: string;
  document_title: string;
  document_type: string;
  category: string;
  office?: string;
  last_updated?: string;
  chunks: RawChunk[];
}

const documents = rawDocuments as RawDocument[];

// Build flat topic list once at module load
export const libraryTopics: LibraryTopic[] = documents.flatMap((doc) =>
  doc.chunks.map((chunk) => ({
    chunkId: chunk.chunk_id,
    sectionTitle: chunk.section_title,
    processName: chunk.process_name ?? chunk.section_title,
    category: doc.category,
    documentId: doc.document_id,
    documentTitle: doc.document_title,
    documentType: doc.document_type,
    office: doc.office ?? "",
    officeLocation: chunk.office_location ?? "",
    contactInfo: chunk.contact_info ?? "",
    content: chunk.content,
    steps: chunk.steps ?? [],
    answer: chunk.answer ?? "",
    tags: chunk.tags ?? [],
    lastUpdated: doc.last_updated ?? ""
  }))
);

// O(1) lookup by chunkId
const topicMap = new Map<string, LibraryTopic>(
  libraryTopics.map((t) => [t.chunkId, t])
);

export function getTopicById(chunkId: string): LibraryTopic | undefined {
  return topicMap.get(chunkId);
}

// Grouping helpers
export function getCategories(): string[] {
  return [...new Set(libraryTopics.map((t) => t.category))];
}

export function getTopicsByCategory(category: string): LibraryTopic[] {
  return libraryTopics.filter((t) => t.category === category);
}

// Search across all text fields
export function searchTopics(query: string): LibraryTopic[] {
  const q = query.trim().toLowerCase();
  if (!q) return libraryTopics;
  return libraryTopics.filter((t) =>
    [
      t.sectionTitle,
      t.processName,
      t.category,
      t.documentTitle,
      t.office,
      t.officeLocation,
      t.content,
      t.answer,
      ...t.steps,
      ...t.tags
    ].some((field) => field.toLowerCase().includes(q))
  );
}
