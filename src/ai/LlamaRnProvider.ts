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
import { NO_RELIABLE_ANSWER } from "./prompts";
import { sanitizeAssistantText } from "./providerUtils";
import { getDeviceHardwareProfile } from "./deviceHardwareProfile";
import {
  deviceCapabilityClassForTier,
  getLlamaContextSettingsForTier,
  recommendedDeviceModelTier
} from "./localModelMetadata";
import type { ImportedModelStatus, LocalModelManifest, LocalModelRole } from "./localModelManager";
import { getImportedModelStatus, getLocalModelDirectoryUri } from "./localModelManager";
import { logger } from "@/utils/logger";

import type { LlamaContext, TokenData } from "llama.rn";

type LlamaRnModule = typeof import("llama.rn");

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

let llamaModulePromise: Promise<LlamaRnModule> | null = null;

async function loadLlamaRn(): Promise<LlamaRnModule> {
  llamaModulePromise ??= import("llama.rn");
  return llamaModulePromise;
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

function conversationMessages(input: SafeChatInput) {
  return (input.conversationContext ?? []).map((turn) => ({
    role: turn.sender === "user" ? "user" : "assistant",
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
      getImportedModelStatus("chat")
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
      getImportedModelStatus("chat"),
      getImportedModelStatus("embedding"),
      getDeviceHardwareProfile(backendDevices ?? [])
    ]);
    const runtimeAvailable = backendDevices !== null;
    const manifest = chatStatus.manifest;
    const modelAssetsAvailable = chatStatus.state === "available";
    const recommendedModelTier = manifest?.recommendedModelTier ?? recommendedDeviceModelTier(hardware);
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
      modelManifestPath: manifest?.manifestPath ?? chatStatus.manifestPath,
      modelImportStatus: runtimeAvailable ? chatStatus.state : "runtime_unavailable",
      modelFileHash: manifest?.fileHash ?? null,
      modelRejectionReasons,
      modelLoadTimeMs: this.modelLoadTimeMs,
      lastInferenceTimeMs: this.lastInferenceTimeMs,
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
    const context = await this.ensureChatContext();
    const promptSources = sourceBlock(input.sources);
    const startedAt = Date.now();
    const result = await context.completion({
      messages: [
        {
          role: "system",
          content: input.instruction
        },
        {
          role: "user",
          content: `${promptSources}\n\nQuestion: ${input.question}\n\nWrite the answer and include the citation IDs used.`
        }
      ],
      n_predict: 360,
      temperature: 0.2,
      top_p: 0.9,
      stop: STOP_WORDS
    });
    this.lastInferenceTimeMs = Date.now() - startedAt;

    const text = sanitizeAssistantText(result.content || result.text);
    const citationIds = citationIdsFromText(text, input.sources);
    if (!text || isNoReliableAnswer(text) || citationIds.length === 0) {
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
      text,
      citationIds,
      providerId: this.id,
      providerName: this.name
    };
  }

  async answerSafeChat(input: SafeChatInput): Promise<SafeChatResult> {
    return this.runSafeChat(input);
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
    const context = await this.ensureChatContext();
    const promptSources = sourceBlock(input.sourceContext);
    const userContent = [
      promptSources,
      input.sourceContext?.length
        ? `Source reliability: ${input.sourceReliable ? "reliable" : "weak or uncertain"}`
        : "",
      `Question: ${input.question}`
    ]
      .filter(Boolean)
      .join("\n\n");
    const startedAt = Date.now();
    const result = await context.completion(
      {
        messages: [
          {
            role: "system",
            content: `${input.instruction}\n\n${input.appContext}`
          },
          ...conversationMessages(input),
          {
            role: "user",
            content: userContent
          }
        ],
        n_predict: 640,
        temperature: 0.4,
        top_p: 0.9,
        stop: STOP_WORDS
      },
      onToken
        ? (data: TokenData) => {
            if (data.token) onToken(data.token);
          }
        : undefined
    );
    this.lastInferenceTimeMs = Date.now() - startedAt;

    const text = sanitizeAssistantText(result.content || result.text);
    return {
      status: text ? "ok" : "refused",
      text,
      citationIds: citationIdsFromText(text, input.sourceContext),
      providerId: this.id,
      providerName: this.name
    };
  }

  private async ensureChatContext(): Promise<LlamaContext> {
    const status = await getImportedModelStatus("chat");
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
    return status.manifest?.fileHash ?? status.manifest?.uri ?? null;
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
