import type { LocalModelTier } from "./LocalAIProvider";

export const ANDROID_LOCAL_MODEL_TIERS = {
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
    maximumModelParametersB: 3.5,
    summary: "quantized 1B-3.5B model"
  },
  good: {
    label: "Good local AI",
    minimumRamGB: 8,
    minimumFreeStorageGB: 6,
    minimumModelParametersB: 3,
    maximumModelParametersB: 5,
    summary: "quantized 3B-5B model"
  },
  enhanced: {
    label: "Enhanced local AI",
    minimumRamGB: 12,
    minimumFreeStorageGB: 10,
    minimumModelParametersB: 6,
    maximumModelParametersB: 9,
    summary: "quantized 6B-9B model"
  },
  flagship: {
    label: "Flagship local AI",
    minimumRamGB: 16,
    minimumFreeStorageGB: 14,
    minimumModelParametersB: 9,
    maximumModelParametersB: 15,
    summary: "quantized 9B-15B model"
  }
} as const;

export const ANDROID_MODEL_TIER_ORDER = ["tiny", "minimum", "good", "enhanced", "flagship"] as const;
export type AndroidLocalModelTier = (typeof ANDROID_MODEL_TIER_ORDER)[number];

export const ANDROID_MODEL_TIER_RANK: Record<AndroidLocalModelTier, number> = {
  tiny: 1,
  minimum: 2,
  good: 3,
  enhanced: 4,
  flagship: 5
};

const QUANTIZATION_KEYWORDS = ["int4", "q4", "4-bit", "4bit", "int8", "q8", "8-bit", "8bit", "quantized"];

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

export function isAndroidLocalModelTier(tier: LocalModelTier): tier is AndroidLocalModelTier {
  return ANDROID_MODEL_TIER_ORDER.includes(tier as AndroidLocalModelTier);
}

export function getAndroidModelTierRequirements(tier: LocalModelTier) {
  return isAndroidLocalModelTier(tier) ? ANDROID_LOCAL_MODEL_TIERS[tier] : null;
}

export function getModelTierForParameterCount(parameterCountB: number | null | undefined): LocalModelTier {
  if (parameterCountB === null || parameterCountB === undefined || !Number.isFinite(parameterCountB)) {
    return "unknown";
  }

  for (const tier of [...ANDROID_MODEL_TIER_ORDER].reverse()) {
    const requirement = ANDROID_LOCAL_MODEL_TIERS[tier];
    if (
      parameterCountB >= requirement.minimumModelParametersB &&
      parameterCountB <= requirement.maximumModelParametersB
    ) {
      return tier;
    }
  }

  return "unknown";
}

export function recommendedAndroidLocalModelTier(input: {
  freeStorageGB: number | null;
  memoryGB: number | null;
}): LocalModelTier {
  for (const tier of [...ANDROID_MODEL_TIER_ORDER].reverse()) {
    const requirement = ANDROID_LOCAL_MODEL_TIERS[tier];
    if (
      input.memoryGB !== null &&
      input.memoryGB >= requirement.minimumRamGB &&
      input.freeStorageGB !== null &&
      input.freeStorageGB >= requirement.minimumFreeStorageGB
    ) {
      return tier;
    }
  }

  return "unknown";
}
