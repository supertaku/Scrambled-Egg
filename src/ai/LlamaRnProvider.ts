import { Platform } from "react-native";

import type {
  LocalAICapabilities,
  LocalAIProvider,
  LocalContextUsage,
  LocalSummaryResult,
  SafeChatInput,
  SafeChatResult,
  SourceChunkForSummary,
  SummarizeFromSourcesInput
} from "./LocalAIProvider";
import { unavailableCapabilities } from "./LocalAIProvider";
import { NO_RELIABLE_ANSWER, safeChatInstructionForTier } from "./prompts";
import { STOP_WORDS, safeChatOutputTokens, safeChatSamplingForScenario } from "./llamaSamplingProfiles";
import {
  citationIdsFromText,
  conversationMessages,
  instructionForManifest,
  isNoReliableAnswer,
  sourceBlock,
  thinkingDisabledForManifest
} from "./providerPromptShared";
import { extractCitationFooter, sanitizeAssistantText } from "./providerUtils";
import { getDeviceHardwareProfile } from "./deviceHardwareProfile";
import {
  deviceCapabilityClassForTier,
  getLlamaContextSettingsForTier,
  recommendedDeviceModelTier
} from "./localModelMetadata";
import type { ImportedModelStatus, LocalModelManifest, LocalModelRole } from "./localModelManager";
import { getActiveChatModelStatus, getImportedModelStatus, getLocalModelDirectoryUri, withLocalModelInferenceLease } from "./localModelManager";
import { loadLlamaRn } from "./llamaRnRuntime";
import { isDegenerateAssistantText } from "./outputQuality";
import {
  estimateTokens,
  pruneChatContextWithTokenizer,
  pruneSourcesForBudget,
  safeInputBudgetTokens,
  safeOutputTokens
} from "./tokenBudget";
import { createInferenceWatchdog, watchdogConfigForTier } from "./inferenceWatchdog";
import { isCompletionStoppedDueToTokenLimit } from "./llamaStoppedLimit";
import { executionOptionsForManifest } from "./localModelPerformance";
import { RecoverableAsyncResource } from "./recoverableAsyncResource";
import { logger } from "@/utils/logger";

import type { LlamaContext, TokenData } from "llama.rn";

export class LlamaRnProvider implements LocalAIProvider {
  readonly id = "llama-rn" as const;
  readonly name = "llama.rn GGUF";

  private readonly chatContext = new RecoverableAsyncResource<LlamaContext>();
  private readonly embeddingContext = new RecoverableAsyncResource<LlamaContext>();
  private modelLoadTimeMs: number | null = null;
  private lastInferenceTimeMs: number | null = null;

  private platformSupported(): boolean {
    return Platform.OS === "android" || Platform.OS === "ios";
  }

  private async getBackendDevices(): Promise<string[] | null> {
    if (!this.platformSupported()) return null;

    try {
      const llama = await loadLlamaRn();
      const devices = await llama.getBackendDevicesInfo();
      return devices.map((device) => `${device.backend}:${device.deviceName}`).filter(Boolean);
    } catch (error) {
      logger.ai.warn("llama.rn runtime check failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  private async runtimeAvailable(): Promise<boolean> {
    if (!this.platformSupported()) return false;
    return (await this.getBackendDevices()) !== null;
  }

  async isAvailable(): Promise<boolean> {
    const [runtimeAvailable, chatStatus, embeddingStatus] = await Promise.all([
      this.runtimeAvailable(),
      getActiveChatModelStatus(),
      getImportedModelStatus("embedding")
    ]);

    return runtimeAvailable && (chatStatus.state === "available" || embeddingStatus.state === "available");
  }

  async getCapabilities(): Promise<LocalAICapabilities> {
    const minimumOS = "Android arm64-v8a/x86_64 or iOS with llama.rn native runtime";
    const modelDirectory = getLocalModelDirectoryUri();
    if (!this.platformSupported()) {
      return unavailableCapabilities(["llama.rn is available only on native Android and iOS builds."], minimumOS);
    }

    const backendDevices = await this.getBackendDevices();
    const [chatStatus, embeddingStatus, hardware] = await Promise.all([
      getActiveChatModelStatus(),
      getImportedModelStatus("embedding"),
      getDeviceHardwareProfile(backendDevices ?? [])
    ]);
    const runtimeAvailable = backendDevices !== null;
    const chatManifest = chatStatus.manifest;
    const embeddingManifest = embeddingStatus.manifest;
    const modelAssetsAvailable = chatStatus.state === "available";
    const embeddingsAvailable = runtimeAvailable && embeddingStatus.state === "available";
    const providerReady = runtimeAvailable && (modelAssetsAvailable || embeddingsAvailable);
    const recommendedModelTier = chatManifest?.recommendedModelTier ?? embeddingManifest?.recommendedModelTier ?? recommendedDeviceModelTier(hardware);
    const contextSettings = chatManifest ? getLlamaContextSettingsForTier(chatManifest.modelTier, false) : null;
    const maxOutputTokens = contextSettings ? safeOutputTokens(contextSettings.nCtx, "safe-chat") : null;
    const modelRejectionReasons = [
      ...(chatStatus.state === "rejected" ? chatStatus.rejectionReasons : []),
      ...(embeddingStatus.state === "rejected" ? embeddingStatus.rejectionReasons : [])
    ];
    const unavailableReasons = [
      ...(runtimeAvailable ? [] : ["llama.rn native runtime is unavailable. Rebuild the custom native app after adding the plugin."]),
      ...(modelAssetsAvailable || embeddingsAvailable
        ? []
        : chatStatus.rejectionReasons.length > 0
          ? chatStatus.rejectionReasons
          : [`No active GGUF chat model is installed. Choose a compatible download in AI Models (${modelDirectory ?? "app-private model storage"}).`])
    ];

    return {
      summary: runtimeAvailable && modelAssetsAvailable,
      safeChat: runtimeAvailable && modelAssetsAvailable,
      embeddings: embeddingsAvailable,
      reranking: false,
      providerReady,
      requiresCustomDevBuild: true,
      minimumOS,
      modelAssetsAvailable,
      modelName: chatManifest?.modelName ?? embeddingManifest?.modelName ?? null,
      embeddingModelName: embeddingManifest?.modelName ?? null,
      embeddingModelFileHash: embeddingManifest?.fileHash ?? null,
      embeddingDimension: embeddingManifest?.embeddingDimension ?? null,
      modelParameterCountB: chatManifest?.modelParameterCountB ?? embeddingManifest?.modelParameterCountB ?? null,
      modelQuantization: chatManifest?.modelQuantization ?? embeddingManifest?.modelQuantization ?? null,
      modelTier: chatManifest?.modelTier ?? embeddingManifest?.modelTier ?? "unknown",
      recommendedModelTier,
      bridgePresent: runtimeAvailable,
      modelAssetPath: chatManifest?.uri ?? embeddingManifest?.uri ?? null,
      modelManifestPath: chatManifest?.manifestPath ?? embeddingManifest?.manifestPath ?? chatStatus.manifestPath ?? null,
      modelImportStatus: runtimeAvailable ? (modelAssetsAvailable ? chatStatus.state : embeddingStatus.state) : "runtime_unavailable",
      modelFileHash: chatManifest?.fileHash ?? embeddingManifest?.fileHash ?? null,
      modelRejectionReasons,
      modelLoadTimeMs: this.modelLoadTimeMs,
      lastInferenceTimeMs: this.lastInferenceTimeMs,
      contextWindowTokens: contextSettings?.nCtx ?? null,
      safeInputBudgetTokens: contextSettings && maxOutputTokens ? safeInputBudgetTokens(contextSettings.nCtx, maxOutputTokens) : null,
      maxOutputTokens,
      streamingSupported:
        runtimeAvailable && modelAssetsAvailable && (!chatManifest || !thinkingDisabledForManifest(chatManifest)),
      executionBackend: chatManifest?.executionProfile?.executionBackend ?? "cpu",
      availableBackends: backendDevices ?? [],
      accelerationStatus: chatManifest?.executionProfile?.accelerationStatus ?? "not_checked",
      performanceProfile: chatManifest?.executionProfile ?? null,
      thermalState: hardware.thermalState ?? "unknown",
      approximateDeviceCapability: providerReady ? deviceCapabilityClassForTier((chatManifest ?? embeddingManifest)?.modelTier ?? "unknown") : "unknown",
      architecture: hardware.architecture,
      freeStorageGB: hardware.freeStorageGB,
      memoryGB: hardware.memoryGB,
      memoryClass: hardware.memoryClass,
      unavailableReasons,
      notes: [
        "llama.rn uses local GGUF models and is the Off Grid-style provider path.",
        "Students choose compatible chat downloads from AI Models; admin imports use the same app-private managed library.",
        "Haki refuses to activate oversized GGUF models when device RAM, architecture, or free storage do not match the detected model tier.",
        "Embedding GGUF files are supported by the manifest path but chat GGUF is the primary downloaded local AI path."
      ]
    };
  }

  async summarizeFromSources(input: SummarizeFromSourcesInput): Promise<LocalSummaryResult> {
    return withLocalModelInferenceLease(async () => {
    const manifest = await this.getAvailableManifest("chat");
    const settings = getLlamaContextSettingsForTier(manifest.modelTier, false);
    const outputTokens = safeOutputTokens(settings.nCtx, "summary");
    const inputBudget = safeInputBudgetTokens(settings.nCtx, outputTokens);
    const fixedTokens = estimateTokens(input.instruction) + estimateTokens(input.question) + 64;
    if (fixedTokens >= inputBudget) {
      return {
        status: "no_reliable_answer",
        text: NO_RELIABLE_ANSWER,
        citationIds: [],
        providerId: this.id,
        providerName: this.name
      };
    }

    const context = await this.ensureChatContext();
    const promptSources = sourceBlock(pruneSourcesForBudget(input.sources, inputBudget - fixedTokens));
    const startedAt = Date.now();
    const result = await context.completion({
      messages: [
        {
          role: "system",
          content: instructionForManifest(input.instruction, manifest)
        },
        {
          role: "user",
          content: `${promptSources}\n\nQuestion: ${input.question}\n\nWrite the answer without showing source IDs in the prose. After the answer, add a final SOURCE_IDS line with only the source IDs used.`
        }
      ],
      n_predict: outputTokens,
      temperature: 0.2,
      top_p: 0.9,
      stop: STOP_WORDS
    });
    this.lastInferenceTimeMs = Date.now() - startedAt;

    const text = sanitizeAssistantText(result.content || result.text);
    const { text: cleanedText, citationIds: footerIds } = extractCitationFooter(text);
    const inlineIds = citationIdsFromText(cleanedText, input.sources);
    const allowed = new Set(input.sources.map((source) => source.citationId));
    const citationIds = Array.from(new Set([...footerIds, ...inlineIds].filter((id) => allowed.has(id))));
    if (!cleanedText || isNoReliableAnswer(cleanedText) || citationIds.length === 0) {
      return {
        status: "no_reliable_answer",
        text: NO_RELIABLE_ANSWER,
        citationIds: [],
        providerId: this.id,
        providerName: this.name
      };
    }

    return {
      status: "ok",
      text: cleanedText,
      citationIds,
      providerId: this.id,
      providerName: this.name
    };
    });
  }

  async answerSafeChat(input: SafeChatInput): Promise<SafeChatResult> {
    return this.runSafeChat(input);
  }

  /**
   * Eager model load. Fire-and-forget from the chat screen; swallows errors so
   * mount-time warmup never crashes the UI.
   *
   * After loading, runs a one-token priming completion with the standing
   * system instruction so its KV cache is hot before the first user send —
   * the first real message then only prefills its own new tokens.
   */
  async prewarm(): Promise<void> {
    try {
      await withLocalModelInferenceLease(async () => {
        const context = await this.ensureChatContext();
        try {
          const manifest = await this.getAvailableManifest("chat");
          const instruction = instructionForManifest(
            safeChatInstructionForTier(manifest.modelTier, "haki"),
            manifest
          );
          const startedAt = Date.now();
          await context.completion({
            messages: [{ content: instruction, role: "system" as const }],
            n_predict: 1,
            stop: STOP_WORDS
          });
          logger.ai.log("llama.rn prewarm primed the system prompt KV cache.", {
            modelTier: manifest.modelTier,
            primeMs: Date.now() - startedAt
          });
        } catch (error) {
          await this.chatContext.invalidate((pending) => this.releaseContext(pending));
          logger.ai.warn("llama.rn prewarm priming skipped.", {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });
    } catch (error) {
      logger.ai.warn("llama.rn prewarm failed; first send will retry.", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async streamSafeChat(input: SafeChatInput, onToken: (token: string) => void): Promise<SafeChatResult> {
    return this.runSafeChat(input, onToken);
  }

  async embedText(text: string): Promise<number[]> {
    return withLocalModelInferenceLease(async () => {
      const context = await this.ensureEmbeddingContext();
      try {
        const result = await context.embedding(text, { embd_normalize: 1 });
        return result.embedding;
      } catch (error) {
        await this.embeddingContext.invalidate((pending) => this.releaseContext(pending));
        throw error;
      }
    });
  }

  async dispose(): Promise<void> {
    await Promise.all([
      this.chatContext.invalidate((pending) => this.releaseContext(pending)),
      this.embeddingContext.invalidate((pending) => this.releaseContext(pending))
    ]);
  }

  private async runSafeChat(input: SafeChatInput, onToken?: (token: string) => void): Promise<SafeChatResult> {
    return withLocalModelInferenceLease(async () => {
    const manifest = await this.getAvailableManifest("chat");
    const settings = getLlamaContextSettingsForTier(manifest.modelTier, false);
    const outputTokens = safeChatOutputTokens(settings.nCtx, manifest.modelTier);
    const inputBudget = safeInputBudgetTokens(settings.nCtx, outputTokens);
    const tierInstruction = safeChatInstructionForTier(manifest.modelTier, input.chatRole);
    const instruction = manifest.modelTier === "tiny" || manifest.modelTier === "minimum"
      ? tierInstruction
      : input.instruction;
    // Keep the system message session-stable (instruction + app context only).
    // Per-message context goes into the user block instead, so consecutive
    // turns share a long token prefix and llama.cpp can reuse the KV cache
    // instead of re-prefilling the whole prompt every message.
    const systemContent = [
      instructionForManifest(instruction, manifest),
      input.appContext
    ]
      .filter(Boolean)
      .join("\n\n");
    const perMessageContext = [input.taskContext, input.profileContext]
      .filter(Boolean)
      .join("\n\n");

    const context = await this.ensureChatContext();
    const signal = input.abortSignal;
    const onAbort = () => {
      void context.stopCompletion();
    };
    if (signal) {
      signal.addEventListener("abort", onAbort);
    }

    try {
      if (signal?.aborted) {
        return {
          status: "refused",
          text: "",
          citationIds: [],
          providerId: this.id,
          providerName: this.name
        };
      }

      const tc = (text: string) => this.tokenizerTokenCount(context, text);
      const baseTokens =
        (await tc(systemContent)) +
        (await tc(perMessageContext)) +
        (await tc(input.question)) +
        (await tc(input.sourceReliable === undefined ? "" : "Source reliability: reliable")) +
        96;
      const baseContextUsage: LocalContextUsage = {
        contextFillRatio: Math.min(1, (baseTokens + outputTokens) / settings.nCtx),
        conversationTokens: 0,
        historyPruned: Boolean(input.conversationContext?.length),
        inputBudgetTokens: inputBudget,
        maxContextTokens: settings.nCtx,
        modelTier: manifest.modelTier,
        outputBudgetTokens: outputTokens,
        sourceTokens: 0,
        sourcesPruned: Boolean(input.sourceContext?.length),
        totalInputTokens: baseTokens
      };

      if (baseTokens >= inputBudget) {
        return {
          status: "input_too_large",
          text: "That message is too long for this phone's current local model context. Please shorten it or split it into smaller questions.",
          citationIds: [],
          contextUsage: baseContextUsage,
          providerId: this.id,
          providerName: this.name
        };
      }

      const conversationCap = Math.min(600, Math.floor(inputBudget * 0.35));
      const conversationContext = await pruneChatContextWithTokenizer(
        input.conversationContext ?? [],
        tc,
        conversationCap
      );
      let contextTokens = 0;
      for (const turn of conversationContext) {
        contextTokens += await tc(turn.text);
      }
      const sourceBudget = Math.max(0, Math.min(Math.floor(inputBudget * 0.4), inputBudget - baseTokens - contextTokens));
      const sourceContext = pruneSourcesForBudget(input.sourceContext, sourceBudget);
      const promptSources = sourceBlock(sourceContext);
      const sourceTokens = await tc(promptSources);
      const totalInputTokens = baseTokens + contextTokens + sourceTokens;
      const contextUsage: LocalContextUsage = {
        contextFillRatio: Math.min(1, (totalInputTokens + outputTokens) / settings.nCtx),
        conversationTokens: contextTokens,
        historyPruned: (input.conversationContext?.length ?? 0) > conversationContext.length,
        inputBudgetTokens: inputBudget,
        maxContextTokens: settings.nCtx,
        modelTier: manifest.modelTier,
        outputBudgetTokens: outputTokens,
        sourceTokens,
        sourcesPruned:
          (input.sourceContext?.length ?? 0) > (sourceContext?.length ?? 0) ||
          sourceBlock(input.sourceContext) !== promptSources,
        totalInputTokens
      };
      const userContent = [
        perMessageContext,
        promptSources,
        sourceContext?.length
          ? `Source reliability: ${input.sourceReliable ? "reliable" : "weak or uncertain"}`
          : "",
        input.capability === "instruction" && sourceContext?.length
          ? "Use the source steps directly. Output only the final student-facing numbered instructions; do not describe your reasoning or repeat your outline."
          : "",
        `Question: ${input.question}`
      ]
        .filter(Boolean)
        .join("\n\n");
      const startedAt = Date.now();
      const messages = [
        {
          role: "system" as const,
          content: systemContent
        },
        ...conversationMessages({ ...input, conversationContext }),
        {
          role: "user" as const,
          content: userContent
        }
      ];
      const streamAllowed = Boolean(onToken) && !thinkingDisabledForManifest(manifest);
      // Without streamed tokens there is no first-token signal, so only the
      // total deadline applies (non-streaming models prefill + generate in
      // one opaque native call).
      const watchdogBase = watchdogConfigForTier(manifest.modelTier);
      const watchdog = createInferenceWatchdog(
        streamAllowed && onToken
          ? watchdogBase
          : { ...watchdogBase, firstTokenDeadlineMs: watchdogBase.totalDeadlineMs },
        (reason) => {
          logger.ai.warn("llama.rn inference watchdog stopped a stalled completion.", {
            modelName: manifest.modelName,
            modelTier: manifest.modelTier,
            reason
          });
          void context.stopCompletion();
        }
      );
      // Runtime thermal guard: re-check device heat every ~24 streamed tokens.
      // A "serious" device may finish a short answer but long generations
      // stop early into the incomplete path (the user can tap Continue once
      // the phone cools); "critical" stops immediately.
      let streamedTokens = 0;
      let thermalCheckInFlight = false;
      let thermalStop: "serious" | "critical" | null = null;
      const maybeCheckThermal = () => {
        streamedTokens += 1;
        if (streamedTokens % 24 !== 0 || thermalCheckInFlight || thermalStop) return;
        thermalCheckInFlight = true;
        void getDeviceHardwareProfile()
          .then((profile) => {
            const state = profile.thermalState;
            const shouldStop =
              state === "critical" || (state === "serious" && streamedTokens > 64);
            if (shouldStop) {
              thermalStop = state as "serious" | "critical";
              logger.ai.warn("llama.rn generation stopped early due to device thermal state.", {
                modelTier: manifest.modelTier,
                streamedTokens,
                thermalState: state
              });
              void context.stopCompletion();
            }
          })
          .catch(() => undefined)
          .finally(() => {
            thermalCheckInFlight = false;
          });
      };
      const complete = async (retry = false) => {
        watchdog.stop();
        watchdog.start();
        try {
          return await context.completion(
            {
              messages,
              n_predict: safeChatOutputTokens(settings.nCtx, manifest.modelTier, retry),
              stop: STOP_WORDS,
              ...safeChatSamplingForScenario(input.scenario, retry)
            },
            streamAllowed && onToken && !retry
              ? (data: TokenData) => {
                  watchdog.onActivity();
                  maybeCheckThermal();
                  if (signal?.aborted) return;
                  if (data.token) onToken(data.token);
                }
              : undefined
          );
        } finally {
          watchdog.stop();
        }
      };
      let result = await complete(false);
      if (signal?.aborted) {
        const partial = sanitizeAssistantText(result.content || result.text);
        const { text: cleanedText, citationIds: footerIds } = extractCitationFooter(partial);
        const inlineIds = citationIdsFromText(cleanedText, sourceContext);
        const allowed = new Set((sourceContext ?? []).map((source) => source.citationId));
        const citationIds = Array.from(
          new Set([...footerIds, ...inlineIds].filter((id) => allowed.has(id)))
        );
        return {
          status: partial ? "ok" : "refused",
          text: cleanedText || partial || "Generation stopped.",
          citationIds,
          contextUsage,
          providerId: this.id,
          providerName: this.name
        };
      }
      if (thermalStop) {
        const partial = sanitizeAssistantText(result.content || result.text);
        const { text: cleanedText, citationIds: footerIds } = extractCitationFooter(partial);
        const inlineIds = citationIdsFromText(cleanedText, sourceContext);
        const allowed = new Set((sourceContext ?? []).map((source) => source.citationId));
        const citationIds = Array.from(
          new Set([...footerIds, ...inlineIds].filter((id) => allowed.has(id)))
        );
        return {
          status: partial ? "incomplete" : "refused",
          text:
            cleanedText ||
            partial ||
            "This phone is getting too warm to keep generating safely. Let it cool for a moment, then ask again.",
          citationIds,
          contextUsage,
          providerId: this.id,
          providerName: this.name
        };
      }
      if (watchdog.breached) {
        const partial = sanitizeAssistantText(result.content || result.text);
        const { text: cleanedText, citationIds: footerIds } = extractCitationFooter(partial);
        const inlineIds = citationIdsFromText(cleanedText, sourceContext);
        const allowed = new Set((sourceContext ?? []).map((source) => source.citationId));
        const citationIds = Array.from(
          new Set([...footerIds, ...inlineIds].filter((id) => allowed.has(id)))
        );
        return {
          status: partial ? "incomplete" : "refused",
          text:
            cleanedText ||
            partial ||
            "This answer took too long on this phone, so I stopped it. Please try again with a shorter question.",
          citationIds,
          contextUsage,
          providerId: this.id,
          providerName: this.name
        };
      }
      let text = sanitizeAssistantText(result.content || result.text);
      if (!signal?.aborted && isDegenerateAssistantText(text)) {
        logger.ai.warn("llama.rn generated repetitive safe-chat output; retrying with stricter sampling.", {
          modelTier: manifest.modelTier,
          modelName: manifest.modelName
        });
        result = await complete(true);
        text = sanitizeAssistantText(result.content || result.text);
      }
      this.lastInferenceTimeMs = Date.now() - startedAt;
      if (result.timings) {
        // cache_n counts prompt tokens served from the KV cache: it should be
        // near the full prefix length on turn 2+ now that the system prompt
        // and prior turns are byte-stable.
        logger.ai.log("llama.rn safe-chat timings.", {
          cachedPromptTokens: result.timings.cache_n,
          modelTier: manifest.modelTier,
          promptMs: Math.round(result.timings.prompt_ms),
          promptTokens: result.timings.prompt_n,
          tokensPerSecond: Math.round(result.timings.predicted_per_second * 10) / 10
        });
      }

      if (isDegenerateAssistantText(text)) {
        text = "I had trouble generating a clean answer. Please send the question again in one sentence, and I will answer directly.";
      }

      const { text: cleanedText, citationIds: footerIds } = extractCitationFooter(text);
      const inlineIds = citationIdsFromText(cleanedText, sourceContext);
      const allowed = new Set((sourceContext ?? []).map((source) => source.citationId));
      const citationIds = Array.from(
        new Set([...footerIds, ...inlineIds].filter((id) => allowed.has(id)))
      );

      const isIncomplete = isCompletionStoppedDueToTokenLimit(result.stopped_limit) || watchdog.breached;

      return {
        status: isIncomplete ? "incomplete" : cleanedText ? "ok" : "refused",
        text: cleanedText,
        citationIds,
        contextUsage,
        providerId: this.id,
        providerName: this.name
      };
    } catch (error) {
      await this.chatContext.invalidate((pending) => this.releaseContext(pending));
      throw error;
    } finally {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    }
    });
  }

  private async getAvailableManifest(role: LocalModelRole): Promise<LocalModelManifest> {
    const status = role === "chat" ? await getActiveChatModelStatus() : await getImportedModelStatus(role);
    if (!status.manifest || status.state !== "available") {
      throw new Error(status.rejectionReasons[0] ?? `No active llama.rn GGUF ${role} model is available.`);
    }

    return status.manifest;
  }

  private async ensureChatContext(): Promise<LlamaContext> {
    const status = await getActiveChatModelStatus();
    const modelKey = this.modelKey(status);
    if (!status.manifest || status.state !== "available" || !modelKey) {
      throw new Error(status.rejectionReasons[0] ?? "No active llama.rn GGUF chat model is available.");
    }

    return this.chatContext.get(
      modelKey,
      () => this.createContext(status.manifest!, false),
      (pending) => this.releaseContext(pending)
    );
  }

  private async ensureEmbeddingContext(): Promise<LlamaContext> {
    const status = await getImportedModelStatus("embedding");
    const modelKey = this.modelKey(status);
    if (!status.manifest || status.state !== "available" || !modelKey) {
      throw new Error(status.rejectionReasons[0] ?? "No imported llama.rn GGUF embedding model is available.");
    }

    return this.embeddingContext.get(
      modelKey,
      () => this.createContext(status.manifest!, true),
      (pending) => this.releaseContext(pending)
    );
  }

  private modelKey(status: ImportedModelStatus): string | null {
    return status.manifest
      ? status.manifest.fileHash ?? `${status.manifest.uri}:${status.manifest.sizeBytes}:${status.manifest.validatedAt}`
      : null;
  }

  private async tokenizerTokenCount(context: LlamaContext, text: string): Promise<number> {
    try {
      const raw = await context.tokenize(text);
      const tokens = (raw as { tokens?: unknown }).tokens;
      if (Array.isArray(tokens)) {
        return tokens.length;
      }
    } catch {
      // Native tokenizer unavailable; fall back to heuristic budgeting.
    }
    return estimateTokens(text);
  }

  private async releaseContext(contextPromise: Promise<LlamaContext>): Promise<void> {
    try {
      const context = await contextPromise;
      await context.release();
    } catch (error) {
      logger.ai.warn("llama.rn context release failed", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async createContext(manifest: LocalModelManifest, embedding: boolean): Promise<LlamaContext> {
    const [llama, hardware] = await Promise.all([loadLlamaRn(), getDeviceHardwareProfile()]);
    const settings = getLlamaContextSettingsForTier(manifest.modelTier, embedding, hardware.cpuCoreCount);
    const startedAt = Date.now();
    const context = await llama.initLlama({
      model: manifest.uri,
      embedding,
      n_ctx: settings.nCtx,
      n_batch: settings.nBatch,
      n_threads: settings.nThreads,
      use_mlock: false,
      use_mmap: true,
      cache_type_k: "q8_0",
      cache_type_v: "q8_0",
      flash_attn_type: "auto",
      ...executionOptionsForManifest(manifest)
    });
    this.modelLoadTimeMs = Date.now() - startedAt;
    return context;
  }
}
