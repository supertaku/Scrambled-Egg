import type { AnswerProvenance, DeviceAIMode } from "@/ai/DeviceAIMode";
import type { StudentQuestionIntent } from "@/services/studentChatTypes";

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

export interface ConversationState {
  activeEntity?: string;
  currentTopic?: string;
  lastSourceScope?: {
    office?: string;
    category?: string;
    documentId?: string;
  };
  unresolvedQuestion?: string;
  userGoal?: string;
}

export interface SearchOptions {
  limit?: number;
  conversationContext?: ChatContextTurn[];
  conversationState?: ConversationState;
  onToken?: (token: string) => void;
  profileContext?: string | undefined;
  scope?: {
    office?: string;
    category?: string;
    documentId?: string;
  };
  /**
   * Precomputed intent. When provided, the router will use this instead of
   * re-classifying the question. Saves one regex pass and keeps the hook's
   * conversation state aligned with the router's intent decisions.
   */
  intent?: StudentQuestionIntent;
  /**
   * When true, the router skips retrieval and any deterministic scenario
   * shortcuts, and routes straight to the chat provider. Used by the chat
   * hook's continuation loop so a "Continue the previous answer..." prompt
   * doesn't waste a full FTS + ranking + confidence pass.
   */
  continuation?: boolean;
  /**
   * When aborted, local providers should stop generation and the caller should
   * treat the request as cancelled (new message, navigation, etc.).
   */
  abortSignal?: AbortSignal;
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
  semanticScore?: number;
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
  isIncomplete?: boolean;
}
