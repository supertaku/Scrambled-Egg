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
    // Android 13 (API 33) is the minimum baseline for Haki's Android local AI path.
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
    const sanitized = sanitizeAssistantText(nativeResult);
    if (sanitized.trim() === NO_RELIABLE_ANSWER) {
      return noReliableSummary(providerId, providerName);
    }

    const { text, citationIds: footerIds } = extractCitationFooter(sanitized);
    const inlineIds = input.sources
      .map((source) => source.citationId)
      .filter((citationId) => text.includes(citationId) || text.includes(`[${citationId}]`));
    const allowed = new Set(input.sources.map((source) => source.citationId));
    const citationIds = Array.from(new Set([...footerIds, ...inlineIds].filter((id) => allowed.has(id))));

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

  if (nativeResult.status === "no_reliable_answer" || nativeResult.text?.trim() === NO_RELIABLE_ANSWER) {
    return noReliableSummary(providerId, providerName);
  }

  const allowedCitationIds = new Set(input.sources.map((source) => source.citationId));
  const citationIds = Array.isArray(nativeResult.citationIds)
    ? nativeResult.citationIds.filter((citationId) => allowedCitationIds.has(citationId))
    : [];

  const { text, citationIds: footerIds } = extractCitationFooter(sanitizeAssistantText(nativeResult.text ?? ""));
  const mergedCitationIds = Array.from(new Set([...citationIds, ...footerIds].filter((citationId) => allowedCitationIds.has(citationId))));
  if (!text || mergedCitationIds.length === 0) {
    return noReliableSummary(providerId, providerName);
  }

  return {
    status: "ok",
    text,
    citationIds: mergedCitationIds,
    providerId,
    providerName
  };
}

/**
 * Parses a trailing `CITATIONS: id1, id2` line from a model response.
 *
 * Models that follow instructions reliably will emit one line at the very end
 * listing the chunk IDs they used. We parse and remove it so:
 *   1. The displayed text doesn't show "CITATIONS: ..." plumbing to the user.
 *   2. Downstream allowlist filtering (in `safeLocalChatService`) has high-
 *      quality IDs even when the model's prose doesn't literally repeat them.
 *
 * Returns the original text + empty array if no footer is present.
 * IDs are NOT allowlist-filtered here; that happens downstream where the
 * caller knows the source set.
 */
export function extractCitationFooter(text: string): { text: string; citationIds: string[] } {
  if (!text) {
    return { text, citationIds: [] };
  }

  // Match the LAST occurrence of a CITATIONS: line so models that hallucinate
  // an earlier "CITATIONS:" mid-paragraph don't trip us up.
  const FOOTER_RE = /(^|\n)\s*(?:CITATIONS?|SOURCE_IDS?|SOURCES?)\s*:\s*([^\n]*)\s*$/i;
  const match = text.match(FOOTER_RE);
  if (!match) {
    return { text, citationIds: [] };
  }

  const ids = (match[2] ?? "")
    .split(/[,\s]+/)
    .map((id) => id.replace(/^[\[(]|[\])]$/g, "").trim())
    .filter((id) => id.length > 0 && id.length <= 80);

  const stripped = text.replace(FOOTER_RE, "").trimEnd();
  return { text: stripped, citationIds: ids };
}

export function coerceNativeSafeChatResult(
  nativeResult: Partial<SafeChatResult> | string,
  providerId: LocalAIProviderId,
  providerName: string
): SafeChatResult {
  if (typeof nativeResult === "string") {
    const { text } = extractCitationFooter(sanitizeAssistantText(nativeResult));
    return {
      status: text ? "ok" : "refused",
      text,
      citationIds: [],
      providerId,
      providerName
    };
  }

  const { text, citationIds: footerIds } = extractCitationFooter(sanitizeAssistantText(nativeResult.text ?? ""));
  const citationIds = Array.isArray(nativeResult.citationIds)
    ? Array.from(new Set([...nativeResult.citationIds, ...footerIds]))
    : footerIds;
  return {
    status: nativeResult.status === "refused" || !text ? "refused" : "ok",
    text,
    citationIds,
    providerId,
    providerName
  };
}
