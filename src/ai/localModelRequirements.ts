import { Platform } from "react-native";

import type { LocalModelTier } from "./LocalAIProvider";
import {
  ANDROID_LOCAL_MODEL_TIERS,
  ANDROID_MODEL_TIER_ORDER,
  ANDROID_MODEL_TIER_RANK,
  getAndroidModelTierRequirements,
  getModelTierForParameterCount,
  hasArm64Abi,
  isAndroidLocalModelTier,
  isQuantizedModel,
  parseSizeToGB,
  recommendedAndroidLocalModelTier,
  type AndroidLocalModelTier
} from "./localModelTierRules";

export {
  ANDROID_LOCAL_MODEL_TIERS,
  ANDROID_MODEL_TIER_ORDER,
  ANDROID_MODEL_TIER_RANK,
  getAndroidModelTierRequirements,
  getModelTierForParameterCount,
  hasArm64Abi,
  isAndroidLocalModelTier,
  isQuantizedModel,
  parseSizeToGB,
  recommendedAndroidLocalModelTier,
  type AndroidLocalModelTier
} from "./localModelTierRules";

export const ANDROID_LOCAL_MODEL_REQUIREMENTS = {
  label: "Android GGUF local model",
  minimumAndroidApi: 33,
  requiredAbi: "arm64-v8a"
} as const;

export const APPLE_INTELLIGENCE_REQUIREMENTS = {
  label: "Apple Intelligence local model",
  minimumOS: "iOS/iPadOS 26.0+",
  supportedDevices:
    "iPhone 15 Pro models, iPhone 16 or later, iPad mini with A17 Pro, iPad models with M1 or later",
  minimumFreeStorageGB: 0
} as const;

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

function summarizeSupportedAndroidTiers(): string {
  return ANDROID_MODEL_TIER_ORDER
    .map((tier) => ANDROID_LOCAL_MODEL_TIERS[tier].summary)
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
    `Android tiny AI: Android ${ANDROID_LOCAL_MODEL_REQUIREMENTS.minimumAndroidApi}+ / Android 13+, ${ANDROID_LOCAL_MODEL_REQUIREMENTS.requiredAbi}, ${ANDROID_LOCAL_MODEL_TIERS.tiny.minimumRamGB}GB RAM, ${ANDROID_LOCAL_MODEL_TIERS.tiny.minimumFreeStorageGB}GB free storage, ${ANDROID_LOCAL_MODEL_TIERS.tiny.summary}.`,
    `Android adaptive AI: ${ANDROID_LOCAL_MODEL_TIERS.minimum.minimumRamGB}GB+ uses ${ANDROID_LOCAL_MODEL_TIERS.minimum.summary}; ${ANDROID_LOCAL_MODEL_TIERS.good.minimumRamGB}GB+ uses ${ANDROID_LOCAL_MODEL_TIERS.good.summary}; ${ANDROID_LOCAL_MODEL_TIERS.enhanced.minimumRamGB}GB+ uses ${ANDROID_LOCAL_MODEL_TIERS.enhanced.summary}; ${ANDROID_LOCAL_MODEL_TIERS.flagship.minimumRamGB}GB+ can use ${ANDROID_LOCAL_MODEL_TIERS.flagship.summary}.`,
    `Apple local model path: ${APPLE_INTELLIGENCE_REQUIREMENTS.supportedDevices}; ${APPLE_INTELLIGENCE_REQUIREMENTS.minimumOS}; Apple manages downloaded model readiness through Foundation Models availability.`
  ];
}

export function validateAndroidLocalModelRuntime(input: {
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
  const recommendedModelTier = recommendedAndroidLocalModelTier({ freeStorageGB, memoryGB });
  const selectedTierRequirements = getAndroidModelTierRequirements(modelTier);

  if (Platform.OS === "android") {
    if (!hasArm64Abi(input.architecture)) {
      unavailableReasons.push(
        `Android local AI requires ${ANDROID_LOCAL_MODEL_REQUIREMENTS.requiredAbi}; native module did not report a supported arm64 ABI.`
      );
    }

    if (memoryGB === null || memoryGB < ANDROID_LOCAL_MODEL_TIERS.tiny.minimumRamGB) {
      unavailableReasons.push(
        `Android local AI requires at least ${ANDROID_LOCAL_MODEL_TIERS.tiny.minimumRamGB}GB RAM for Haki tiny local AI.`
      );
    }

    if (freeStorageGB === null || freeStorageGB < ANDROID_LOCAL_MODEL_TIERS.tiny.minimumFreeStorageGB) {
      unavailableReasons.push(
        `Android local AI requires at least ${ANDROID_LOCAL_MODEL_TIERS.tiny.minimumFreeStorageGB}GB free storage for an installed model.`
      );
    }
  }

  if (!input.modelAssetsAvailable) {
    unavailableReasons.push("No active Android local model is installed on this device.");
  }

  if (!selectedTierRequirements) {
    unavailableReasons.push(
      `Android local model must match a supported quantized tier: ${summarizeSupportedAndroidTiers()}.`
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
    unavailableReasons.push("Android local model must report an int4/q4 or int8/q8 quantized build.");
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

  return {
    freeStorageGB,
    unavailableReasons: Array.from(new Set(unavailableReasons))
  };
}
