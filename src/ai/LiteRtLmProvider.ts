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
import { createLiteRtGenerationGuard } from "./liteRtGenerationGuard";
import type { LocalModelManifest } from "./localModelMetadata";
import { deviceCapabilityClassForTier } from "./localModelMetadata";
import { getActiveChatModelStatus, withLocalModelInferenceLease } from "./localModelManager";
import { liteRtLmRuntime } from "./nativeRuntimeAdapters";
import { coerceNativeSafeChatResult, coerceNativeSummaryResult } from "./providerUtils";
import { safeInputBudgetTokens, safeOutputTokens } from "./tokenBudget";

const LITERT_GENERATION_DEADLINE_MS = 120_000;
let nextRequestSequence = 0;

function nextRequestId(): string {
  nextRequestSequence += 1;
  return `litert-${Date.now()}-${nextRequestSequence}`;
}

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
  return uri.startsWith("file://") ? decodeURIComponent(uri.slice("file://".length)) : uri;
}

export class LiteRtLmProvider implements LocalAIProvider {
  readonly id = "litert-lm" as const;
  readonly name = "LiteRT-LM";

  private modelLoadTimeMs: number | null = null;
  private lastInferenceTimeMs: number | null = null;
  private generationTail: Promise<void> = Promise.resolve();

  private async withGenerationSlot<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.generationTail;
    let release!: () => void;
    this.generationTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await task();
    } finally {
      release();
    }
  }

  private async getActiveManifest(): Promise<LocalModelManifest | null> {
    const status = await getActiveChatModelStatus();
    return status.state === "available" && status.manifest?.runtimeFormat === "litert-lm"
      ? status.manifest
      : null;
  }

  async isAvailable(): Promise<boolean> {
    const [runtimeAvailable, manifest] = await Promise.all([
      liteRtLmRuntime.isRuntimeAvailable(),
      this.getActiveManifest()
    ]);
    return runtimeAvailable && Boolean(manifest?.evaluationStatus === "passed");
  }

  async getCapabilities(): Promise<LocalAICapabilities> {
    if (!liteRtLmRuntime.isPlatformSupported()) {
      return liteRtLmRuntime.unavailable(["LiteRT-LM is supported on Android builds only."]);
    }
    const nativeModule = liteRtLmRuntime.getModule();
    if (!nativeModule) {
      return liteRtLmRuntime.unavailable([
        "HakiLiteRtLm native module is not installed.",
        "Install an updated Android build before using Gemma 4 LiteRT-LM models."
      ]);
    }

    const [runtimeAvailable, manifest, hardware] = await Promise.all([
      liteRtLmRuntime.isRuntimeAvailable(),
      this.getActiveManifest(),
      getDeviceHardwareProfile(["litert-lm:Android LiteRT-LM"])
    ]);
    const modelAssetsAvailable = Boolean(manifest?.evaluationStatus === "passed");
    const summary = runtimeAvailable && modelAssetsAvailable && Boolean(nativeModule.summarizeFromSources);
    const safeChat = runtimeAvailable && modelAssetsAvailable && Boolean(nativeModule.answerSafeChat);
    const contextTokens = manifest?.maxContextTokens ?? manifest?.defaultContextTokens ?? 2048;
    const maxOutputTokens = safeOutputTokens(contextTokens, "safe-chat");

    return {
      summary,
      safeChat,
      embeddings: false,
      reranking: false,
      providerReady: summary || safeChat,
      requiresCustomDevBuild: true,
      minimumOS: liteRtLmRuntime.minimumOS,
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
      contextWindowTokens: contextTokens,
      safeInputBudgetTokens: safeInputBudgetTokens(contextTokens, maxOutputTokens),
      maxOutputTokens,
      streamingSupported: Boolean(nativeModule.streamSafeChat),
      executionBackend: "litert-lm",
      availableBackends: runtimeAvailable ? ["litert-lm:Android LiteRT-LM"] : [],
      accelerationStatus: runtimeAvailable ? "selected" : "unavailable",
      performanceProfile: null,
      thermalState: hardware.thermalState ?? "unknown",
      approximateDeviceCapability: manifest ? deviceCapabilityClassForTier(manifest.modelTier) : "unknown",
      architecture: hardware.architecture,
      freeStorageGB: hardware.freeStorageGB,
      memoryGB: hardware.memoryGB,
      memoryClass: hardware.memoryClass,
      unavailableReasons: [
        ...(runtimeAvailable ? [] : ["LiteRT-LM native runtime is unavailable in this build."]),
        ...(modelAssetsAvailable ? [] : ["No smoke-tested Gemma LiteRT-LM model is active."])
      ],
      notes: ["Gemma 4 text generation uses the Android LiteRT-LM runtime."]
    };
  }

  async summarizeFromSources(input: SummarizeFromSourcesInput): Promise<LocalSummaryResult> {
    return this.withGenerationSlot(() => withLocalModelInferenceLease(async () => {
      const nativeModule = liteRtLmRuntime.getModule();
      const manifest = await this.getActiveManifest();
      if (!nativeModule?.summarizeFromSources || !manifest) {
        throw new Error("LiteRT-LM summarization is unavailable because no tested Gemma model is active.");
      }
      const requestId = nextRequestId();
      const guard = createLiteRtGenerationGuard({
        cancel: async (id) => (await nativeModule.cancelGeneration?.(id)) === true,
        readThermalState: async () => (await getDeviceHardwareProfile()).thermalState ?? "unknown",
        requestId,
        totalDeadlineMs: LITERT_GENERATION_DEADLINE_MS
      });
      const startedAt = Date.now();
      guard.start();
      try {
        const result = await nativeModule.summarizeFromSources({
          ...input,
          modelPath: filePathFromUri(manifest.uri),
          requestId,
          instruction: `${input.instruction}\n\nUse only these sources. End with a SOURCE_IDS line containing only cited source IDs.`
        });
        this.lastInferenceTimeMs = Date.now() - startedAt;
        if (guard.reason) throw new Error(`LiteRT-LM summarization canceled: ${guard.reason}.`);
        return coerceNativeSummaryResult(result, input, this.id, this.name);
      } finally {
        guard.stop();
      }
    }));
  }

  async answerSafeChat(input: SafeChatInput): Promise<SafeChatResult> {
    return this.withGenerationSlot(() => withLocalModelInferenceLease(async () => {
      const nativeModule = liteRtLmRuntime.getModule();
      const manifest = await this.getActiveManifest();
      if (!nativeModule?.answerSafeChat || !manifest) {
        throw new Error("LiteRT-LM chat is unavailable because no tested Gemma model is active.");
      }
      const { abortSignal, ...nativeInput } = input;
      if (abortSignal?.aborted) {
        return {
          status: "incomplete",
          text: "",
          providerId: this.id,
          providerName: this.name
        };
      }
      const requestId = nextRequestId();
      const guard = createLiteRtGenerationGuard({
        ...(abortSignal ? { abortSignal } : {}),
        cancel: async (id) => (await nativeModule.cancelGeneration?.(id)) === true,
        readThermalState: async () => (await getDeviceHardwareProfile()).thermalState ?? "unknown",
        requestId,
        totalDeadlineMs: LITERT_GENERATION_DEADLINE_MS
      });
      const startedAt = Date.now();
      guard.start();
      try {
        const result = await nativeModule.answerSafeChat({
          ...nativeInput,
          modelPath: filePathFromUri(manifest.uri),
          requestId,
          taskContext: [input.taskContext, sourceBlock(input.sourceContext)].filter(Boolean).join("\n\n")
        });
        this.lastInferenceTimeMs = Date.now() - startedAt;
        if (guard.reason || abortSignal?.aborted) {
          return {
            status: "incomplete",
            text: typeof result === "string" ? result : result.text ?? "",
            providerId: this.id,
            providerName: this.name
          };
        }
        return coerceNativeSafeChatResult(result, this.id, this.name);
      } finally {
        guard.stop();
      }
    }));
  }

  async streamSafeChat(input: SafeChatInput, onToken: (token: string) => void): Promise<SafeChatResult> {
    const streamSafeChat = liteRtLmRuntime.getModule()?.streamSafeChat;
    if (!streamSafeChat) return this.answerSafeChat(input);
    return this.withGenerationSlot(() => withLocalModelInferenceLease(async () => {
      const manifest = await this.getActiveManifest();
      if (!manifest) throw new Error("LiteRT-LM streaming requires an active tested Gemma model.");
      const { abortSignal, ...nativeInput } = input;
      if (abortSignal?.aborted) {
        return { status: "incomplete", text: "", providerId: this.id, providerName: this.name };
      }
      const nativeModule = liteRtLmRuntime.getModule();
      const requestId = nextRequestId();
      const guard = createLiteRtGenerationGuard({
        ...(abortSignal ? { abortSignal } : {}),
        cancel: async (id) => (await nativeModule?.cancelGeneration?.(id)) === true,
        readThermalState: async () => (await getDeviceHardwareProfile()).thermalState ?? "unknown",
        requestId,
        totalDeadlineMs: LITERT_GENERATION_DEADLINE_MS
      });
      guard.start();
      try {
        const result = await streamSafeChat(
          { ...nativeInput, modelPath: filePathFromUri(manifest.uri), requestId },
          (token) => {
            if (!abortSignal?.aborted && !guard.reason) onToken(token);
          }
        );
        if (guard.reason || abortSignal?.aborted) {
          return {
            status: "incomplete",
            text: typeof result === "string" ? result : result.text ?? "",
            providerId: this.id,
            providerName: this.name
          };
        }
        return coerceNativeSafeChatResult(result, this.id, this.name);
      } finally {
        guard.stop();
      }
    }));
  }

  async prewarm(): Promise<void> {
    const manifest = await this.getActiveManifest();
    const capabilities = liteRtLmRuntime.getModule()?.getCapabilities;
    if (!manifest || !capabilities) return;
    const startedAt = Date.now();
    await capabilities().catch(() => undefined);
    this.modelLoadTimeMs ??= Date.now() - startedAt;
  }

  async dispose(): Promise<void> {
    await liteRtLmRuntime.release();
  }
}
