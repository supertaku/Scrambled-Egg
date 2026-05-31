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

const pendingServiceDeskTopics: LibraryTopic[] = [
  {
    chunkId: "placeholder_student_insurance_policy",
    sectionTitle: "Student Insurance Policy",
    processName: "Student Insurance Policy",
    category: "Offices",
    documentId: "placeholder_student_insurance_policy",
    documentTitle: "Provisional Student Insurance Policy Card",
    documentType: "placeholder",
    office: "To be confirmed",
    officeLocation: "To be confirmed",
    contactInfo: "",
    content:
      "Provisional information for scenario testing only. Draft insurance amount: PHP 25. Example incident scope supplied for this draft: scratches from animals. Eligibility, distance from the university, claim procedure, responsible office, exclusions, and final coverage are to be confirmed.",
    steps: [
      "Insurance amount: PHP 25 (provisional draft value).",
      "Example incident scope: scratches from animals (provisional draft example).",
      "Distance requirement for eligibility: To be confirmed.",
      "Claim period and required evidence: To be confirmed.",
      "Processing office, exclusions, and emergency guidance: To be confirmed."
    ],
    answer: "",
    tags: ["insurance", "student insurance", "placeholder", "pending confirmation"],
    lastUpdated: "Pending confirmation",
    verificationStatus: "pending"
  },
  {
    chunkId: "placeholder_motor_parking",
    sectionTitle: "Motor Parking",
    processName: "Motor Parking",
    category: "Offices",
    documentId: "placeholder_motor_parking",
    documentTitle: "Provisional Motor Parking Card",
    documentType: "placeholder",
    office: "To be confirmed",
    officeLocation: "To be confirmed",
    contactInfo: "",
    content:
      "Provisional placeholder for a university motor-parking service. Eligibility, registration documents, sticker or permit fee, parking areas, access hours, enforcement rules, replacement process, and responsible office are to be confirmed.",
    steps: [
      "Eligible students and vehicles: To be confirmed.",
      "Registration documents and permit or sticker fee: To be confirmed.",
      "Approved parking areas and operating hours: To be confirmed.",
      "Violations, lost-sticker process, and responsible office: To be confirmed."
    ],
    answer: "",
    tags: ["parking", "motor parking", "sticker", "placeholder", "pending confirmation"],
    lastUpdated: "Pending confirmation",
    verificationStatus: "pending"
  }
];

// Pending placeholders are shown in Service Desk only. Retrieval continues to
// seed exclusively from seed-documents.json, which contains verified content.
const includePendingServiceDeskTopics = typeof __DEV__ !== "undefined" && __DEV__;
export const libraryTopics: LibraryTopic[] = includePendingServiceDeskTopics
  ? [...verifiedLibraryTopics, ...pendingServiceDeskTopics]
  : verifiedLibraryTopics;

// O(1) lookup by chunkId
const topicMap = new Map<string, LibraryTopic>(
  libraryTopics.map((t) => [t.chunkId, t])
);

export function getTopicById(chunkId: string): LibraryTopic | undefined {
  return topicMap.get(chunkId);
}

// Grouping helpers
export function getCategories(): string[] {
  return [...new Set([...libraryTopics.map((t) => t.category), "Offices"])];
}

export function getTopicsByCategory(category: string): LibraryTopic[] {
  return libraryTopics.filter((t) => topicMatchesCategory(t, category));
}

export function topicMatchesCategory(topic: LibraryTopic, category: string): boolean {
  if (category === "Offices") {
    return Boolean(topic.office || topic.officeLocation || topic.category === "Offices");
  }
  return topic.category === category;
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
