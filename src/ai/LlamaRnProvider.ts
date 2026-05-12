import { Platform } from "react-native";

import type {
  LocalAICapabilities,
  LocalAIProvider,
  LocalSummaryResult,
  SafeChatInput,
  SafeChatResult,
  SourceChunkForSummary,
  SummarizeFromSourcesInput
} from "./LocalAIProvider";
import { unavailableCapabilities } from "./LocalAIProvider";
import { NO_RELIABLE_ANSWER, safeChatInstructionForTier } from "./prompts";
import { extractCitationFooter, sanitizeAssistantText } from "./providerUtils";
import { getDeviceHardwareProfile } from "./deviceHardwareProfile";
import {
  deviceCapabilityClassForTier,
  getLlamaContextSettingsForTier,
  recommendedDeviceModelTier
} from "./localModelMetadata";
import type { ImportedModelStatus, LocalModelManifest, LocalModelRole } from "./localModelManager";
import { ensureBundledDefaultChatModel, getImportedModelStatus, getLocalModelDirectoryUri } from "./localModelManager";
import { loadLlamaRn } from "./llamaRnRuntime";
import { isDegenerateAssistantText } from "./outputQuality";
import {
  estimateTokens,
  pruneChatContextWithTokenizer,
  pruneSourcesForBudget,
  safeInputBudgetTokens,
  safeOutputTokens
} from "./tokenBudget";
import { isCompletionStoppedDueToTokenLimit } from "./llamaStoppedLimit";
import { logger } from "@/utils/logger";

import type { CompletionParams, LlamaContext, TokenData } from "llama.rn";

const STOP_WORDS = [
  "</s>",
  "<|end|>",
  "<|eot_id|>",
  "<|end_of_text|>",
  "<|im_end|>",
  "<|EOT|>",
  "<|end_of_turn|>",
  "<|endoftext|>"
];

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

function conversationMessages(input: SafeChatInput) {
  return (input.conversationContext ?? []).map((turn) => ({
    role: turn.sender === "user" ? "user" as const : "assistant" as const,
    content: turn.text
  }));
}

function citationIdsFromText(text: string, sources: SourceChunkForSummary[] | undefined): string[] {
  if (!sources?.length) return [];
  return sources
    .map((source) => source.citationId)
    .filter((citationId) => text.includes(citationId) || text.includes(`[${citationId}]`));
}

function isNoReliableAnswer(text: string): boolean {
  return text.trim().toUpperCase().includes(NO_RELIABLE_ANSWER);
}

function safeChatOutputTokens(nCtx: number, tier: LocalModelManifest["modelTier"], retry = false): number {
  const base = safeOutputTokens(nCtx, "safe-chat");
  const tierCap = tier === "tiny" ? 192 : tier === "minimum" ? 224 : base;
  const capped = Math.min(base, tierCap);
  return retry ? Math.max(128, Math.floor(capped * 0.72)) : capped;
}

function safeChatSampling(retry = false): Partial<CompletionParams> {
  return retry
    ? {
        temperature: 0.25,
        top_k: 32,
        top_p: 0.82,
        min_p: 0.08,
        penalty_last_n: 192,
        penalty_repeat: 1.22,
        penalty_freq: 0.25,
        penalty_present: 0.1,
        dry_multiplier: 1,
        dry_base: 1.75,
        dry_allowed_length: 2,
        dry_penalty_last_n: 192
      }
    : {
        temperature: 0.45,
        top_k: 40,
        top_p: 0.88,
        min_p: 0.05,
        penalty_last_n: 128,
        penalty_repeat: 1.15,
        penalty_freq: 0.15,
        penalty_present: 0,
        dry_multiplier: 0.7,
        dry_base: 1.75,
        dry_allowed_length: 2,
        dry_penalty_last_n: 128
      };
}

/**
 * Returns scenario-tuned sampling parameters for safe-chat completions.
 * Factual/procedural questions use lower temperature for accuracy.
 * Creative scenarios use higher temperature for variety.
 * Coding uses near-zero temperature for correctness.
 * Falls back to the default safe-chat profile for unrecognised scenarios.
 */
function safeChatSamplingForScenario(scenario: string | undefined, retry = false): Partial<CompletionParams> {
  if (retry) return safeChatSampling(true);

  switch (scenario) {
    case "coding_help":
      return {
        temperature: 0.1,
        top_k: 20,
        top_p: 0.9,
        min_p: 0.05,
        penalty_last_n: 128,
        penalty_repeat: 1.1,
        penalty_freq: 0.1,
        penalty_present: 0,
        dry_multiplier: 0.5,
        dry_base: 1.75,
        dry_allowed_length: 2,
        dry_penalty_last_n: 128
      };
    case "student_admin":
    case "campus_office":
    case "academic_support":
    case "wellbeing_safety":
      return {
        temperature: 0.15,
        top_k: 30,
        top_p: 0.9,
        min_p: 0.05,
        penalty_last_n: 128,
        penalty_repeat: 1.12,
        penalty_freq: 0.1,
        penalty_present: 0,
        dry_multiplier: 0.6,
        dry_base: 1.75,
        dry_allowed_length: 2,
        dry_penalty_last_n: 128
      };
    case "creative_brainstorm":
    case "off_topic_silly":
      return {
        temperature: 0.65,
        top_k: 50,
        top_p: 0.92,
        min_p: 0.04,
        penalty_last_n: 64,
        penalty_repeat: 1.1,
        penalty_freq: 0.1,
        penalty_present: 0,
        dry_multiplier: 0.5,
        dry_base: 1.75,
        dry_allowed_length: 2,
        dry_penalty_last_n: 64
      };
    default:
      return safeChatSampling(false);
  }
}

export class LlamaRnProvider implements LocalAIProvider {
  readonly id = "llama-rn" as const;
  readonly name = "llama.rn GGUF";

  private chatContextPromise: Promise<LlamaContext> | null = null;
  private embeddingContextPromise: Promise<LlamaContext> | null = null;
  private chatModelKey: string | null = null;
  private embeddingModelKey: string | null = null;
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
    const [runtimeAvailable, chatStatus] = await Promise.all([
      this.runtimeAvailable(),
      ensureBundledDefaultChatModel()
    ]);

    return runtimeAvailable && chatStatus.state === "available";
  }

  async getCapabilities(): Promise<LocalAICapabilities> {
    const minimumOS = "Android arm64-v8a/x86_64 or iOS with llama.rn native runtime";
    const modelDirectory = getLocalModelDirectoryUri();
    if (!this.platformSupported()) {
      return unavailableCapabilities(["llama.rn is available only on native Android and iOS builds."], minimumOS);
    }

    const backendDevices = await this.getBackendDevices();
    const [chatStatus, embeddingStatus, hardware] = await Promise.all([
      ensureBundledDefaultChatModel(),
      getImportedModelStatus("embedding"),
      getDeviceHardwareProfile(backendDevices ?? [])
    ]);
    const runtimeAvailable = backendDevices !== null;
    const manifest = chatStatus.manifest;
    const modelAssetsAvailable = chatStatus.state === "available";
    const recommendedModelTier = manifest?.recommendedModelTier ?? recommendedDeviceModelTier(hardware);
    const contextSettings = manifest ? getLlamaContextSettingsForTier(manifest.modelTier, false) : null;
    const maxOutputTokens = contextSettings ? safeOutputTokens(contextSettings.nCtx, "safe-chat") : null;
    const modelRejectionReasons = [
      ...chatStatus.rejectionReasons,
      ...(embeddingStatus.state === "rejected" ? embeddingStatus.rejectionReasons : [])
    ];
    const unavailableReasons = [
      ...(runtimeAvailable ? [] : ["llama.rn native runtime is unavailable. Rebuild the custom native app after adding the plugin."]),
      ...(modelAssetsAvailable
        ? []
        : chatStatus.rejectionReasons.length > 0
          ? chatStatus.rejectionReasons
          : [`No imported GGUF chat model found. Import one from Settings into ${modelDirectory ?? "the app document models directory"}.`])
    ];

    return {
      summary: runtimeAvailable && modelAssetsAvailable,
      safeChat: runtimeAvailable && modelAssetsAvailable,
      embeddings: runtimeAvailable && embeddingStatus.state === "available",
      reranking: false,
      providerReady: runtimeAvailable && modelAssetsAvailable,
      requiresCustomDevBuild: true,
      minimumOS,
      modelAssetsAvailable,
      modelName: manifest?.modelName ?? null,
      modelParameterCountB: manifest?.modelParameterCountB ?? null,
      modelQuantization: manifest?.modelQuantization ?? null,
      modelTier: manifest?.modelTier ?? "unknown",
      recommendedModelTier,
      bridgePresent: runtimeAvailable,
      modelAssetPath: manifest?.uri ?? null,
      modelManifestPath: manifest?.manifestPath ?? chatStatus.manifestPath ?? null,
      modelImportStatus: runtimeAvailable ? chatStatus.state : "runtime_unavailable",
      modelFileHash: manifest?.fileHash ?? null,
      modelRejectionReasons,
      modelLoadTimeMs: this.modelLoadTimeMs,
      lastInferenceTimeMs: this.lastInferenceTimeMs,
      contextWindowTokens: contextSettings?.nCtx ?? null,
      safeInputBudgetTokens: contextSettings && maxOutputTokens ? safeInputBudgetTokens(contextSettings.nCtx, maxOutputTokens) : null,
      maxOutputTokens,
      streamingSupported: runtimeAvailable && modelAssetsAvailable,
      approximateDeviceCapability: modelAssetsAvailable ? deviceCapabilityClassForTier(manifest?.modelTier ?? "unknown") : "unknown",
      architecture: hardware.architecture,
      freeStorageGB: hardware.freeStorageGB,
      memoryGB: hardware.memoryGB,
      memoryClass: hardware.memoryClass,
      unavailableReasons,
      notes: [
        "llama.rn uses local GGUF models and is the Off Grid-style provider path.",
        "Import a chat GGUF from Settings; Haki copies it into app-private storage and validates it before activation.",
        "Haki refuses to activate oversized GGUF models when Android RAM, ABI, or free storage do not match the detected model tier.",
        "Embedding GGUF files are supported by the manifest path but chat GGUF is the primary Android local AI path."
      ]
    };
  }

  async summarizeFromSources(input: SummarizeFromSourcesInput): Promise<LocalSummaryResult> {
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
          content: input.instruction
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
  }

  async answerSafeChat(input: SafeChatInput): Promise<SafeChatResult> {
    return this.runSafeChat(input);
  }

  /**
   * Eager model load. Fire-and-forget from the chat screen; swallows errors so
   * mount-time warmup never crashes the UI.
   */
  async prewarm(): Promise<void> {
    try {
      await this.ensureChatContext();
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
    const context = await this.ensureEmbeddingContext();
    const result = await context.embedding(text, { embd_normalize: 1 });
    return result.embedding;
  }

  async dispose(): Promise<void> {
    const contextPromises = [this.chatContextPromise, this.embeddingContextPromise];
    this.chatContextPromise = null;
    this.embeddingContextPromise = null;
    this.chatModelKey = null;
    this.embeddingModelKey = null;

    await Promise.all(
      contextPromises.map(async (contextPromise) => {
        if (!contextPromise) {
          return;
        }

        await this.releaseContext(contextPromise);
      })
    );
  }

  private async runSafeChat(input: SafeChatInput, onToken?: (token: string) => void): Promise<SafeChatResult> {
    const manifest = await this.getAvailableManifest("chat");
    const settings = getLlamaContextSettingsForTier(manifest.modelTier, false);
    const outputTokens = safeChatOutputTokens(settings.nCtx, manifest.modelTier);
    const inputBudget = safeInputBudgetTokens(settings.nCtx, outputTokens);
    const tierInstruction = safeChatInstructionForTier(manifest.modelTier);
    const instruction = manifest.modelTier === "tiny" || manifest.modelTier === "minimum"
      ? tierInstruction
      : input.instruction;
    const systemContent = [
      instruction,
      input.appContext,
      input.taskContext,
      input.profileContext
    ]
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
        (await tc(input.question)) +
        (await tc(input.sourceReliable === undefined ? "" : "Source reliability: reliable")) +
        96;

      if (baseTokens >= inputBudget) {
        return {
          status: "input_too_large",
          text: "That message is too long for this phone's current local model context. Please shorten it or split it into smaller questions.",
          citationIds: [],
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
      const userContent = [
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
      const complete = async (retry = false) =>
        context.completion(
          {
            messages,
            n_predict: safeChatOutputTokens(settings.nCtx, manifest.modelTier, retry),
            stop: STOP_WORDS,
            ...safeChatSamplingForScenario(input.scenario, retry)
          },
          onToken && !retry
            ? (data: TokenData) => {
                if (signal?.aborted) return;
                if (data.token) onToken(data.token);
              }
            : undefined
        );
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

      if (isDegenerateAssistantText(text)) {
        text = "I had trouble generating a clean answer. Please send the question again in one sentence, and I will answer directly.";
      }

      const { text: cleanedText, citationIds: footerIds } = extractCitationFooter(text);
      const inlineIds = citationIdsFromText(cleanedText, sourceContext);
      const allowed = new Set((sourceContext ?? []).map((source) => source.citationId));
      const citationIds = Array.from(
        new Set([...footerIds, ...inlineIds].filter((id) => allowed.has(id)))
      );

      const isIncomplete = isCompletionStoppedDueToTokenLimit(result.stopped_limit);

      return {
        status: isIncomplete ? "incomplete" : cleanedText ? "ok" : "refused",
        text: cleanedText,
        citationIds,
        providerId: this.id,
        providerName: this.name
      };
    } finally {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    }
  }

  private async getAvailableManifest(role: LocalModelRole): Promise<LocalModelManifest> {
    const status = role === "chat" ? await ensureBundledDefaultChatModel() : await getImportedModelStatus(role);
    if (!status.manifest || status.state !== "available") {
      throw new Error(status.rejectionReasons[0] ?? `No imported llama.rn GGUF ${role} model is available.`);
    }

    return status.manifest;
  }

  private async ensureChatContext(): Promise<LlamaContext> {
    const status = await ensureBundledDefaultChatModel();
    const modelKey = this.modelKey(status);
    if (!status.manifest || status.state !== "available" || !modelKey) {
      throw new Error(status.rejectionReasons[0] ?? "No imported llama.rn GGUF chat model is available.");
    }

    if (this.chatContextPromise && this.chatModelKey !== modelKey) {
      await this.releaseContext(this.chatContextPromise);
      this.chatContextPromise = null;
    }

    this.chatModelKey = modelKey;
    this.chatContextPromise ??= this.createContext(status.manifest, false);
    return this.chatContextPromise;
  }

  private async ensureEmbeddingContext(): Promise<LlamaContext> {
    const status = await getImportedModelStatus("embedding");
    const modelKey = this.modelKey(status);
    if (!status.manifest || status.state !== "available" || !modelKey) {
      throw new Error(status.rejectionReasons[0] ?? "No imported llama.rn GGUF embedding model is available.");
    }

    if (this.embeddingContextPromise && this.embeddingModelKey !== modelKey) {
      await this.releaseContext(this.embeddingContextPromise);
      this.embeddingContextPromise = null;
    }

    this.embeddingModelKey = modelKey;
    this.embeddingContextPromise ??= this.createContext(status.manifest, true);
    return this.embeddingContextPromise;
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
    const llama = await loadLlamaRn();
    const settings = getLlamaContextSettingsForTier(manifest.modelTier, embedding);
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
      flash_attn_type: "auto"
    });
    this.modelLoadTimeMs = Date.now() - startedAt;
    return context;
  }
}
