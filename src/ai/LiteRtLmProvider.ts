import type {
  LocalAICapabilities,
  LocalAIProvider,
  LocalSummaryResult,
  SafeChatInput,
  SafeChatResult,
  SourceChunkForSummary,
  SummarizeFromSourcesInput
} from "./LocalAIProvider";
import { getDeviceHardwareProfile } from "./deviceHardwareProfile";
import type { LocalModelManifest } from "./localModelMetadata";
import { deviceCapabilityClassForTier } from "./localModelMetadata";
import { getActiveChatModelStatus, withLocalModelInferenceLease } from "./localModelManager";
import { liteRtLmRuntime } from "./nativeRuntimeAdapters";
import { coerceNativeSafeChatResult, coerceNativeSummaryResult } from "./providerUtils";
import { safeInputBudgetTokens, safeOutputTokens } from "./tokenBudget";

const MINIMUM_OS = liteRtLmRuntime.minimumOS;
const DEFAULT_CONTEXT_TOKENS = 2048;

function sourceBlock(sources: SourceChunkForSummary[] | undefined): string {
  if (!sources?.length) return "";
  return [
    "Saved university sources:",
    ...sources.map((source) => {
      const body = source.answer?.trim() || source.content.trim();
      return `[${source.citationId}] ${source.documentTitle}${source.sectionTitle ? ` - ${source.sectionTitle}` : ""}: ${body}`;
    })
  ].join("\n");
}

function filePathFromUri(uri: string): string {
  if (uri.startsWith("file://")) {
    return decodeURIComponent(uri.slice("file://".length));
  }
  return uri;
}

export class LiteRtLmProvider implements LocalAIProvider {
  readonly id = "litert-lm" as const;
  readonly name = "LiteRT-LM";

  private modelLoadTimeMs: number | null = null;
  private lastInferenceTimeMs: number | null = null;

  private platformSupported(): boolean {
    return liteRtLmRuntime.isPlatformSupported();
  }

  private async runtimeAvailable(): Promise<boolean> {
    return liteRtLmRuntime.isRuntimeAvailable("LiteRT-LM runtime check failed");
  }

  private async getActiveLiteRtManifest(): Promise<LocalModelManifest | null> {
    const status = await getActiveChatModelStatus();
    if (status.state !== "available" || status.manifest?.runtimeFormat !== "litert-lm") {
      return null;
    }
    return status.manifest;
  }

  async isAvailable(): Promise<boolean> {
    const [runtimeAvailable, manifest] = await Promise.all([
      this.runtimeAvailable(),
      this.getActiveLiteRtManifest()
    ]);
    return runtimeAvailable && Boolean(manifest);
  }

  async getCapabilities(): Promise<LocalAICapabilities> {
    if (!this.platformSupported()) {
      return liteRtLmRuntime.unavailable(["LiteRT-LM is enabled for Android preview builds first."]);
    }

    const nativeModule = liteRtLmRuntime.getModule();
    if (!nativeModule) {
      return liteRtLmRuntime.unavailable([
        "HakiLiteRtLm native module is not installed.",
        "Gemma 4 LiteRT-LM downloads stay hidden until the native LiteRT-LM bridge is available."
      ]);
    }

    const [runtimeAvailable, manifest, hardware] = await Promise.all([
      this.runtimeAvailable(),
      this.getActiveLiteRtManifest(),
      getDeviceHardwareProfile(["litert-lm:Android LiteRT-LM"])
    ]);
    const modelAssetsAvailable = Boolean(manifest);
    const summary = runtimeAvailable && modelAssetsAvailable && Boolean(nativeModule.summarizeFromSources);
    const safeChat = runtimeAvailable && modelAssetsAvailable && Boolean(nativeModule.answerSafeChat);
    const unavailableReasons = [
      ...(runtimeAvailable ? [] : ["LiteRT-LM native runtime is unavailable. Rebuild the preview app after adding the LiteRT-LM dependency."]),
      ...(modelAssetsAvailable ? [] : ["No active Gemma LiteRT-LM model is selected. Download Gemma 4 E2B/E4B, then activate it from AI Models."])
    ];
    const maxContextTokens = manifest?.runtimeFormat === "litert-lm" ? DEFAULT_CONTEXT_TOKENS : null;
    const maxOutputTokens = maxContextTokens ? safeOutputTokens(maxContextTokens, "safe-chat") : null;

    return {
      summary,
      safeChat,
      embeddings: false,
      reranking: false,
      providerReady: summary || safeChat,
      requiresCustomDevBuild: true,
      minimumOS: MINIMUM_OS,
      modelAssetsAvailable,
      modelName: manifest?.modelName ?? null,
      modelParameterCountB: manifest?.modelParameterCountB ?? null,
      modelQuantization: manifest?.modelQuantization ?? "litert-lm",
      runtimeFormat: "litert-lm",
      modelTier: manifest?.modelTier ?? "unknown",
      recommendedModelTier: manifest?.recommendedModelTier ?? "unknown",
      bridgePresent: runtimeAvailable,
      modelAssetPath: manifest?.uri ?? null,
      modelManifestPath: manifest?.manifestPath ?? null,
      modelImportStatus: runtimeAvailable ? (modelAssetsAvailable ? "available" : "missing") : "runtime_unavailable",
      modelFileHash: manifest?.fileHash ?? null,
      modelRejectionReasons: manifest?.rejectionReasons ?? [],
      modelLoadTimeMs: this.modelLoadTimeMs,
      lastInferenceTimeMs: this.lastInferenceTimeMs,
      contextWindowTokens: maxContextTokens,
      safeInputBudgetTokens: maxContextTokens && maxOutputTokens ? safeInputBudgetTokens(maxContextTokens, maxOutputTokens) : null,
      maxOutputTokens,
      streamingSupported: false,
      executionBackend: "litert-lm",
      availableBackends: runtimeAvailable ? ["litert-lm:cpu"] : [],
      accelerationStatus: runtimeAvailable ? "selected" : "unavailable",
      performanceProfile: null,
      thermalState: hardware.thermalState ?? "unknown",
      approximateDeviceCapability: manifest ? deviceCapabilityClassForTier(manifest.modelTier) : "unknown",
      architecture: hardware.architecture,
      freeStorageGB: hardware.freeStorageGB,
      memoryGB: hardware.memoryGB,
      memoryClass: hardware.memoryClass,
      unavailableReasons,
      notes: [
        "LiteRT-LM provider for Gemma 4 .litertlm artifacts.",
        "Text generation is enabled first; multimodal use remains disabled until a separate safety and UI pass."
      ]
    };
  }

  async summarizeFromSources(input: SummarizeFromSourcesInput): Promise<LocalSummaryResult> {
    return withLocalModelInferenceLease(async () => {
      const nativeModule = liteRtLmRuntime.getModule();
      const manifest = await this.getActiveLiteRtManifest();
      if (!nativeModule?.summarizeFromSources || !manifest) {
        throw new Error("LiteRT-LM summarization is unavailable because no active Gemma artifact is selected.");
      }

      const nativeResult = await nativeModule.summarizeFromSources({
        ...input,
        modelPath: filePathFromUri(manifest.uri),
        instruction: `${input.instruction}\n\nUse only these sources. End with a SOURCE_IDS line containing only the cited source IDs.`,
        sources: input.sources
      });
      return coerceNativeSummaryResult(nativeResult, input, this.id, this.name);
    });
  }

  async answerSafeChat(input: SafeChatInput): Promise<SafeChatResult> {
    return withLocalModelInferenceLease(async () => {
      const nativeModule = liteRtLmRuntime.getModule();
      const manifest = await this.getActiveLiteRtManifest();
      if (!nativeModule?.answerSafeChat || !manifest) {
        throw new Error("LiteRT-LM safe chat is unavailable because no active Gemma artifact is selected.");
      }

      const startedAt = Date.now();
      const nativeResult = await nativeModule.answerSafeChat({
        ...input,
        modelPath: filePathFromUri(manifest.uri),
        taskContext: [
          input.taskContext,
          sourceBlock(input.sourceContext),
          input.sourceContext?.length
            ? "If using saved sources, end with a SOURCE_IDS line containing only the cited source IDs."
            : ""
        ].filter(Boolean).join("\n\n")
      });
      this.lastInferenceTimeMs = Date.now() - startedAt;
      return coerceNativeSafeChatResult(nativeResult, this.id, this.name);
    });
  }

  async streamSafeChat(input: SafeChatInput, onToken: (token: string) => void): Promise<SafeChatResult> {
    const nativeModule = liteRtLmRuntime.getModule();
    const streamSafeChat = nativeModule?.streamSafeChat;
    if (!streamSafeChat) {
      return this.answerSafeChat(input);
    }

    return withLocalModelInferenceLease(async () => {
      const manifest = await this.getActiveLiteRtManifest();
      if (!manifest) {
        throw new Error("LiteRT-LM streaming is unavailable because no active Gemma artifact is selected.");
      }
      const nativeResult = await streamSafeChat({
        ...input,
        modelPath: filePathFromUri(manifest.uri)
      }, onToken);
      return coerceNativeSafeChatResult(nativeResult, this.id, this.name);
    });
  }

  async prewarm(): Promise<void> {
    const nativeModule = liteRtLmRuntime.getModule();
    const manifest = await this.getActiveLiteRtManifest();
    if (!nativeModule?.getCapabilities || !manifest) return;
    const startedAt = Date.now();
    await nativeModule.getCapabilities().catch(() => undefined);
    this.modelLoadTimeMs ??= Date.now() - startedAt;
  }

  async dispose(): Promise<void> {
    await liteRtLmRuntime.release();
  }
}
