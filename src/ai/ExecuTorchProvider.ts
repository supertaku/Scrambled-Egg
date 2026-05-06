import { DeviceEventEmitter, Platform } from "react-native";

import type {
  LocalAICapabilities,
  LocalAIProvider,
  SafeChatInput,
  SafeChatResult,
  SummarizeFromSourcesInput,
  LocalSummaryResult
} from "./LocalAIProvider";
import { getExecuTorchNativeModule } from "./nativeModules";
import { coerceNativeSafeChatResult, coerceNativeSummaryResult, hasMinimumOS } from "./providerUtils";
import { unavailableCapabilities } from "./LocalAIProvider";
import { validateExecuTorchRuntime } from "./localModelRequirements";
import { logger } from "@/utils/logger";

const EXECUTORCH_TOKEN_EVENT = "HakiExecuTorchToken";
const EXECUTORCH_STREAMING_ENABLED = false;
const PROMPT_ECHO_BUFFER_LIMIT = 8000;

function createPromptEchoGuard(onToken: (token: string) => void): (token: string) => void {
  let pending = "";
  let passThrough = false;
  let suppressingPromptEcho = false;

  return (token: string) => {
    if (passThrough) {
      onToken(token);
      return;
    }

    pending += token;
    const trimmed = pending.trimStart();
    suppressingPromptEcho =
      suppressingPromptEcho || /^(?:System:|App context:|User:|<\|im_start\|>(?:system|user))/i.test(trimmed);
    const looksLikePromptEcho = suppressingPromptEcho;
    const assistantMatch = [
      ...trimmed.matchAll(/(?:^|\n)\s*(?:<\|im_start\|>assistant\s*|Assistant:\s*)/gi)
    ].at(-1);

    if (looksLikePromptEcho && assistantMatch?.index !== undefined) {
      passThrough = true;
      suppressingPromptEcho = false;
      const answerText = trimmed.slice(assistantMatch.index + assistantMatch[0].length);
      if (answerText) onToken(answerText);
      pending = "";
      return;
    }

    if (looksLikePromptEcho) {
      if (pending.length > PROMPT_ECHO_BUFFER_LIMIT) {
        pending = pending.slice(-PROMPT_ECHO_BUFFER_LIMIT);
      }
      return;
    }

    passThrough = true;
    onToken(pending);
    pending = "";
  };
}

export class ExecuTorchProvider implements LocalAIProvider {
  readonly id = "executorch" as const;
  readonly name = "ExecuTorch";

  private platformSupported(): boolean {
    if (Platform.OS === "ios") {
      return hasMinimumOS(17);
    }

    if (Platform.OS === "android") {
      return hasMinimumOS(33);
    }

    return false;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.platformSupported()) {
      return false;
    }

    const nativeModule = getExecuTorchNativeModule();
    if (!nativeModule?.isAvailable) {
      return false;
    }

    try {
      return (await nativeModule.isAvailable()) === true;
    } catch (error) {
      logger.ai.warn("ExecuTorch availability check failed", { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  async getCapabilities(): Promise<LocalAICapabilities> {
    const minimumOS = "iOS 17+ / Android 13+";
    if (!this.platformSupported()) {
      return unavailableCapabilities(["Device OS is below the ExecuTorch target."], minimumOS);
    }

    const nativeModule = getExecuTorchNativeModule();
    if (!nativeModule) {
      return unavailableCapabilities(
        ["HakiExecuTorch native module is not installed. Use a custom Expo development build to add it."],
        minimumOS
      );
    }

    try {
      const nativeCapabilities = nativeModule.getCapabilities ? await nativeModule.getCapabilities() : {};
      const modelAssetsAvailable = nativeCapabilities.modelAssetsAvailable === true;
      const runtimeValidation = validateExecuTorchRuntime({
        architecture: nativeCapabilities.architecture ?? null,
        freeStorageGB: nativeCapabilities.freeStorageGB ?? null,
        memoryGB: nativeCapabilities.memoryGB ?? null,
        modelAssetsAvailable,
        modelName: nativeCapabilities.modelName ?? null,
        modelParameterCountB: nativeCapabilities.modelParameterCountB ?? null,
        modelQuantization: nativeCapabilities.modelQuantization ?? null,
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
        ...(summary ? [] : ["ExecuTorch summarization is unavailable."]),
        ...(safeChat ? [] : ["ExecuTorch safe chat is unavailable."]),
        ...(embeddings ? [] : ["ExecuTorch embeddings are unavailable."])
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
        modelName: runtimeValidation.metadata.modelName,
        modelParameterCountB: runtimeValidation.metadata.modelParameterCountB,
        modelQuantization: runtimeValidation.metadata.modelQuantization,
        modelTier: runtimeValidation.metadata.modelTier,
        recommendedModelTier: runtimeValidation.metadata.recommendedModelTier,
        bridgePresent: true,
        modelAssetPath: nativeCapabilities.modelAssetPath ?? null,
        modelLoadTimeMs: nativeCapabilities.modelLoadTimeMs ?? null,
        lastInferenceTimeMs: nativeCapabilities.lastInferenceTimeMs ?? null,
        streamingSupported:
          EXECUTORCH_STREAMING_ENABLED &&
          (Boolean(nativeModule.streamSafeChat) || nativeCapabilities.streamingSupported === true),
        approximateDeviceCapability: nativeCapabilities.approximateDeviceCapability ?? "unknown",
        architecture: runtimeValidation.metadata.architecture,
        freeStorageGB: runtimeValidation.metadata.freeStorageGB,
        memoryGB: runtimeValidation.metadata.memoryGB,
        memoryClass: nativeCapabilities.memoryClass ?? null,
        unavailableReasons,
        notes: [
          "Requires a custom Expo development build with the HakiExecuTorch native module.",
          "Android local AI supports tiers from Tiny (4GB RAM) to Flagship (16GB RAM).",
          "Models can be bundled with the APK or downloaded on-demand in the app settings to save initial download size.",
          "Summaries must be generated only from retrieved source chunks. Safe general chat may use the local model when the native bridge exposes it. FTS5 remains the fallback on every device.",
          ...runtimeValidation.notes
        ]
      };
    } catch (error) {
      logger.ai.warn("ExecuTorch capability check failed", { error: error instanceof Error ? error.message : String(error) });
      return unavailableCapabilities(["ExecuTorch capability check failed."], minimumOS);
    }
  }

  async summarizeFromSources(input: SummarizeFromSourcesInput): Promise<LocalSummaryResult> {
    const nativeModule = getExecuTorchNativeModule();
    if (!nativeModule?.summarizeFromSources) {
      throw new Error("ExecuTorch summarization is unavailable in this build.");
    }

    const nativeResult = await nativeModule.summarizeFromSources(input);
    return coerceNativeSummaryResult(nativeResult, input, this.id, this.name);
  }

  async answerSafeChat(input: SafeChatInput): Promise<SafeChatResult> {
    const nativeModule = getExecuTorchNativeModule();
    if (!nativeModule?.answerSafeChat) {
      throw new Error("ExecuTorch safe chat is unavailable in this build.");
    }

    const nativeResult = await nativeModule.answerSafeChat(input);
    return coerceNativeSafeChatResult(nativeResult, this.id, this.name);
  }

  async streamSafeChat(input: SafeChatInput, onToken: (token: string) => void): Promise<SafeChatResult> {
    if (!EXECUTORCH_STREAMING_ENABLED) {
      return this.answerSafeChat(input);
    }

    const nativeModule = getExecuTorchNativeModule();
    if (!nativeModule?.streamSafeChat) {
      return this.answerSafeChat(input);
    }

    const streamId = `executorch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const guardedOnToken = createPromptEchoGuard(onToken);
    const subscription = DeviceEventEmitter.addListener(
      EXECUTORCH_TOKEN_EVENT,
      (event: { streamId?: string; token?: string }) => {
        if (event?.streamId === streamId && event.token) {
          guardedOnToken(event.token);
        }
      }
    );

    try {
      const nativeResult = await nativeModule.streamSafeChat(input, streamId);
      return coerceNativeSafeChatResult(nativeResult, this.id, this.name);
    } finally {
      subscription.remove();
    }
  }

  async embedText(text: string): Promise<number[]> {
    const nativeModule = getExecuTorchNativeModule();
    if (!nativeModule?.embedText) {
      throw new Error("ExecuTorch embeddings are unavailable in this build.");
    }

    return nativeModule.embedText(text);
  }

  async dispose(): Promise<void> {
    const nativeModule = getExecuTorchNativeModule();
    if (!nativeModule?.release) {
      return;
    }

    try {
      await nativeModule.release();
    } catch (error) {
      logger.ai.warn("ExecuTorch native release failed", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
