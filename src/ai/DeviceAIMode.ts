import type { LocalAICapabilities, LocalAIProviderId } from "./LocalAIProvider";

export type DeviceAIModeId =
  | "fts5-only"
  | "semantic-search"
  | "local-safe-chat"
  | "local-summary"
  | "hybrid-local-ai"
  | "fallback-fts5-only";

export type RetrieverStrategy = "fts5" | "semantic" | "hybrid";

export type AnswerProvenance =
  | "Retrieved directly from source"
  | "Locally summarized with llama.rn"
  | "Locally summarized with Apple Intelligence"
  | "Locally summarized with LiteRT-LM"
  | "Locally summarized with ONNX GenAI"
  | "Answered with local safe chat"
  | "Answered with safe student guidance"
  | "General chat unavailable without local AI"
  | "No reliable saved source found"
  | "Retrieved with semantic search"
  | "Retrieved with hybrid search";

export interface DeviceAIMode {
  id: DeviceAIModeId;
  label: string;
  provenance: AnswerProvenance;
  retrieverStrategy: RetrieverStrategy;
  summaryProviderId: LocalAIProviderId | null;
  summaryProviderName: string | null;
  embeddingProviderId: LocalAIProviderId | null;
  embeddingProviderName: string | null;
  capabilities: LocalAICapabilities;
  platform: string;
  platformVersion: string;
  detectedAt: string;
  fallbackReason: string | null;
}

export const SOURCE_SEARCH_LABEL = "Offline Mode: Source Search";
export const SEMANTIC_SEARCH_LABEL = "Offline AI Mode: Semantic Search Available";
export const LOCAL_SAFE_CHAT_LABEL = "Offline AI Mode: Local Safe Chat Available";
export const LOCAL_SUMMARY_LABEL = "Offline AI Mode: Local Summary Available";
export const HYBRID_LOCAL_AI_LABEL = "Offline AI Mode: Hybrid Local AI";
export const FALLBACK_SEARCH_LABEL = "Fallback Mode: Source Search Only";

export function provenanceForSummaryProvider(providerId: LocalAIProviderId | null): AnswerProvenance {
  if (providerId === "apple-foundation-models") {
    return "Locally summarized with Apple Intelligence";
  }

  if (providerId === "llama-rn") {
    return "Locally summarized with llama.rn";
  }

  if (providerId === "litert-lm") {
    return "Locally summarized with LiteRT-LM";
  }

  if (providerId === "onnx-genai") {
    return "Locally summarized with ONNX GenAI";
  }

  return "Retrieved directly from source";
}
