import type { SearchResponse, SearchResult } from "./search";

export type ChatSender = "user" | "haki";
export type ChatMessageStatus = "failed" | "sending" | "sent";
export type ChatFeedbackRating = "helpful" | "wrong";

export interface ChatFeedbackSourceSnapshot {
  category: string | null;
  chunkId: string;
  citation: string | null;
  documentId: string;
  documentTitle: string;
  lastUpdated: string | null;
  office: string | null;
  processName: string | null;
  sectionTitle: string | null;
}

export interface ChatFeedbackEntry {
  answer: string;
  citationsUsed: string[];
  confidence?: SearchResponse["confidence"];
  createdAt: string;
  messageId: string;
  modeId?: string;
  modeLabel?: string;
  modelTier?: string | null;
  provenance?: SearchResponse["provenance"];
  question: string;
  rating: ChatFeedbackRating;
  reliable?: boolean;
  responseType?: SearchResponse["responseType"];
  sources: ChatFeedbackSourceSnapshot[];
}

export interface ChatMessage {
  feedbackRating?: ChatFeedbackRating;
  id: string;
  question?: string;
  response?: SearchResponse;
  result?: SearchResult;
  sender: ChatSender;
  status?: ChatMessageStatus;
  text: string;
}
