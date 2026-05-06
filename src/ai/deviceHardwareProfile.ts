import { NativeModules, Platform } from "react-native";
import { Paths } from "expo-file-system";

import type { DeviceHardwareProfile } from "./localModelMetadata";
import { parseMemoryGB } from "./localModelMetadata";
import { getNormalizedPlatform, getPlatformVersionString } from "./providerUtils";
import { logger } from "@/utils/logger";

interface NativeHardwareProfile {
  supportedAbis?: string[];
  totalMemoryBytes?: number | string | null;
  memoryClassMb?: number | string | null;
  largeMemoryClassMb?: number | string | null;
  lowMemory?: boolean | null;
}

interface HakiDeviceInfoNativeModule {
  getHardwareProfile: () => Promise<NativeHardwareProfile>;
}

function getNativeDeviceInfoModule(): HakiDeviceInfoNativeModule | null {
  return (NativeModules.HakiDeviceInfo as HakiDeviceInfoNativeModule | undefined) ?? null;
}

function getFreeStorageGB(): number | null {
  try {
    const bytes = Paths.availableDiskSpace;
    return Number.isFinite(bytes) ? bytes / 1024 ** 3 : null;
  } catch {
    return null;
  }
}

function normalizeMemoryGB(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && value > 1024) {
    return value / 1024 ** 3;
  }

  return parseMemoryGB(value ?? null);
}

export async function getDeviceHardwareProfile(backendDevices: string[] = []): Promise<DeviceHardwareProfile> {
  const platform = getNormalizedPlatform();
  const fallbackAbis = Platform.OS === "android" ? ["arm64-v8a", "x86_64"] : [];
  const nativeModule = getNativeDeviceInfoModule();

  if (!nativeModule) {
    return {
      platform,
      osVersion: getPlatformVersionString(),
      supportedAbis: fallbackAbis,
      architecture: fallbackAbis.join(", ") || null,
      memoryGB: null,
      memoryClass: null,
      lowMemory: null,
      freeStorageGB: getFreeStorageGB(),
      backendDevices
    };
  }

  try {
    const nativeProfile = await nativeModule.getHardwareProfile();
    const supportedAbis = Array.isArray(nativeProfile.supportedAbis)
      ? nativeProfile.supportedAbis.filter((abi): abi is string => typeof abi === "string" && abi.length > 0)
      : fallbackAbis;
    const memoryGB = normalizeMemoryGB(nativeProfile.totalMemoryBytes ?? null);
    const memoryClassMb = nativeProfile.largeMemoryClassMb ?? nativeProfile.memoryClassMb ?? null;
    const memoryClassGB = parseMemoryGB(memoryClassMb === null ? null : `${memoryClassMb}mb`);

    return {
      platform,
      osVersion: getPlatformVersionString(),
      supportedAbis,
      architecture: supportedAbis.join(", ") || null,
      memoryGB,
      memoryClass: memoryClassGB !== null ? `${memoryClassGB.toFixed(1)}GB app heap class` : null,
      lowMemory: nativeProfile.lowMemory ?? null,
      freeStorageGB: getFreeStorageGB(),
      backendDevices
    };
  } catch (error) {
    logger.ai.warn("Native hardware profile check failed", { error: error instanceof Error ? error.message : String(error) });
    return {
      platform,
      osVersion: getPlatformVersionString(),
      supportedAbis: fallbackAbis,
      architecture: fallbackAbis.join(", ") || null,
      memoryGB: null,
      memoryClass: null,
      lowMemory: null,
      freeStorageGB: getFreeStorageGB(),
      backendDevices
    };
  }
}
