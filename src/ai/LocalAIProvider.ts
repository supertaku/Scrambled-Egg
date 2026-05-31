import type { ChatContextTurn, ChatRole, ConfidenceLevel } from "@/types/search";

export type LocalAIProviderId = "fallback" | "llama-rn" | "apple-foundation-models";

export type DeviceCapabilityClass = "unknown" | "low" | "standard" | "high";

export type LocalExecutionBackend = "cpu" | "metal" | "opencl" | "htp" | "apple-foundation-models" | "unknown";

export type AccelerationStatus = "not_checked" | "benchmarking" | "selected" | "fallback" | "unavailable";

export type DeviceThermalState = "nominal" | "fair" | "serious" | "critical" | "unknown";

export interface LocalModelPerformanceProfile {
  version: 1;
  modelKey: string;
  executionBackend: LocalExecutionBackend;
  accelerationStatus: AccelerationStatus;
  availableBackends: string[];
  loadTimeMs: number | null;
  firstTokenTimeMs: number | null;
  decodeTokensPerSecond: number | null;
  thermalStateBefore: DeviceThermalState;
  thermalStateAfter: DeviceThermalState;
  benchmarkedAt: string;
  failureReason: string | null;
}

export type LocalModelTier =
  | "unknown"
  | "tiny"
  | "minimum"
  | "good"
  | "enhanced"
  | "flagship"
  | "apple-intelligence";

export interface LocalAICapabilities {
  summary: boolean;
  safeChat: boolean;
  embeddings: boolean;
  reranking: boolean;
  providerReady: boolean;
  requiresCustomDevBuild: boolean;
  minimumOS: string | null;
  modelAssetsAvailable: boolean | null;
  modelName?: string | null;
  /** Stable identity for the embedding model, separate from the active chat model. */
  embeddingModelName?: string | null;
  embeddingModelFileHash?: string | null;
  embeddingDimension?: number | null;
  modelParameterCountB?: number | null;
  modelQuantization?: string | null;
  modelTier?: LocalModelTier;
  recommendedModelTier?: LocalModelTier;
  bridgePresent?: boolean;
  modelAssetPath?: string | null;
  modelManifestPath?: string | null;
  modelImportStatus?: "missing" | "available" | "rejected" | "runtime_unavailable";
  modelFileHash?: string | null;
  modelRejectionReasons?: string[];
  modelLoadTimeMs?: number | null;
  lastInferenceTimeMs?: number | null;
  contextWindowTokens?: number | null;
  safeInputBudgetTokens?: number | null;
  maxOutputTokens?: number | null;
  streamingSupported?: boolean;
  executionBackend?: LocalExecutionBackend;
  availableBackends?: string[];
  accelerationStatus?: AccelerationStatus;
  performanceProfile?: LocalModelPerformanceProfile | null;
  thermalState?: DeviceThermalState;
  approximateDeviceCapability: DeviceCapabilityClass;
  architecture?: string | null;
  freeStorageGB?: number | null;
  memoryGB?: number | null;
  memoryClass: string | null;
  unavailableReasons: string[];
  notes: string[];
}

export interface SourceChunkForSummary {
  citationId: string;
  chunkId: string;
  documentTitle: string;
  sectionTitle: string | null;
  processName: string | null;
  content: string;
  answer: string | null;
  citation: string | null;
  pageNumber: number | null;
  category: string | null;
  office: string | null;
  lastUpdated: string | null;
}

export interface SummarizeFromSourcesInput {
  question: string;
  instruction: string;
  preferredModelTier?: LocalModelTier;
  sources: SourceChunkForSummary[];
}

export type LocalSummaryStatus = "ok" | "no_reliable_answer";

export interface LocalSummaryResult {
  status: LocalSummaryStatus;
  text: string;
  citationIds: string[];
  providerId: LocalAIProviderId;
  providerName: string;
}

export interface SafeChatInput {
  question: string;
  chatRole?: ChatRole;
  instruction: string;
  preferredModelTier?: LocalModelTier;
  appContext: string;
  conversationContext?: ChatContextTurn[];
  profileContext?: string;
  sourceContext?: SourceChunkForSummary[];
  sourceConfidence?: ConfidenceLevel;
  sourceReliable?: boolean;
  taskContext?: string;
  /** Used by providers to select scenario-tuned sampling parameters. */
  scenario?: string;
  /** Used by providers to inject chain-of-thought or format hints. */
  capability?: string;
  /** When set, native runtimes should stop ongoing inference (best-effort). */
  abortSignal?: AbortSignal;
}

export type SafeChatStatus = "input_too_large" | "ok" | "refused" | "incomplete";

export interface LocalContextUsage {
  contextFillRatio: number;
  conversationTokens: number;
  historyPruned: boolean;
  inputBudgetTokens: number;
  maxContextTokens: number;
  modelTier?: LocalModelTier;
  outputBudgetTokens: number;
  sourceTokens: number;
  sourcesPruned: boolean;
  totalInputTokens: number;
}

export interface SafeChatResult {
  status: SafeChatStatus;
  text: string;
  citationIds?: string[];
  contextUsage?: LocalContextUsage;
  providerId: LocalAIProviderId;
  providerName: string;
}

export interface LocalAIProvider {
  id: LocalAIProviderId;
  name: string;
  isAvailable(): Promise<boolean>;
  getCapabilities(): Promise<LocalAICapabilities>;
  summarizeFromSources(input: SummarizeFromSourcesInput): Promise<LocalSummaryResult>;
  answerSafeChat?(input: SafeChatInput): Promise<SafeChatResult>;
  streamSafeChat?(input: SafeChatInput, onToken: (token: string) => void): Promise<SafeChatResult>;
  embedText?(text: string): Promise<number[]>;
  /**
   * Best-effort eager initialization. Called by the chat screen on mount so
   * the first user message doesn't pay the model-load cost. Implementations
   * MUST be idempotent and safe to call concurrently with real requests.
   */
  prewarm?(): Promise<void>;
  dispose?(): Promise<void>;
}

export function unavailableCapabilities(notes: string[], minimumOS: string | null): LocalAICapabilities {
  return {
    summary: false,
    safeChat: false,
    embeddings: false,
    reranking: false,
    providerReady: false,
    requiresCustomDevBuild: true,
    minimumOS,
    modelAssetsAvailable: null,
    bridgePresent: false,
    modelAssetPath: null,
    modelManifestPath: null,
    modelImportStatus: "missing",
    modelFileHash: null,
    embeddingModelName: null,
    embeddingModelFileHash: null,
    embeddingDimension: null,
    modelRejectionReasons: notes,
    modelLoadTimeMs: null,
    lastInferenceTimeMs: null,
    contextWindowTokens: null,
    safeInputBudgetTokens: null,
    maxOutputTokens: null,
    streamingSupported: false,
    executionBackend: "unknown",
    availableBackends: [],
    accelerationStatus: "unavailable",
    performanceProfile: null,
    thermalState: "unknown",
    approximateDeviceCapability: "unknown",
    memoryClass: null,
    unavailableReasons: notes,
    notes
  };
}
