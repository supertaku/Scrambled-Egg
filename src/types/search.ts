import type { AnswerProvenance, DeviceAIMode } from "@/ai/DeviceAIMode";

export type ConfidenceLevel = "high" | "medium" | "low";
export type SearchResponseType =
  | "general_advice"
  | "image_generation"
  | "instruction"
  | "refusal"
  | "safe_local_chat"
  | "source"
  | "summary";
export type ChatContextSender = "user" | "haki";

export interface ChatContextTurn {
  sender: ChatContextSender;
  text: string;
}

export interface SearchOptions {
  limit?: number;
  conversationContext?: ChatContextTurn[];
  onToken?: (token: string) => void;
  scope?: {
    office?: string;
    category?: string;
    documentId?: string;
  };
}

export interface SearchResult {
  id: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentType: string | null;
  sectionTitle: string | null;
  processName: string | null;
  content: string;
  answer: string | null;
  citation: string | null;
  pageNumber: number | null;
  category: string | null;
  office: string | null;
  tags: string[];
  lastUpdated: string | null;
  synonyms: string[];
  steps: string[] | null;
  prerequisites: string[] | null;
  officeLocation: string | null;
  contactInfo: string | null;
  priority: number;
  snippet: string | null;
  contentHighlight: string | null;
  bm25Score: number;
  rankScore: number;
  confidence: ConfidenceLevel;
  confidenceScore?: number;
}

export interface SearchResponse {
  question: string;
  normalizedQuestion?: string;
  responseType?: SearchResponseType;
  results: SearchResult[];
  confidence: ConfidenceLevel;
  reliable: boolean;
  topResult?: SearchResult;
  answerText?: string;
  citationsUsed: string[];
  provenance: AnswerProvenance;
  activeMode: DeviceAIMode;
  verificationNote?: string;
}
