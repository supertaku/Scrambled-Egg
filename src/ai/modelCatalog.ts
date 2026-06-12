import type { LocalModelTier } from "./LocalAIProvider";
import type { DeviceHardwareProfile } from "./localModelMetadata";
import type { GgufDownloadConfig, ModelRuntimeFormat, RuntimeAvailability } from "./modelDownloadConfig";

type CatalogModel = {
  activationPolicy?: "auto-after-smoke-test" | "manual";
  minimumFreeStorageGB?: number;
  minimumRamGB?: number;
  requiredArchitecture?: "arm64";
  runtimeFormat?: ModelRuntimeFormat;
  sizeMB: number;
  supportedPlatforms?: Array<"android" | "ios">;
  tier: LocalModelTier;
};

function tierRequirements(tier: LocalModelTier) {
  if (tier === "unknown" || tier === "apple-intelligence") return null;
  return {
    minimumRamGB: { tiny: 4, minimum: 6, good: 8, enhanced: 12, flagship: 16 }[tier],
    minimumFreeStorageGB: { tiny: 3, minimum: 4, good: 6, enhanced: 10, flagship: 14 }[tier]
  };
}

function fitsHardware(
  model: CatalogModel,
  hardware: DeviceHardwareProfile,
  options: { ignoreRuntime?: boolean; runtimeAvailability?: RuntimeAvailability } = {}
): boolean {
  const requirements = tierRequirements(model.tier);
  const runtimeFormat = model.runtimeFormat ?? "gguf";
  const runtimeAvailable = options.ignoreRuntime || (options.runtimeAvailability?.[runtimeFormat] ?? runtimeFormat === "gguf");
  const supportsPlatform = model.supportedPlatforms?.includes(hardware.platform as "android" | "ios") ?? false;
  const supportsArchitecture = model.requiredArchitecture !== "arm64" ||
    hardware.supportedAbis.some((abi) => /arm64|aarch64/i.test(abi));
  if (!requirements || !runtimeAvailable || !supportsPlatform || !supportsArchitecture) {
    return false;
  }
  if (hardware.memoryGB === null || hardware.freeStorageGB === null || hardware.lowMemory === true) return false;

  const minimumRamGB = model.minimumRamGB ?? requirements.minimumRamGB;
  const minimumFreeStorageGB = model.minimumFreeStorageGB ?? requirements.minimumFreeStorageGB;
  return (
    hardware.memoryGB >= minimumRamGB &&
    hardware.freeStorageGB >= minimumFreeStorageGB + model.sizeMB / 1024
  );
}

export function catalogDownloadFitsHardware(
  model: CatalogModel,
  hardware: DeviceHardwareProfile,
  runtimeAvailability: RuntimeAvailability = { gguf: true }
): boolean {
  return fitsHardware(model, hardware, { runtimeAvailability });
}

export function catalogDownloadFitsHardwareForDownload(model: CatalogModel, hardware: DeviceHardwareProfile): boolean {
  return fitsHardware(model, hardware, { ignoreRuntime: true });
}

export function groupCatalogByRecommendation(models: GgufDownloadConfig[]) {
  return models.reduce<Record<GgufDownloadConfig["recommendationGroup"], GgufDownloadConfig[]>>(
    (groups, model) => {
      groups[model.recommendationGroup].push(model);
      return groups;
    },
    { recommended: [], alternative: [], experimental: [] }
  );
}
