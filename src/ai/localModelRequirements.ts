import { Platform } from "react-native";

import type { LocalModelTier } from "./LocalAIProvider";

export const EXECUTORCH_ANDROID_REQUIREMENTS = {
  label: "Android ExecuTorch local model",
  minimumAndroidApi: 33,
  requiredAbi: "arm64-v8a"
} as const;

export const EXECUTORCH_ANDROID_MODEL_TIERS = {
  tiny: {
    label: "Tiny local AI",
    minimumRamGB: 4,
    minimumFreeStorageGB: 3,
    minimumModelParametersB: 0.5,
    maximumModelParametersB: 1.5,
    summary: "quantized 0.5B-1.5B model"
  },
  minimum: {
    label: "Minimum local AI",
    minimumRamGB: 6,
    minimumFreeStorageGB: 4,
    minimumModelParametersB: 1,
    maximumModelParametersB: 3,
    summary: "quantized 1B-3B model"
  },
  good: {
    label: "Good local AI",
    minimumRamGB: 8,
    minimumFreeStorageGB: 6,
    minimumModelParametersB: 3,
    maximumModelParametersB: 4,
    summary: "quantized 3B-4B model"
  },
  enhanced: {
    label: "Enhanced local AI",
    minimumRamGB: 12,
    minimumFreeStorageGB: 10,
    minimumModelParametersB: 4,
    maximumModelParametersB: 7,
    summary: "quantized 4B-7B model"
  },
  flagship: {
    label: "Flagship local AI",
    minimumRamGB: 16,
    minimumFreeStorageGB: 12,
    minimumModelParametersB: 7,
    maximumModelParametersB: 8,
    summary: "quantized 7B-8B model"
  }
} as const;

export const ANDROID_MODEL_TIER_ORDER = ["tiny", "minimum", "good", "enhanced", "flagship"] as const;
type AndroidLocalModelTier = (typeof ANDROID_MODEL_TIER_ORDER)[number];

export const ANDROID_MODEL_TIER_RANK: Record<AndroidLocalModelTier, number> = {
  tiny: 1,
  minimum: 2,
  good: 3,
  enhanced: 4,
  flagship: 5
};

export const APPLE_INTELLIGENCE_REQUIREMENTS = {
  label: "Apple Intelligence local model",
  minimumOS: "iOS/iPadOS 18.1+",
  supportedDevices:
    "iPhone 15 Pro models, iPhone 16 or later, iPad mini with A17 Pro, iPad models with M1 or later",
  minimumFreeStorageGB: 7
} as const;

const QUANTIZATION_KEYWORDS = ["int4", "q4", "4-bit", "4bit", "int8", "q8", "8-bit", "8bit", "quantized"];

export interface LocalModelRuntimeMetadata {
  architecture: string | null;
  freeStorageGB: number | null;
  memoryGB: number | null;
  modelName: string | null;
  modelParameterCountB: number | null;
  modelQuantization: string | null;
  modelTier: LocalModelTier;
  recommendedModelTier: LocalModelTier;
}

export function parseSizeToGB(value: number | string | null | undefined): number | null {
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

export function hasArm64Abi(architecture: string | string[] | null | undefined): boolean {
  const values = Array.isArray(architecture) ? architecture : architecture ? [architecture] : [];
  return values.some((value) => {
    const normalized = value.toLowerCase();
    return normalized.includes("arm64") || normalized.includes("aarch64");
  });
}

export function isQuantizedModel(quantization: string | null | undefined): boolean {
  if (!quantization) {
    return false;
  }

  const normalized = quantization.toLowerCase();
  return QUANTIZATION_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function getModelTierForParameterCount(parameterCountB: number | null | undefined): LocalModelTier {
  if (parameterCountB === null || parameterCountB === undefined || !Number.isFinite(parameterCountB)) {
    return "unknown";
  }

  if (
    parameterCountB >= EXECUTORCH_ANDROID_MODEL_TIERS.flagship.minimumModelParametersB &&
    parameterCountB <= EXECUTORCH_ANDROID_MODEL_TIERS.flagship.maximumModelParametersB
  ) {
    return "flagship";
  }

  if (
    parameterCountB >= EXECUTORCH_ANDROID_MODEL_TIERS.enhanced.minimumModelParametersB &&
    parameterCountB <= EXECUTORCH_ANDROID_MODEL_TIERS.enhanced.maximumModelParametersB
  ) {
    return "enhanced";
  }

  if (
    parameterCountB >= EXECUTORCH_ANDROID_MODEL_TIERS.good.minimumModelParametersB &&
    parameterCountB <= EXECUTORCH_ANDROID_MODEL_TIERS.good.maximumModelParametersB
  ) {
    return "good";
  }

  if (
    parameterCountB >= EXECUTORCH_ANDROID_MODEL_TIERS.minimum.minimumModelParametersB &&
    parameterCountB <= EXECUTORCH_ANDROID_MODEL_TIERS.minimum.maximumModelParametersB
  ) {
    return "minimum";
  }

  if (
    parameterCountB >= EXECUTORCH_ANDROID_MODEL_TIERS.tiny.minimumModelParametersB &&
    parameterCountB <= EXECUTORCH_ANDROID_MODEL_TIERS.tiny.maximumModelParametersB
  ) {
    return "tiny";
  }

  return "unknown";
}

export function getRecommendedExecuTorchModelTier(input: {
  freeStorageGB: number | null;
  memoryGB: number | null;
}): LocalModelTier {
  if (
    input.memoryGB !== null &&
    input.memoryGB >= EXECUTORCH_ANDROID_MODEL_TIERS.flagship.minimumRamGB &&
    input.freeStorageGB !== null &&
    input.freeStorageGB >= EXECUTORCH_ANDROID_MODEL_TIERS.flagship.minimumFreeStorageGB
  ) {
    return "flagship";
  }

  if (
    input.memoryGB !== null &&
    input.memoryGB >= EXECUTORCH_ANDROID_MODEL_TIERS.enhanced.minimumRamGB &&
    input.freeStorageGB !== null &&
    input.freeStorageGB >= EXECUTORCH_ANDROID_MODEL_TIERS.enhanced.minimumFreeStorageGB
  ) {
    return "enhanced";
  }

  if (
    input.memoryGB !== null &&
    input.memoryGB >= EXECUTORCH_ANDROID_MODEL_TIERS.good.minimumRamGB &&
    input.freeStorageGB !== null &&
    input.freeStorageGB >= EXECUTORCH_ANDROID_MODEL_TIERS.good.minimumFreeStorageGB
  ) {
    return "good";
  }

  if (
    input.memoryGB !== null &&
    input.memoryGB >= EXECUTORCH_ANDROID_MODEL_TIERS.minimum.minimumRamGB &&
    input.freeStorageGB !== null &&
    input.freeStorageGB >= EXECUTORCH_ANDROID_MODEL_TIERS.minimum.minimumFreeStorageGB
  ) {
    return "minimum";
  }

  if (
    input.memoryGB !== null &&
    input.memoryGB >= EXECUTORCH_ANDROID_MODEL_TIERS.tiny.minimumRamGB &&
    input.freeStorageGB !== null &&
    input.freeStorageGB >= EXECUTORCH_ANDROID_MODEL_TIERS.tiny.minimumFreeStorageGB
  ) {
    return "tiny";
  }

  return "unknown";
}

function getTierRequirements(tier: LocalModelTier) {
  if (ANDROID_MODEL_TIER_ORDER.includes(tier as AndroidLocalModelTier)) {
    return EXECUTORCH_ANDROID_MODEL_TIERS[tier as AndroidLocalModelTier];
  }

  return null;
}

export function getAndroidModelTierRequirements(tier: LocalModelTier) {
  return getTierRequirements(tier);
}

export function isAndroidLocalModelTier(tier: LocalModelTier): tier is AndroidLocalModelTier {
  return ANDROID_MODEL_TIER_ORDER.includes(tier as AndroidLocalModelTier);
}

function summarizeSupportedAndroidTiers(): string {
  return ANDROID_MODEL_TIER_ORDER
    .map((tier) => EXECUTORCH_ANDROID_MODEL_TIERS[tier].summary)
    .join(", ");
}

function isHigherRecommendedTier(recommendedTier: LocalModelTier, modelTier: LocalModelTier): boolean {
  if (
    !ANDROID_MODEL_TIER_ORDER.includes(recommendedTier as AndroidLocalModelTier) ||
    !ANDROID_MODEL_TIER_ORDER.includes(modelTier as AndroidLocalModelTier)
  ) {
    return false;
  }

  return (
    ANDROID_MODEL_TIER_RANK[recommendedTier as AndroidLocalModelTier] >
    ANDROID_MODEL_TIER_RANK[modelTier as AndroidLocalModelTier]
  );
}

export function getLocalModelRequirementSummary(): string[] {
  return [
    `Android tiny AI: Android ${EXECUTORCH_ANDROID_REQUIREMENTS.minimumAndroidApi}+ / Android 13+, ${EXECUTORCH_ANDROID_REQUIREMENTS.requiredAbi}, ${EXECUTORCH_ANDROID_MODEL_TIERS.tiny.minimumRamGB}GB RAM, ${EXECUTORCH_ANDROID_MODEL_TIERS.tiny.minimumFreeStorageGB}GB free storage, ${EXECUTORCH_ANDROID_MODEL_TIERS.tiny.summary}.`,
    `Android adaptive AI: ${EXECUTORCH_ANDROID_MODEL_TIERS.minimum.minimumRamGB}GB+ uses ${EXECUTORCH_ANDROID_MODEL_TIERS.minimum.summary}; ${EXECUTORCH_ANDROID_MODEL_TIERS.good.minimumRamGB}GB+ uses ${EXECUTORCH_ANDROID_MODEL_TIERS.good.summary}; ${EXECUTORCH_ANDROID_MODEL_TIERS.enhanced.minimumRamGB}GB+ uses ${EXECUTORCH_ANDROID_MODEL_TIERS.enhanced.summary}; ${EXECUTORCH_ANDROID_MODEL_TIERS.flagship.minimumRamGB}GB+ can use ${EXECUTORCH_ANDROID_MODEL_TIERS.flagship.summary}.`,
    `Apple local model path: ${APPLE_INTELLIGENCE_REQUIREMENTS.supportedDevices}; ${APPLE_INTELLIGENCE_REQUIREMENTS.minimumOS}; ${APPLE_INTELLIGENCE_REQUIREMENTS.minimumFreeStorageGB}GB free storage for Apple Intelligence assets.`
  ];
}

export function validateExecuTorchRuntime(input: {
  architecture?: string | string[] | null;
  freeStorageGB?: number | string | null;
  memoryGB?: number | string | null;
  modelAssetsAvailable: boolean;
  modelName?: string | null;
  modelParameterCountB?: number | null;
  modelQuantization?: string | null;
  nativeUnavailableReasons?: string[];
}): { metadata: LocalModelRuntimeMetadata; unavailableReasons: string[]; notes: string[] } {
  const memoryGB = parseSizeToGB(input.memoryGB ?? null);
  const freeStorageGB = parseSizeToGB(input.freeStorageGB ?? null);
  const architecture = Array.isArray(input.architecture)
    ? input.architecture.join(", ")
    : input.architecture?.trim() || null;
  const unavailableReasons = [...(input.nativeUnavailableReasons ?? [])];
  const notes: string[] = [];
  const modelTier = getModelTierForParameterCount(input.modelParameterCountB);
  const recommendedModelTier = getRecommendedExecuTorchModelTier({ freeStorageGB, memoryGB });
  const selectedTierRequirements = getTierRequirements(modelTier);

  if (Platform.OS === "android") {
    if (!hasArm64Abi(input.architecture)) {
      unavailableReasons.push(
        `ExecuTorch requires ${EXECUTORCH_ANDROID_REQUIREMENTS.requiredAbi}; native module did not report a supported arm64 ABI.`
      );
    }

    if (memoryGB === null || memoryGB < EXECUTORCH_ANDROID_MODEL_TIERS.tiny.minimumRamGB) {
      unavailableReasons.push(
        `ExecuTorch requires at least ${EXECUTORCH_ANDROID_MODEL_TIERS.tiny.minimumRamGB}GB RAM for Haki tiny local AI.`
      );
    }

    if (freeStorageGB === null || freeStorageGB < EXECUTORCH_ANDROID_MODEL_TIERS.tiny.minimumFreeStorageGB) {
      unavailableReasons.push(
        `ExecuTorch requires at least ${EXECUTORCH_ANDROID_MODEL_TIERS.tiny.minimumFreeStorageGB}GB free storage for bundled model assets.`
      );
    }
  }

  if (!input.modelAssetsAvailable) {
    unavailableReasons.push("ExecuTorch model assets are not available on this device.");
  }

  if (!selectedTierRequirements) {
    unavailableReasons.push(
      `ExecuTorch model must match a supported quantized tier: ${summarizeSupportedAndroidTiers()}.`
    );
  } else if (Platform.OS === "android") {
    if (memoryGB === null || memoryGB < selectedTierRequirements.minimumRamGB) {
      unavailableReasons.push(
        `${selectedTierRequirements.label} requires at least ${selectedTierRequirements.minimumRamGB}GB RAM.`
      );
    }

    if (freeStorageGB === null || freeStorageGB < selectedTierRequirements.minimumFreeStorageGB) {
      unavailableReasons.push(
        `${selectedTierRequirements.label} requires at least ${selectedTierRequirements.minimumFreeStorageGB}GB free storage.`
      );
    }
  }

  if (!isQuantizedModel(input.modelQuantization)) {
    unavailableReasons.push("ExecuTorch model must report an int4/q4 or int8/q8 quantized build.");
  }

  if (isHigherRecommendedTier(recommendedModelTier, modelTier)) {
    notes.push(
      `Device qualifies for a higher local AI tier (${recommendedModelTier}); native builds should load a matching quantized model when available.`
    );
  }

  return {
    metadata: {
      architecture,
      freeStorageGB,
      memoryGB,
      modelName: input.modelName?.trim() || null,
      modelParameterCountB: input.modelParameterCountB ?? null,
      modelQuantization: input.modelQuantization?.trim() || null,
      modelTier,
      recommendedModelTier
    },
    unavailableReasons: Array.from(new Set(unavailableReasons)),
    notes: Array.from(new Set(notes))
  };
}

export function validateAppleIntelligenceRuntime(input: {
  freeStorageGB?: number | string | null;
  modelAssetsAvailable: boolean;
  nativeUnavailableReasons?: string[];
}): { freeStorageGB: number | null; unavailableReasons: string[] } {
  const freeStorageGB = parseSizeToGB(input.freeStorageGB ?? null);
  const unavailableReasons = [...(input.nativeUnavailableReasons ?? [])];

  if (Platform.OS !== "ios") {
    unavailableReasons.push("Apple Foundation Models are iOS-only.");
  }

  if (!input.modelAssetsAvailable) {
    unavailableReasons.push("Apple Intelligence assets/session are unavailable on this device.");
  }

  if (freeStorageGB === null) {
    unavailableReasons.push(
      `Apple Intelligence path must report at least ${APPLE_INTELLIGENCE_REQUIREMENTS.minimumFreeStorageGB}GB free storage.`
    );
  } else if (freeStorageGB < APPLE_INTELLIGENCE_REQUIREMENTS.minimumFreeStorageGB) {
    unavailableReasons.push(
      `Apple Intelligence requires at least ${APPLE_INTELLIGENCE_REQUIREMENTS.minimumFreeStorageGB}GB free storage for on-device models.`
    );
  }

  return {
    freeStorageGB,
    unavailableReasons: Array.from(new Set(unavailableReasons))
  };
}
