import { Platform } from "react-native";

import type {
  LocalAICapabilities,
  LocalAIProvider,
  LocalSummaryResult,
  SafeChatInput,
  SafeChatResult,
  SummarizeFromSourcesInput
} from "./LocalAIProvider";
import { unavailableCapabilities } from "./LocalAIProvider";
import { getAppleFoundationModelsNativeModule } from "./nativeModules";
import { coerceNativeSafeChatResult, coerceNativeSummaryResult } from "./providerUtils";
import { APPLE_INTELLIGENCE_REQUIREMENTS, validateAppleIntelligenceRuntime } from "./localModelRequirements";
import { logger } from "@/utils/logger";

export class AppleFoundationModelsProvider implements LocalAIProvider {
  readonly id = "apple-foundation-models" as const;
  readonly name = "Apple Intelligence";

  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== "ios") {
      return false;
    }

    const nativeModule = getAppleFoundationModelsNativeModule();
    if (!nativeModule?.isAvailable) {
      return false;
    }

    try {
      return (await nativeModule.isAvailable()) === true;
    } catch (error) {
      logger.ai.warn("Apple Foundation Models availability check failed", { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  async getCapabilities(): Promise<LocalAICapabilities> {
    const minimumOS = APPLE_INTELLIGENCE_REQUIREMENTS.minimumOS;
    if (Platform.OS !== "ios") {
      return unavailableCapabilities(["Apple Foundation Models are iOS-only."], minimumOS);
    }

    const nativeModule = getAppleFoundationModelsNativeModule();
    if (!nativeModule) {
      return unavailableCapabilities(
        [
          "HakiAppleFoundationModels native module is not installed.",
          "This is a placeholder bridge for a future Swift implementation in a custom Expo development build."
        ],
        minimumOS
      );
    }

    try {
      const nativeCapabilities = nativeModule.getCapabilities ? await nativeModule.getCapabilities() : {};
      const modelAssetsAvailable = nativeCapabilities.modelAssetsAvailable === true;
      const runtimeValidation = validateAppleIntelligenceRuntime({
        freeStorageGB: nativeCapabilities.freeStorageGB ?? null,
        modelAssetsAvailable,
        nativeUnavailableReasons: nativeCapabilities.unavailableReasons ?? []
      });
      const runtimeReady = runtimeValidation.unavailableReasons.length === 0;
      const summary =
        runtimeReady && Boolean(nativeModule.summarizeFromSources) && nativeCapabilities.summary === true;
      const safeChat =
        runtimeReady &&
        Boolean(nativeModule.answerSafeChat) &&
        nativeCapabilities.safeChat === true;
      const embeddings = runtimeReady && Boolean(nativeModule.embedText) && nativeCapabilities.embeddings === true;
      const unavailableReasons = [
        ...runtimeValidation.unavailableReasons,
        ...(summary ? [] : ["Apple Foundation Models summarization is unavailable."]),
        ...(safeChat ? [] : ["Apple Foundation Models safe chat is unavailable."]),
        ...(embeddings ? [] : ["Apple Foundation Models embeddings are unavailable."])
      ];

      return {
        summary,
        safeChat,
        embeddings,
        reranking: nativeCapabilities.reranking === true,
        providerReady: summary || safeChat || embeddings,
        requiresCustomDevBuild: true,
        minimumOS,
        modelAssetsAvailable,
        modelName: nativeCapabilities.modelName ?? "Apple Intelligence Foundation Models",
        modelParameterCountB: null,
        modelQuantization: null,
        modelTier: "apple-intelligence",
        recommendedModelTier: "apple-intelligence",
        bridgePresent: true,
        modelAssetPath: nativeCapabilities.modelAssetPath ?? "Apple Intelligence Foundation Models",
        modelLoadTimeMs: nativeCapabilities.modelLoadTimeMs ?? null,
        lastInferenceTimeMs: nativeCapabilities.lastInferenceTimeMs ?? null,
        streamingSupported: Boolean(nativeModule.streamSafeChat) || nativeCapabilities.streamingSupported === true,
        executionBackend: "apple-foundation-models",
        availableBackends: ["apple-foundation-models"],
        accelerationStatus: runtimeReady ? "selected" : "unavailable",
        performanceProfile: null,
        thermalState: "unknown",
        approximateDeviceCapability: nativeCapabilities.approximateDeviceCapability ?? "unknown",
        architecture: nativeCapabilities.architecture
          ? Array.isArray(nativeCapabilities.architecture)
            ? nativeCapabilities.architecture.join(", ")
            : nativeCapabilities.architecture
          : null,
        freeStorageGB: runtimeValidation.freeStorageGB,
        memoryGB: null,
        memoryClass: nativeCapabilities.memoryClass ?? null,
        unavailableReasons,
        notes: [
          "Optional Apple Intelligence provider. It must be backed by an iOS native module.",
          `${APPLE_INTELLIGENCE_REQUIREMENTS.supportedDevices}; ${APPLE_INTELLIGENCE_REQUIREMENTS.minimumOS}; model readiness is reported by Apple Foundation Models availability.`,
          "The native bridge must refuse unsupported devices and unavailable Foundation Models sessions. FTS5 remains the fallback on every device."
        ]
      };
    } catch (error) {
      logger.ai.warn("Apple Foundation Models capability check failed", { error: error instanceof Error ? error.message : String(error) });
      return unavailableCapabilities(["Apple Foundation Models capability check failed."], minimumOS);
    }
  }

  async summarizeFromSources(input: SummarizeFromSourcesInput): Promise<LocalSummaryResult> {
    const nativeModule = getAppleFoundationModelsNativeModule();
    if (!nativeModule?.summarizeFromSources) {
      throw new Error("Apple Foundation Models summarization is unavailable in this build.");
    }

    const nativeResult = await nativeModule.summarizeFromSources(input);
    return coerceNativeSummaryResult(nativeResult, input, this.id, this.name);
  }

  async answerSafeChat(input: SafeChatInput): Promise<SafeChatResult> {
    const nativeModule = getAppleFoundationModelsNativeModule();
    if (!nativeModule?.answerSafeChat) {
      throw new Error("Apple Foundation Models safe chat is unavailable in this build.");
    }

    const nativeResult = await nativeModule.answerSafeChat(input);
    return coerceNativeSafeChatResult(nativeResult, this.id, this.name);
  }

  async streamSafeChat(input: SafeChatInput, onToken: (token: string) => void): Promise<SafeChatResult> {
    const nativeModule = getAppleFoundationModelsNativeModule();
    if (!nativeModule?.streamSafeChat) {
      return this.answerSafeChat(input);
    }

    const nativeResult = await nativeModule.streamSafeChat(input, onToken);
    return coerceNativeSafeChatResult(nativeResult, this.id, this.name);
  }

  async embedText(text: string): Promise<number[]> {
    const nativeModule = getAppleFoundationModelsNativeModule();
    if (!nativeModule?.embedText) {
      throw new Error("Apple Foundation Models embeddings are unavailable in this build.");
    }

    return nativeModule.embedText(text);
  }

  async dispose(): Promise<void> {
    const nativeModule = getAppleFoundationModelsNativeModule();
    if (!nativeModule?.release) {
      return;
    }

    try {
      await nativeModule.release();
    } catch (error) {
      logger.ai.warn("Apple Foundation Models release failed", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
