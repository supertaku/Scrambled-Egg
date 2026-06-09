import type { LocalModelTier } from "./LocalAIProvider";
import { ANDROID_LOCAL_MODEL_TIERS, ANDROID_MODEL_TIER_ORDER } from "./localModelTierRules";
import type { DeviceHardwareProfile, LocalModelActivationPolicy } from "./localModelMetadata";
import type { GgufDownloadConfig, ModelRuntimeFormat, RuntimeAvailability } from "./modelDownloadConfig";

type AndroidLocalModelTier = (typeof ANDROID_MODEL_TIER_ORDER)[number];

export type CatalogDownloadModel = {
  tier: LocalModelTier;
  sizeMB: number;
  supportedPlatforms?: Array<"android" | "ios">;
  runtimeFormat?: ModelRuntimeFormat;
  minimumRamGB?: number;
  minimumFreeStorageGB?: number;
  activationPolicy?: LocalModelActivationPolicy;
};

export type CatalogRecommendationGroup = GgufDownloadConfig["recommendationGroup"];
export type GroupedModelCatalog = Record<CatalogRecommendationGroup, GgufDownloadConfig[]>;

function catalogFitsHardware(
  model: CatalogDownloadModel,
  hardware: DeviceHardwareProfile,
  options: {
    ignoreRuntime?: boolean;
    ramToleranceGB?: number;
    runtimeAvailability?: RuntimeAvailability;
  } = {}
): boolean {
  const requirements = ANDROID_LOCAL_MODEL_TIERS[model.tier as AndroidLocalModelTier];
  const supportsPlatform = model.supportedPlatforms?.includes(hardware.platform as "android" | "ios") ??
    (hardware.platform === "android");
  const runtimeFormat = model.runtimeFormat ?? "gguf";
  const runtimeAvailability = options.runtimeAvailability ?? { gguf: true };
  const runtimeAvailable = options.ignoreRuntime ? true : runtimeAvailability[runtimeFormat] ?? runtimeFormat === "gguf";
  if (
    !requirements ||
    !runtimeAvailable ||
    !supportsPlatform ||
    (hardware.platform !== "android" && hardware.platform !== "ios") ||
    !hardware.supportedAbis.some((abi) => abi.toLowerCase().includes("arm64"))
  ) {
    return false;
  }
  if (hardware.memoryGB === null || hardware.freeStorageGB === null || hardware.lowMemory === true) {
    return false;
  }
  const minimumRamGB = model.minimumRamGB ?? requirements.minimumRamGB;
  const minimumFreeStorageGB = model.minimumFreeStorageGB ?? requirements.minimumFreeStorageGB;
  const requiredBeforeDownload = minimumFreeStorageGB + model.sizeMB / 1024;
  const effectiveMemoryGB = hardware.memoryGB + (options.ramToleranceGB ?? 0);
  return effectiveMemoryGB >= minimumRamGB && hardware.freeStorageGB >= requiredBeforeDownload;
}

export function catalogDownloadFitsHardware(
  model: CatalogDownloadModel,
  hardware: DeviceHardwareProfile,
  runtimeAvailability: RuntimeAvailability = { gguf: true }
): boolean {
  return catalogFitsHardware(model, hardware, { runtimeAvailability });
}

export function catalogDownloadFitsHardwareForDownload(
  model: CatalogDownloadModel,
  hardware: DeviceHardwareProfile
): boolean {
  const requirements = ANDROID_LOCAL_MODEL_TIERS[model.tier as AndroidLocalModelTier];
  const minimumRamGB = model.minimumRamGB ?? requirements?.minimumRamGB ?? Number.POSITIVE_INFINITY;
  const ramToleranceGB = model.runtimeFormat === "litert-lm" && minimumRamGB >= 8 ? 1 : 0;

  return catalogFitsHardware(model, hardware, {
    ignoreRuntime: true,
    ramToleranceGB
  });
}

export function groupCatalogByRecommendation(models: GgufDownloadConfig[]): GroupedModelCatalog {
  return models.reduce<GroupedModelCatalog>(
    (groups, model) => {
      groups[model.recommendationGroup].push(model);
      return groups;
    },
    {
      recommended: [],
      alternative: [],
      experimental: []
    }
  );
}
