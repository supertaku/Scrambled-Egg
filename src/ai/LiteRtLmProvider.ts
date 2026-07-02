import { DeviceEventEmitter } from "react-native";

import { logger } from "@/utils/logger";

import type {
  LocalAICapabilities,
  LocalAIProvider,
  LocalSummaryResult,
  SafeChatInput,
  SafeChatResult,
  SummarizeFromSourcesInput
} from "./LocalAIProvider";
import { getDeviceHardwareProfile } from "./deviceHardwareProfile";
import {
  createLiteRtGenerationGuard,
  type LiteRtCancellationReason,
  type LiteRtGenerationGuard
} from "./liteRtGenerationGuard";
import type { LocalModelManifest } from "./localModelMetadata";
import { deviceCapabilityClassForTier } from "./localModelMetadata";
import { getActiveChatModelStatus, withLocalModelInferenceLease } from "./localModelManager";
import { liteRtLmRuntime } from "./nativeRuntimeAdapters";
import { sourceBlock } from "./providerPromptShared";
import { coerceNativeSafeChatResult, coerceNativeSummaryResult } from "./providerUtils";
import { safeInputBudgetTokens, safeOutputTokens } from "./tokenBudget";

const LITERT_GENERATION_DEADLINE_MS = 120_000;
// Per-token stream events from HakiLiteRtLmModule; payload { requestId, token }.
const LITERT_TOKEN_EVENT = "HakiLiteRtLmToken";
let nextRequestSequence = 0;

function nextRequestId(): string {
  nextRequestSequence += 1;
  return `litert-${Date.now()}-${nextRequestSequence}`;
}

function filePathFromUri(uri: string): string {
  return uri.startsWith("file://") ? decodeURIComponent(uri.slice("file://".length)) : uri;
}

type GuardedNativeOutcome<T> =
  | { kind: "native"; result: T }
  | { kind: "native-error"; error: unknown }
  | { kind: "guard"; reason: LiteRtCancellationReason };

async function raceNativeAgainstGuard<T>(params: {
  guard: LiteRtGenerationGuard;
  operation: "chat" | "stream-chat" | "summary";
  requestId: string;
  runNative: () => Promise<T>;
  startedAt: number;
}): Promise<GuardedNativeOutcome<T>> {
  let terminalSelected = false;
  const nativeOutcome: Promise<GuardedNativeOutcome<T>> = Promise.resolve()
    .then(params.runNative)
    .then(
      (result) => {
        if (terminalSelected) {
          logger.ai.warn("LiteRT-LM native request settled after a terminal guard outcome.", {
            elapsedMs: Date.now() - params.startedAt,
            operation: params.operation,
            requestId: params.requestId,
            settlement: "resolved"
          });
        }
        return { kind: "native" as const, result };
      },
      (error: unknown) => {
        if (terminalSelected) {
          logger.ai.warn("LiteRT-LM native request settled after a terminal guard outcome.", {
            elapsedMs: Date.now() - params.startedAt,
            operation: params.operation,
            requestId: params.requestId,
            settlement: "rejected"
          });
        }
        return { kind: "native-error" as const, error };
      }
    );
  const guardOutcome = params.guard.cancellation.then<GuardedNativeOutcome<T>>(() => {
    const reason = params.guard.reason;
    if (!reason) {
      return {
        kind: "native-error",
        error: new Error("LiteRT-LM generation guard settled without a cancellation reason.")
      };
    }
    return { kind: "guard", reason };
  });

  const outcome = await Promise.race([nativeOutcome, guardOutcome]);
  terminalSelected = true;
  return outcome;
}

function logGuardOutcome(params: {
  hasPartialText: boolean;
  operation: "chat" | "stream-chat" | "summary";
  reason: LiteRtCancellationReason;
  requestId: string;
  startedAt: number;
}): void {
  const data = {
    elapsedMs: Date.now() - params.startedAt,
    hasPartialText: params.hasPartialText,
    operation: params.operation,
    reason: params.reason,
    requestId: params.requestId
  };
  if (params.reason === "aborted") {
    logger.ai.log("LiteRT-LM request canceled by the caller.", data);
  } else {
    logger.ai.warn("LiteRT-LM request stopped by its generation guard.", data);
  }
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
      logger.ai.log("LiteRT-LM request started.", { operation: "summary", requestId });
      guard.start();
      try {
        const outcome = await raceNativeAgainstGuard({
          guard,
          operation: "summary",
          requestId,
          startedAt,
          runNative: () => nativeModule.summarizeFromSources!({
            ...input,
            modelPath: filePathFromUri(manifest.uri),
            requestId,
            instruction: `${input.instruction}\n\nUse only these sources. End with a SOURCE_IDS line containing only cited source IDs.`
          })
        });
        this.lastInferenceTimeMs = Date.now() - startedAt;
        if (outcome.kind === "native-error") throw outcome.error;
        if (outcome.kind === "guard") {
          logGuardOutcome({
            hasPartialText: false,
            operation: "summary",
            reason: outcome.reason,
            requestId,
            startedAt
          });
          throw new Error(`LiteRT-LM summarization canceled: ${outcome.reason}.`);
        }
        return coerceNativeSummaryResult(outcome.result, input, this.id, this.name);
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
      logger.ai.log("LiteRT-LM request started.", { operation: "chat", requestId });
      guard.start();
      try {
        const outcome = await raceNativeAgainstGuard({
          guard,
          operation: "chat",
          requestId,
          startedAt,
          runNative: () => nativeModule.answerSafeChat!({
            ...nativeInput,
            modelPath: filePathFromUri(manifest.uri),
            requestId,
            taskContext: [input.taskContext, sourceBlock(input.sourceContext)].filter(Boolean).join("\n\n")
          })
        });
        this.lastInferenceTimeMs = Date.now() - startedAt;
        if (outcome.kind === "native-error") throw outcome.error;
        if (outcome.kind === "guard") {
          logGuardOutcome({
            hasPartialText: false,
            operation: "chat",
            reason: outcome.reason,
            requestId,
            startedAt
          });
          return {
            status: "incomplete",
            text: "",
            providerId: this.id,
            providerName: this.name
          };
        }
        if (guard.reason || abortSignal?.aborted) {
          const result = outcome.result;
          return {
            status: "incomplete",
            text: typeof result === "string" ? result : result.text ?? "",
            providerId: this.id,
            providerName: this.name
          };
        }
        return coerceNativeSafeChatResult(outcome.result, this.id, this.name);
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
      const startedAt = Date.now();
      let acceptingTokens = true;
      let streamedText = "";
      // Deltas arrive as device events keyed by requestId (a bridge Callback
      // can only fire once); the awaited promise returns the complete text.
      const tokenSubscription = DeviceEventEmitter.addListener(
        LITERT_TOKEN_EVENT,
        (event: { requestId?: string; token?: string }) => {
          if (event?.requestId !== requestId || !event.token) return;
          if (!acceptingTokens || abortSignal?.aborted || guard.reason) return;
          streamedText = `${streamedText}${event.token}`;
          onToken(event.token);
        }
      );
      logger.ai.log("LiteRT-LM request started.", { operation: "stream-chat", requestId });
      guard.start();
      try {
        const outcome = await raceNativeAgainstGuard({
          guard,
          operation: "stream-chat",
          requestId,
          startedAt,
          runNative: () => streamSafeChat({
            ...nativeInput,
            modelPath: filePathFromUri(manifest.uri),
            requestId
          })
        });
        acceptingTokens = false;
        this.lastInferenceTimeMs = Date.now() - startedAt;
        if (outcome.kind === "native-error") throw outcome.error;
        if (outcome.kind === "guard") {
          logGuardOutcome({
            hasPartialText: streamedText.length > 0,
            operation: "stream-chat",
            reason: outcome.reason,
            requestId,
            startedAt
          });
          return {
            status: "incomplete",
            text: streamedText,
            providerId: this.id,
            providerName: this.name
          };
        }
        if (guard.reason || abortSignal?.aborted) {
          const result = outcome.result;
          return {
            status: "incomplete",
            text: (typeof result === "string" ? result : result.text ?? "") || streamedText,
            providerId: this.id,
            providerName: this.name
          };
        }
        const result = coerceNativeSafeChatResult(outcome.result, this.id, this.name);
        return result.text || !streamedText ? result : { ...result, text: streamedText };
      } finally {
        acceptingTokens = false;
        tokenSubscription.remove();
        guard.stop();
      }
    }));
  }

  async prewarm(): Promise<void> {
    const manifest = await this.getActiveManifest();
    const prepareModel = liteRtLmRuntime.getModule()?.prepareModel;
    if (!manifest || !prepareModel) return;
    const startedAt = Date.now();
    await prepareModel(filePathFromUri(manifest.uri));
    this.modelLoadTimeMs ??= Date.now() - startedAt;
  }

  async dispose(): Promise<void> {
    await liteRtLmRuntime.release();
  }
}
