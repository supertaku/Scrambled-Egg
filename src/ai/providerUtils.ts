import { NativeModules, Platform } from "react-native";

import type {
  DeviceCapabilityClass,
  LocalAIProviderId,
  SafeChatResult,
  LocalSummaryResult,
  SummarizeFromSourcesInput
} from "./LocalAIProvider";
import { NO_RELIABLE_ANSWER } from "./prompts";
import { sanitizeAssistantText } from "./sanitizeAssistantText";

export { sanitizeAssistantText } from "./sanitizeAssistantText";

export type NormalizedPlatform = "ios" | "android" | "web" | "unknown";

export interface DeviceCapabilitySnapshot {
  platform: NormalizedPlatform;
  osVersion: string;
  approximateDeviceCapability: DeviceCapabilityClass;
  memoryClass: string | null;
  notes: string[];
}

interface PlatformConstantsShape {
  forceTouchAvailable?: boolean;
  interfaceIdiom?: string;
  isTesting?: boolean;
  osVersion?: string | number;
  reactNativeVersion?: unknown;
  Version?: string | number;
}

export function getPlatformVersionString(): string {
  return String(Platform.Version);
}

export function getNormalizedPlatform(): NormalizedPlatform {
  if (Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web") {
    return Platform.OS;
  }

  return "unknown";
}

export function getMajorPlatformVersion(): number | null {
  const version = Platform.Version;
  if (typeof version === "number") {
    return version;
  }

  const parsed = Number.parseInt(version, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function hasMinimumOS(minimum: number): boolean {
  const majorVersion = getMajorPlatformVersion();
  return majorVersion !== null && majorVersion >= minimum;
}

function getPlatformConstants(): PlatformConstantsShape {
  const platformConstants = (Platform as unknown as { constants?: PlatformConstantsShape }).constants;
  const nativePlatformConstants = NativeModules.PlatformConstants as PlatformConstantsShape | undefined;
  return {
    ...(nativePlatformConstants ?? {}),
    ...(platformConstants ?? {})
  };
}

function inferDeviceCapabilityClass(): DeviceCapabilityClass {
  const majorVersion = getMajorPlatformVersion();

  if (majorVersion === null) {
    return "unknown";
  }

  // NOTE: OS version is an imperfect proxy for device capability.
  // An iPhone 8 and iPhone 15 Pro can both run iOS 17, but have vastly
  // different performance envelopes. Native chip/processor detection via
  // a custom Expo module would give a more accurate classification.
  if (Platform.OS === "ios") {
    // iOS 17+ supports the minimum baseline for Apple Intelligence features.
    // Apple Intelligence itself requires iOS 18.1+ on qualifying hardware.
    return majorVersion >= 17 ? "standard" : "unknown";
  }

  if (Platform.OS === "android") {
    // Android 13 (API 33) is the minimum for ExecuTorch ARM64 support.
    return majorVersion >= 33 ? "standard" : "unknown";
  }

  return "unknown";
}


export function getDeviceCapabilitySnapshot(): DeviceCapabilitySnapshot {
  const constants = getPlatformConstants();
  const platform = getNormalizedPlatform();
  const osVersion = String(constants.osVersion ?? constants.Version ?? getPlatformVersionString());
  const approximateDeviceCapability = inferDeviceCapabilityClass();

  return {
    platform,
    osVersion,
    approximateDeviceCapability,
    memoryClass: null,
    notes: [
      "Approximate device class is inferred from platform and OS version when no native hardware report is available.",
      "RAM or memory class is not exposed by React Native in this build."
    ]
  };
}

export function noReliableSummary(providerId: LocalAIProviderId, providerName: string): LocalSummaryResult {
  return {
    status: "no_reliable_answer",
    text: NO_RELIABLE_ANSWER,
    citationIds: [],
    providerId,
    providerName
  };
}

export function coerceNativeSummaryResult(
  nativeResult: Partial<LocalSummaryResult> | string,
  input: SummarizeFromSourcesInput,
  providerId: LocalAIProviderId,
  providerName: string
): LocalSummaryResult {
  if (typeof nativeResult === "string") {
    if (nativeResult.trim() === NO_RELIABLE_ANSWER) {
      return noReliableSummary(providerId, providerName);
    }

    const citationIds = input.sources
      .map((source) => source.citationId)
      .filter((citationId) => nativeResult.includes(citationId));

    if (citationIds.length === 0) {
      return noReliableSummary(providerId, providerName);
    }

    return {
      status: "ok",
      text: nativeResult.trim(),
      citationIds,
      providerId,
      providerName
    };
  }

  if (nativeResult.status === "no_reliable_answer" || nativeResult.text?.trim() === NO_RELIABLE_ANSWER) {
    return noReliableSummary(providerId, providerName);
  }

  const allowedCitationIds = new Set(input.sources.map((source) => source.citationId));
  const citationIds = Array.isArray(nativeResult.citationIds)
    ? nativeResult.citationIds.filter((citationId) => allowedCitationIds.has(citationId))
    : [];

  const text = nativeResult.text?.trim();
  if (!text || citationIds.length === 0) {
    return noReliableSummary(providerId, providerName);
  }

  return {
    status: "ok",
    text,
    citationIds,
    providerId,
    providerName
  };
}

export function coerceNativeSafeChatResult(
  nativeResult: Partial<SafeChatResult> | string,
  providerId: LocalAIProviderId,
  providerName: string
): SafeChatResult {
  if (typeof nativeResult === "string") {
    const text = sanitizeAssistantText(nativeResult);
    return {
      status: text ? "ok" : "refused",
      text,
      citationIds: [],
      providerId,
      providerName
    };
  }

  const text = sanitizeAssistantText(nativeResult.text ?? "");
  return {
    status: nativeResult.status === "refused" || !text ? "refused" : "ok",
    text,
    citationIds: Array.isArray(nativeResult.citationIds) ? nativeResult.citationIds : [],
    providerId,
    providerName
  };
}
