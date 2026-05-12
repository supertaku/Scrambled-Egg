import type { LocalModelTier } from "./LocalAIProvider";
import type { NormalizedPlatform } from "./providerUtils";

const ANDROID_MODEL_TIER_ORDER = ["tiny", "minimum", "good", "enhanced", "flagship"] as const;
type AndroidLocalModelTier = (typeof ANDROID_MODEL_TIER_ORDER)[number];

const ANDROID_MODEL_TIER_RANK: Record<AndroidLocalModelTier, number> = {
  tiny: 1,
  minimum: 2,
  good: 3,
  enhanced: 4,
  flagship: 5
};

const ANDROID_MODEL_TIERS = {
  tiny: {
    label: "Tiny local AI",
    minimumRamGB: 4,
    minimumFreeStorageGB: 3,
    minimumModelParametersB: 0.5,
    maximumModelParametersB: 1.5
  },
  minimum: {
    label: "Minimum local AI",
    minimumRamGB: 6,
    minimumFreeStorageGB: 4,
    minimumModelParametersB: 1,
    maximumModelParametersB: 3
  },
  good: {
    label: "Good local AI",
    minimumRamGB: 8,
    minimumFreeStorageGB: 6,
    minimumModelParametersB: 3,
    maximumModelParametersB: 4
  },
  enhanced: {
    label: "Enhanced local AI",
    minimumRamGB: 12,
    minimumFreeStorageGB: 10,
    minimumModelParametersB: 4,
    maximumModelParametersB: 7
  },
  flagship: {
    label: "Flagship local AI",
    minimumRamGB: 16,
    minimumFreeStorageGB: 12,
    minimumModelParametersB: 7,
    maximumModelParametersB: 8
  }
} as const;

const QUANTIZATION_KEYWORDS = ["int4", "q4", "4-bit", "4bit", "int8", "q8", "8-bit", "8bit", "quantized"];

function parseSizeToGB(value: number | string | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(gb|gib|mb|mib)?/);
  if (!match?.[1]) {
    return null;
  }

  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) {
    return null;
  }

  const unit = match[2] ?? "gb";
  return unit === "mb" || unit === "mib" ? amount / 1024 : amount;
}

function hasArm64Abi(architecture: string | string[] | null | undefined): boolean {
  const values = Array.isArray(architecture) ? architecture : architecture ? [architecture] : [];
  return values.some((value) => {
    const normalized = value.toLowerCase();
    return normalized.includes("arm64") || normalized.includes("aarch64");
  });
}

function isQuantizedModel(quantization: string | null | undefined): boolean {
  if (!quantization) {
    return false;
  }

  const normalized = quantization.toLowerCase();
  return QUANTIZATION_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isAndroidLocalModelTier(tier: LocalModelTier): tier is AndroidLocalModelTier {
  return ANDROID_MODEL_TIER_ORDER.includes(tier as AndroidLocalModelTier);
}

function getAndroidModelTierRequirements(tier: LocalModelTier) {
  return isAndroidLocalModelTier(tier) ? ANDROID_MODEL_TIERS[tier] : null;
}

function getModelTierForParameterCount(parameterCountB: number | null | undefined): LocalModelTier {
  if (parameterCountB === null || parameterCountB === undefined || !Number.isFinite(parameterCountB)) {
    return "unknown";
  }

  for (const tier of [...ANDROID_MODEL_TIER_ORDER].reverse()) {
    const requirement = ANDROID_MODEL_TIERS[tier];
    if (
      parameterCountB >= requirement.minimumModelParametersB &&
      parameterCountB <= requirement.maximumModelParametersB
    ) {
      return tier;
    }
  }

  return "unknown";
}

export type LocalModelRole = "chat" | "embedding";

export type ChatTemplateFamily = "llama" | "qwen" | "gemma" | "phi" | "unknown";
export type ChatTemplateValidationStatus = "supported" | "unknown" | "mismatch";

export interface ChatTemplateValidation {
  status: ChatTemplateValidationStatus;
  modelFamily: ChatTemplateFamily;
  templateFamily: ChatTemplateFamily;
  reason: string;
  modelFamilySource: "gguf-metadata" | "model-name" | "filename" | "unknown";
  templateFamilySource: "gguf-metadata" | "unknown";
}

export interface DeviceHardwareProfile {
  platform: NormalizedPlatform;
  osVersion: string;
  supportedAbis: string[];
  architecture: string | null;
  memoryGB: number | null;
  memoryClass: string | null;
  lowMemory: boolean | null;
  freeStorageGB: number | null;
  backendDevices: string[];
}

export interface LocalModelMetadata {
  modelName: string;
  modelParameterCountB: number | null;
  modelQuantization: string | null;
  modelTier: LocalModelTier;
  chatTemplate: ChatTemplateValidation;
  rawInfo: Record<string, unknown> | null;
}

export interface LocalModelManifest {
  version: 1;
  role: LocalModelRole;
  source?: "bundled" | "downloaded" | "imported" | undefined;
  sourceId?: string | undefined;
  downloadId?: string | undefined;
  originalName: string;
  storedName: string;
  uri: string;
  sizeBytes: number;
  fileHash: string | null;
  fileHashAlgorithm: "md5" | null;
  modelName: string;
  modelParameterCountB: number | null;
  modelQuantization: string | null;
  modelTier: LocalModelTier;
  chatTemplate?: ChatTemplateValidation;
  recommendedModelTier: LocalModelTier;
  importedAt: string;
  validatedAt: string;
  manifestPath: string;
  rejectionReasons: string[];
  rawInfo?: Record<string, unknown>;
}

export type ImportedModelState = "missing" | "available" | "rejected";

export interface ImportedModelStatus {
  role: LocalModelRole;
  state: ImportedModelState;
  modelDirectory: string | null;
  manifestPath: string | null;
  manifest: LocalModelManifest | null;
  rejectionReasons: string[];
}

export interface LlamaContextSettings {
  nCtx: number;
  nBatch: number;
  nThreads: number;
}

export interface BuildManifestInput {
  role: LocalModelRole;
  source?: LocalModelManifest["source"];
  sourceId?: string | undefined;
  downloadId?: string | undefined;
  originalName: string;
  storedName: string;
  uri: string;
  manifestPath: string;
  sizeBytes: number;
  fileHash: string | null;
  metadata: LocalModelMetadata;
  hardware: DeviceHardwareProfile;
  now: string;
}

export function canonicalModelFileName(role: LocalModelRole): string {
  return role === "chat" ? "haki-chat.gguf" : "haki-embed.gguf";
}

export function manifestFileName(role: LocalModelRole): string {
  return role === "chat" ? "chat-model-manifest.json" : "embedding-model-manifest.json";
}

export function isGgufFileName(name: string | null | undefined): boolean {
  return Boolean(name?.trim().toLowerCase().endsWith(".gguf"));
}

export function parseParameterCountBFromText(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*b(?:[^a-z0-9]|$)/i);
  if (!match?.[1]) return null;

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseQuantizationFromText(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/\b(q[2-8](?:_[0-9a-z]+)*|iq[1-4](?:_[a-z0-9]+)*|int[48]|4bit|8bit)\b/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function inferChatTemplateFamilyFromText(value: string | null | undefined): ChatTemplateFamily {
  if (!value) return "unknown";

  const normalized = value.toLowerCase();
  if (
    normalized.includes("<|start_header_id|>") ||
    normalized.includes("<|end_header_id|>") ||
    normalized.includes("llama") ||
    normalized.includes("[inst]") ||
    normalized.includes("<<sys>>")
  ) {
    return "llama";
  }

  if (
    normalized.includes("<|im_start|>") ||
    normalized.includes("<|im_end|>") ||
    normalized.includes("qwen") ||
    normalized.includes("chatml")
  ) {
    return "qwen";
  }

  if (
    normalized.includes("<start_of_turn>") ||
    normalized.includes("<end_of_turn>") ||
    normalized.includes("gemma")
  ) {
    return "gemma";
  }

  if (
    normalized.includes("<|system|>") ||
    normalized.includes("<|user|>") ||
    normalized.includes("<|assistant|>") ||
    normalized.includes("<|end|>") ||
    /\bphi[-_\s]?[34]?\b/.test(normalized)
  ) {
    return "phi";
  }

  return "unknown";
}

export function inferModelFamilyFromText(value: string | null | undefined): ChatTemplateFamily {
  if (!value) return "unknown";

  const normalized = value.toLowerCase();
  if (/\bqwen(?:[23]|2\.5|3)?\b/.test(normalized) || normalized.includes("qwen")) {
    return "qwen";
  }

  if (/\bllama(?:[-_\s]?[23](?:\.\d+)?)?\b/.test(normalized) || normalized.includes("meta-llama")) {
    return "llama";
  }

  if (/\bgemma(?:[-_\s]?[23])?\b/.test(normalized)) {
    return "gemma";
  }

  if (/\bphi(?:[-_\s]?[34](?:\.\d+)?)?\b/.test(normalized)) {
    return "phi";
  }

  return "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function flattenModelInfo(value: unknown, prefix = "", output: Array<[string, unknown]> = []): Array<[string, unknown]> {
  if (!isRecord(value)) {
    return output;
  }

  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    output.push([path, entry]);
    if (isRecord(entry)) {
      flattenModelInfo(entry, path, output);
    }
  }

  return output;
}

function firstStringFromInfo(info: Record<string, unknown> | null, patterns: RegExp[]): string | null {
  if (!info) return null;
  for (const [key, value] of flattenModelInfo(info)) {
    if (typeof value === "string" && patterns.some((pattern) => pattern.test(key))) {
      return value;
    }
  }

  return null;
}

function allStringsFromInfo(info: Record<string, unknown> | null, patterns: RegExp[]): string[] {
  if (!info) return [];
  const values: string[] = [];
  for (const [key, value] of flattenModelInfo(info)) {
    if (typeof value === "string" && patterns.some((pattern) => pattern.test(key))) {
      values.push(value);
    }
  }

  return values;
}

function firstNumberFromInfo(info: Record<string, unknown> | null, patterns: RegExp[]): number | null {
  if (!info) return null;
  for (const [key, value] of flattenModelInfo(info)) {
    if (!patterns.some((pattern) => pattern.test(key))) {
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function normalizeParameterCount(value: number | null): number | null {
  if (value === null) return null;
  if (value > 1_000_000) {
    return Number((value / 1_000_000_000).toFixed(2));
  }

  if (value > 1000) {
    return Number((value / 1000).toFixed(2));
  }

  return Number(value.toFixed(2));
}

function firstKnownModelFamily(
  candidates: Array<{ value: string | null | undefined; source: ChatTemplateValidation["modelFamilySource"] }>
): Pick<ChatTemplateValidation, "modelFamily" | "modelFamilySource"> {
  for (const candidate of candidates) {
    const modelFamily = inferModelFamilyFromText(candidate.value);
    if (modelFamily !== "unknown") {
      return { modelFamily, modelFamilySource: candidate.source };
    }
  }

  return { modelFamily: "unknown", modelFamilySource: "unknown" };
}

function firstKnownTemplateFamily(
  candidates: string[]
): Pick<ChatTemplateValidation, "templateFamily" | "templateFamilySource"> {
  for (const candidate of candidates) {
    const templateFamily = inferChatTemplateFamilyFromText(candidate);
    if (templateFamily !== "unknown") {
      return { templateFamily, templateFamilySource: "gguf-metadata" };
    }
  }

  return { templateFamily: "unknown", templateFamilySource: "unknown" };
}

export function inferChatTemplateValidation(input: {
  rawInfo?: Record<string, unknown> | null;
  modelName?: string | null;
  fileName?: string | null;
}): ChatTemplateValidation {
  const rawInfo = input.rawInfo ?? null;
  const metadataModelText = [
    ...allStringsFromInfo(rawInfo, [/general\.architecture$/i, /architecture$/i]),
    ...allStringsFromInfo(rawInfo, [/general\.name$/i, /model\.name$/i])
  ].join(" ");
  const chatTemplateTextValues = allStringsFromInfo(rawInfo, [/chat_?template$/i, /chat.*template/i]);
  const { modelFamily, modelFamilySource } = firstKnownModelFamily([
    { value: metadataModelText, source: "gguf-metadata" },
    { value: input.modelName, source: "model-name" },
    { value: input.fileName, source: "filename" }
  ]);
  const { templateFamily, templateFamilySource } = firstKnownTemplateFamily(chatTemplateTextValues);

  if (modelFamily !== "unknown" && templateFamily !== "unknown" && modelFamily !== templateFamily) {
    return {
      status: "mismatch",
      modelFamily,
      templateFamily,
      reason: `Model family appears to be ${modelFamily}, but GGUF chat template appears to be ${templateFamily}.`,
      modelFamilySource,
      templateFamilySource
    };
  }

  if (templateFamily !== "unknown") {
    return {
      status: "supported",
      modelFamily,
      templateFamily,
      reason:
        modelFamily === "unknown"
          ? `GGUF chat template appears to use the supported ${templateFamily} format.`
          : `GGUF chat template appears compatible with the ${modelFamily} model family.`,
      modelFamilySource,
      templateFamilySource
    };
  }

  if (modelFamily !== "unknown") {
    return {
      status: "unknown",
      modelFamily,
      templateFamily,
      reason: `Model family appears to be ${modelFamily}, but GGUF chat template metadata was not found or was not recognized.`,
      modelFamilySource,
      templateFamilySource
    };
  }

  return {
    status: "unknown",
    modelFamily,
    templateFamily,
    reason: "Model family and GGUF chat template metadata could not be recognized.",
    modelFamilySource,
    templateFamilySource
  };
}

export function deriveModelMetadata(input: {
  originalName: string;
  modelInfo?: unknown;
}): LocalModelMetadata {
  const rawInfo = isRecord(input.modelInfo) ? input.modelInfo : null;
  const infoName = firstStringFromInfo(rawInfo, [/general\.name$/i, /model\.name$/i, /name$/i]);
  const modelName = infoName?.trim() || input.originalName.trim();
  const rawParameterCount = firstNumberFromInfo(rawInfo, [/n_?params$/i, /parameter.*count/i, /params$/i]);
  const modelParameterCountB =
    normalizeParameterCount(rawParameterCount) ??
    parseParameterCountBFromText(modelName) ??
    parseParameterCountBFromText(input.originalName);
  const fileType = firstStringFromInfo(rawInfo, [/file.*type/i, /quant/i]);
  const modelQuantization =
    parseQuantizationFromText(fileType) ??
    parseQuantizationFromText(modelName) ??
    parseQuantizationFromText(input.originalName) ??
    "gguf-quantized";
  const chatTemplate = inferChatTemplateValidation({
    rawInfo,
    modelName,
    fileName: input.originalName
  });

  return {
    modelName,
    modelParameterCountB,
    modelQuantization,
    modelTier: getModelTierForParameterCount(modelParameterCountB),
    chatTemplate,
    rawInfo
  };
}

export function recommendedDeviceModelTier(hardware: Pick<DeviceHardwareProfile, "freeStorageGB" | "memoryGB">): LocalModelTier {
  for (const tier of [...ANDROID_MODEL_TIER_ORDER].reverse()) {
    const requirement = ANDROID_MODEL_TIERS[tier];
    if (
      hardware.memoryGB !== null &&
      hardware.memoryGB >= requirement.minimumRamGB &&
      hardware.freeStorageGB !== null &&
      hardware.freeStorageGB >= requirement.minimumFreeStorageGB
    ) {
      return tier;
    }
  }

  return "unknown";
}

export function validateImportedModel(input: {
  fileName: string;
  role: LocalModelRole;
  metadata: LocalModelMetadata;
  sizeBytes: number | null;
  hardware: DeviceHardwareProfile;
}): string[] {
  const reasons: string[] = [];
  const { hardware, metadata } = input;

  if (!isGgufFileName(input.fileName)) {
    reasons.push("Imported local models must use the .gguf file extension.");
  }

  if (input.sizeBytes !== null && input.sizeBytes <= 0) {
    reasons.push("Imported model file is empty.");
  }

  if (input.role === "chat") {
    if (!isAndroidLocalModelTier(metadata.modelTier)) {
      reasons.push("Chat model filename or metadata must report a supported parameter tier such as 0.6B, 1.5B, 3B, 4B, or 7B.");
    }

    if (!isQuantizedModel(metadata.modelQuantization)) {
      reasons.push("Chat model must be a quantized GGUF build such as q4, q5, q8, int4, or int8.");
    }

    if (metadata.chatTemplate.status === "mismatch") {
      reasons.push(`Chat model template mismatch: ${metadata.chatTemplate.reason}`);
    }
  }

  if (hardware.platform === "android" && !hasArm64Abi(hardware.supportedAbis)) {
    reasons.push("Android local AI requires an arm64-v8a capable device.");
  }

  const tierRequirements = getAndroidModelTierRequirements(metadata.modelTier);
  if (input.role === "chat" && tierRequirements) {
    if (hardware.memoryGB === null) {
      reasons.push("Android RAM could not be detected, so Haki cannot safely activate this model.");
    } else if (hardware.memoryGB < tierRequirements.minimumRamGB) {
      reasons.push(`${tierRequirements.label} requires at least ${tierRequirements.minimumRamGB}GB RAM.`);
    }

    if (hardware.freeStorageGB === null) {
      reasons.push("Free storage could not be detected, so Haki cannot safely activate this model.");
    } else if (hardware.freeStorageGB < tierRequirements.minimumFreeStorageGB) {
      reasons.push(`${tierRequirements.label} requires at least ${tierRequirements.minimumFreeStorageGB}GB free storage.`);
    }
  }

  if (hardware.lowMemory === true) {
    reasons.push("Android reports the app is in a low-memory state; import succeeded but model loading is disabled until memory pressure clears.");
  }

  return Array.from(new Set(reasons));
}

export function buildLocalModelManifest(input: BuildManifestInput): LocalModelManifest {
  const recommendedModelTier = recommendedDeviceModelTier(input.hardware);
  const rejectionReasons = validateImportedModel({
    fileName: input.originalName,
    role: input.role,
    metadata: input.metadata,
    sizeBytes: input.sizeBytes,
    hardware: input.hardware
  });

  return {
    version: 1,
    role: input.role,
    ...(input.source ? { source: input.source } : {}),
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    ...(input.downloadId ? { downloadId: input.downloadId } : {}),
    originalName: input.originalName,
    storedName: input.storedName,
    uri: input.uri,
    sizeBytes: input.sizeBytes,
    fileHash: input.fileHash,
    fileHashAlgorithm: input.fileHash ? "md5" : null,
    modelName: input.metadata.modelName,
    modelParameterCountB: input.metadata.modelParameterCountB,
    modelQuantization: input.metadata.modelQuantization,
    modelTier: input.metadata.modelTier,
    chatTemplate: input.metadata.chatTemplate,
    recommendedModelTier,
    importedAt: input.now,
    validatedAt: input.now,
    manifestPath: input.manifestPath,
    rejectionReasons,
    ...(input.metadata.rawInfo ? { rawInfo: input.metadata.rawInfo } : {})
  };
}

export function deviceCapabilityClassForTier(tier: LocalModelTier) {
  if (!isAndroidLocalModelTier(tier)) {
    return "unknown" as const;
  }

  return ANDROID_MODEL_TIER_RANK[tier] >= ANDROID_MODEL_TIER_RANK.good ? "high" as const : "standard" as const;
}

export function getLlamaContextSettingsForTier(tier: LocalModelTier, embedding: boolean): LlamaContextSettings {
  if (embedding) {
    return { nCtx: 512, nBatch: 128, nThreads: 2 };
  }

  switch (tier) {
    case "flagship":
    case "enhanced":
      return { nCtx: 2048, nBatch: 256, nThreads: 4 };
    case "good":
      return { nCtx: 2048, nBatch: 192, nThreads: 4 };
    case "minimum":
      return { nCtx: 1536, nBatch: 160, nThreads: 4 };
    case "tiny":
      return { nCtx: 1280, nBatch: 128, nThreads: 3 };
    default:
      return { nCtx: 1024, nBatch: 128, nThreads: 2 };
  }
}

export function parseMemoryGB(value: number | string | null | undefined): number | null {
  return parseSizeToGB(value);
}
