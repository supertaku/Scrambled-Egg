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
  verificationStatus: "pending" | "verified";
}

export type ServiceDeskCounter = "Offices" | "Safety" | "Campus Guidelines" | "Map Directory";

export interface OfficeFilter {
  key: string;
  label: string;
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
const SERVICE_DESK_COUNTERS: ServiceDeskCounter[] = ["Offices", "Safety", "Campus Guidelines", "Map Directory"];
const BASE_OFFICE_FILTERS = [
  "All",
  "OSA",
  "Registrar",
  "Medical Clinic",
  "Dental Clinic",
  "Guidance",
  "Public Assistance / QA",
  "Security / Admin"
] as const;

// Build flat topic list once at module load
const verifiedLibraryTopics: LibraryTopic[] = documents.flatMap((doc) =>
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
    lastUpdated: doc.last_updated ?? "",
    verificationStatus: "verified"
  }))
);

export const libraryTopics: LibraryTopic[] = verifiedLibraryTopics;

// O(1) lookup by chunkId
const topicMap = new Map<string, LibraryTopic>(
  libraryTopics.map((t) => [t.chunkId, t])
);

export function getTopicById(chunkId: string): LibraryTopic | undefined {
  return topicMap.get(chunkId);
}

// Grouping helpers
export function getCategories(): string[] {
  return getServiceDeskCounters();
}

export function getServiceDeskCounters(): ServiceDeskCounter[] {
  return [...SERVICE_DESK_COUNTERS];
}

export function getTopicsByCategory(category: string): LibraryTopic[] {
  return libraryTopics.filter((t) => topicMatchesCategory(t, category));
}

export function topicMatchesCategory(topic: LibraryTopic, category: string): boolean {
  if ((SERVICE_DESK_COUNTERS as readonly string[]).includes(category)) {
    return serviceDeskCounterForTopic(topic) === category;
  }
  return topic.category === category;
}

export function serviceDeskCounterForTopic(topic: LibraryTopic): ServiceDeskCounter {
  switch (topic.category) {
    case "Campus Safety":
      return "Safety";
    case "Campus Guidelines":
      return "Campus Guidelines";
    case "Campus Locations":
      return "Map Directory";
    default:
      return "Offices";
  }
}

function searchableOfficeText(topic: LibraryTopic): string {
  return [
    topic.sectionTitle,
    topic.processName,
    topic.documentTitle,
    topic.office,
    topic.officeLocation,
    topic.content,
    topic.answer,
    ...topic.tags
  ].join(" ").toLowerCase();
}

export function officeLabelsForTopic(topic: LibraryTopic): string[] {
  const haystack = searchableOfficeText(topic);
  const labels = new Set<string>();
  const dentalMatch = /\bdental\b|campus dental clinic/.test(haystack);

  if (dentalMatch) labels.add("Dental Clinic");
  if (
    /\bmedical\b|health services|health assessment|first aid|teleconsult/.test(haystack) ||
    (!dentalMatch && /\bclinic\b/.test(haystack))
  ) {
    labels.add("Medical Clinic");
  }
  if (/guidance|counselling|counseling/.test(haystack)) labels.add("Guidance");
  if (/office of (the )?student affairs|\bosa\b|student affairs/.test(haystack)) labels.add("OSA");
  if (/registrar/.test(haystack)) labels.add("Registrar");
  if (/quality assurance|public assistance|customer feedback|complaints desk|complaint/.test(haystack)) {
    labels.add("Public Assistance / QA");
  }
  if (/security|admin building|administrative|\badmin\b/.test(haystack)) labels.add("Security / Admin");

  if (labels.size === 0) {
    const fallback = (topic.office || topic.officeLocation).trim().replace(/\s+/g, " ");
    if (fallback) labels.add(fallback);
  }

  return [...labels];
}

export function getOfficeFilters(_topics: LibraryTopic[] = getTopicsByCategory("Offices")): OfficeFilter[] {
  return BASE_OFFICE_FILTERS.map((label) => ({ key: label, label }));
}

export function topicMatchesOfficeFilter(topic: LibraryTopic, filter: string): boolean {
  return filter === "All" || officeLabelsForTopic(topic).includes(filter);
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
