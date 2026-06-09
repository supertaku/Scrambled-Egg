import type {
  LocalAICapabilities,
  LocalAIProvider,
  LocalSummaryResult,
  SafeChatInput,
  SafeChatResult,
  SummarizeFromSourcesInput
} from "./LocalAIProvider";
import { onnxGenAiRuntime } from "./nativeRuntimeAdapters";
import { coerceNativeSafeChatResult, coerceNativeSummaryResult } from "./providerUtils";
import { logger } from "@/utils/logger";

const MINIMUM_OS = onnxGenAiRuntime.minimumOS;

export class OnnxGenAiProvider implements LocalAIProvider {
  readonly id = "onnx-genai" as const;
  readonly name = "ONNX Runtime GenAI";

  async isAvailable(): Promise<boolean> {
    return onnxGenAiRuntime.isRuntimeAvailable("ONNX GenAI availability check failed");
  }

  async getCapabilities(): Promise<LocalAICapabilities> {
    if (!onnxGenAiRuntime.isPlatformSupported()) {
      return onnxGenAiRuntime.unavailable(["ONNX Runtime GenAI is available only on native Android and iOS builds."]);
    }

    const nativeModule = onnxGenAiRuntime.getModule();
    if (!nativeModule) {
      return onnxGenAiRuntime.unavailable([
        "HakiOnnxGenAi native module is not installed.",
        "Phi-4-mini ONNX remains hidden until an ONNX GenAI mobile bridge is available."
      ]);
    }

    try {
      const nativeCapabilities = nativeModule.getCapabilities ? await nativeModule.getCapabilities() : {};
      const available = (await this.isAvailable()) === true;
      const summary = available && nativeCapabilities.summary === true && Boolean(nativeModule.summarizeFromSources);
      const safeChat = available && nativeCapabilities.safeChat === true && Boolean(nativeModule.answerSafeChat);
      const unavailableReasons = [
        ...(nativeCapabilities.unavailableReasons ?? []),
        ...(summary || safeChat ? [] : ["ONNX GenAI runtime is unavailable or has no active Phi artifact."])
      ];

      return {
        summary,
        safeChat,
        embeddings: nativeCapabilities.embeddings === true,
        reranking: nativeCapabilities.reranking === true,
        providerReady: summary || safeChat || nativeCapabilities.embeddings === true,
        requiresCustomDevBuild: true,
        minimumOS: MINIMUM_OS,
        modelAssetsAvailable: nativeCapabilities.modelAssetsAvailable ?? null,
        modelName: nativeCapabilities.modelName ?? null,
        modelParameterCountB: nativeCapabilities.modelParameterCountB ?? null,
        modelQuantization: nativeCapabilities.modelQuantization ?? "onnx-int4",
        runtimeFormat: "onnx-genai",
        modelTier: nativeCapabilities.modelTier ?? "unknown",
        recommendedModelTier: nativeCapabilities.recommendedModelTier ?? "unknown",
        bridgePresent: true,
        modelAssetPath: nativeCapabilities.modelAssetPath ?? null,
        modelLoadTimeMs: nativeCapabilities.modelLoadTimeMs ?? null,
        lastInferenceTimeMs: nativeCapabilities.lastInferenceTimeMs ?? null,
        streamingSupported: Boolean(nativeModule.streamSafeChat) || nativeCapabilities.streamingSupported === true,
        executionBackend: "onnx-genai",
        availableBackends: ["onnx-genai"],
        accelerationStatus: available ? "selected" : "unavailable",
        performanceProfile: null,
        thermalState: "unknown",
        approximateDeviceCapability: nativeCapabilities.approximateDeviceCapability ?? "unknown",
        architecture: Array.isArray(nativeCapabilities.architecture)
          ? nativeCapabilities.architecture.join(", ")
          : nativeCapabilities.architecture ?? null,
        freeStorageGB: typeof nativeCapabilities.freeStorageGB === "number" ? nativeCapabilities.freeStorageGB : null,
        memoryGB: typeof nativeCapabilities.memoryGB === "number" ? nativeCapabilities.memoryGB : null,
        memoryClass: nativeCapabilities.memoryClass ?? null,
        unavailableReasons,
        notes: [
          "ONNX Runtime GenAI provider for Phi-family directory artifacts.",
          "This provider stays unavailable until a real mobile ONNX GenAI bridge is installed."
        ]
      };
    } catch (error) {
      logger.ai.warn("ONNX GenAI capability check failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      return onnxGenAiRuntime.unavailable(["ONNX GenAI capability check failed."]);
    }
  }

  async summarizeFromSources(input: SummarizeFromSourcesInput): Promise<LocalSummaryResult> {
    const nativeModule = onnxGenAiRuntime.getModule();
    if (!nativeModule?.summarizeFromSources) {
      throw new Error("ONNX GenAI summarization is unavailable in this build.");
    }

    const nativeResult = await nativeModule.summarizeFromSources(input);
    return coerceNativeSummaryResult(nativeResult, input, this.id, this.name);
  }

  async answerSafeChat(input: SafeChatInput): Promise<SafeChatResult> {
    const nativeModule = onnxGenAiRuntime.getModule();
    if (!nativeModule?.answerSafeChat) {
      throw new Error("ONNX GenAI safe chat is unavailable in this build.");
    }

    const nativeResult = await nativeModule.answerSafeChat(input);
    return coerceNativeSafeChatResult(nativeResult, this.id, this.name);
  }

  async streamSafeChat(input: SafeChatInput, onToken: (token: string) => void): Promise<SafeChatResult> {
    const nativeModule = onnxGenAiRuntime.getModule();
    if (!nativeModule?.streamSafeChat) {
      return this.answerSafeChat(input);
    }

    const nativeResult = await nativeModule.streamSafeChat(input, onToken);
    return coerceNativeSafeChatResult(nativeResult, this.id, this.name);
  }

  async dispose(): Promise<void> {
    await onnxGenAiRuntime.release();
  }
}
