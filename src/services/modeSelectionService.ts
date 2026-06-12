import {
  FALLBACK_SEARCH_LABEL,
  type DeviceAIMode
} from "@/ai/DeviceAIMode";
import { DefaultCapabilityDetector, type DeviceCapabilityReport } from "@/ai/CapabilityDetector";
import type { LocalAIProvider } from "@/ai/LocalAIProvider";
import { createLocalAIProviderRegistry, type LocalAIProviderRegistry } from "@/ai/providerRegistry";
import { replaceProviderRegistry } from "@/ai/providerRegistryLifecycle";
import { getActiveChatModelStatus } from "@/ai/localModelManager";
import { getDatabase } from "@/db/database";
import { assertFts5Available } from "@/db/ftsHealth";
import { logger } from "@/utils/logger";

export interface SelectedAIMode {
  mode: DeviceAIMode;
  summaryProvider: LocalAIProvider | null;
  embeddingProvider: LocalAIProvider | null;
}

const disabledProviderIds = new Set<string>();
let selectedModePromise: Promise<SelectedAIMode> | null = null;
let capabilityReportPromise: Promise<DeviceCapabilityReport> | null = null;
let activeRegistry: LocalAIProviderRegistry | null = null;
let capabilityRefreshPromise: Promise<DeviceAIMode> | null = null;

async function verifyFts5Baseline(): Promise<void> {
  const db = await getDatabase();
  await assertFts5Available(db);
}

function toFallbackMode(mode: DeviceAIMode, reason: string): DeviceAIMode {
  return {
    ...mode,
    id: "fallback-fts5-only",
    label: FALLBACK_SEARCH_LABEL,
    provenance: "Retrieved directly from source",
    retrieverStrategy: "fts5",
    summaryProviderId: null,
    summaryProviderName: null,
    embeddingProviderId: null,
    embeddingProviderName: null,
    capabilities: {
      ...mode.capabilities,
      summary: false,
      safeChat: false,
      embeddings: false,
      reranking: false,
      requiresCustomDevBuild: false,
      unavailableReasons: [...mode.capabilities.unavailableReasons, reason],
      notes: [...mode.capabilities.notes, reason]
    },
    fallbackReason: reason
  };
}

async function createSelectedMode(): Promise<SelectedAIMode> {
  await verifyFts5Baseline();
  const registry = createLocalAIProviderRegistry();
  activeRegistry = registry;
  const detector = new DefaultCapabilityDetector(registry, disabledProviderIds);
  const report = await detector.getCapabilityReport();
  capabilityReportPromise = Promise.resolve(report);
  const mode = report.selectedMode;

  if (report.platform === "android" && (mode.id === "fts5-only" || mode.id === "fallback-fts5-only")) {
    logger.ai.warn("Using FTS5 because no local AI provider was selected.", {
      reasons: report.unavailableReasons.slice(0, 6)
    });
  } else {
    logger.ai.log("Selected device AI mode.", {
      modeId: mode.id,
      summaryProviderId: mode.summaryProviderId,
      embeddingProviderId: mode.embeddingProviderId,
      modelTier: mode.capabilities.modelTier ?? "unknown",
      recommendedModelTier: mode.capabilities.recommendedModelTier ?? "unknown"
    });
  }

  return {
    mode,
    summaryProvider: registry.byId(mode.summaryProviderId),
    embeddingProvider: registry.byId(mode.embeddingProviderId)
  };
}

function clearCachedSelection(): void {
  selectedModePromise = null;
  capabilityReportPromise = null;
}

function disposeActiveRegistry(reason: string): void {
  const registry = activeRegistry;
  activeRegistry = null;
  if (!registry) {
    return;
  }

  void registry.dispose().catch((error) => {
    logger.ai.warn("Local AI provider cleanup failed.", {
      reason,
      error: error instanceof Error ? error.message : String(error)
    });
  });
}

/**
 * Disposes the current registry and replaces the cached selection with a
 * promise that waits for that disposal before creating the next registry.
 * Publishing the promise synchronously means concurrent getSelectedAIMode
 * callers also wait instead of racing a new native context against the old
 * one's release. Rejections are not cached, so a transient selection failure
 * does not disable local AI for the rest of the session.
 */
function selectAfterRegistryDisposal(reason: string): Promise<SelectedAIMode> {
  const registry = activeRegistry;
  activeRegistry = null;
  capabilityReportPromise = null;
  const next = replaceProviderRegistry(
    registry,
    createSelectedMode,
    (error) => logRegistryCleanupFailure(reason, error)
  );
  selectedModePromise = next;
  next.catch(() => {
    if (selectedModePromise === next) selectedModePromise = null;
  });
  return next;
}

function logRegistryCleanupFailure(reason: string, error: unknown): void {
  logger.ai.warn("Local AI provider cleanup failed.", {
    reason,
    error: error instanceof Error ? error.message : String(error)
  });
}

function releaseAllLlamaContextsBestEffort(): void {
  void import("llama.rn")
    .then((mod) => {
      if (typeof mod.releaseAllLlama === "function") {
        return mod.releaseAllLlama();
      }
    })
    .catch((error) => {
      logger.ai.warn("Global llama.rn cleanup failed.", {
        error: error instanceof Error ? error.message : String(error)
      });
    });
}

/**
 * Returns the cached selected AI mode, running capability detection on first call.
 * Subsequent calls return the same promise, making this safe to call from multiple components.
 */
export async function getSelectedAIMode(): Promise<SelectedAIMode> {
  if (!selectedModePromise) {
    logger.ai.log("Detecting device AI capabilities...");
    const next = createSelectedMode();
    selectedModePromise = next;
    next.catch(() => {
      if (selectedModePromise === next) selectedModePromise = null;
    });
  }

  return selectedModePromise;
}

export async function getCurrentAIMode(): Promise<DeviceAIMode> {
  const selected = await getSelectedAIMode();
  return selected.mode;
}

export async function getDeviceCapabilityReport(): Promise<DeviceCapabilityReport> {
  if (!capabilityReportPromise) {
    await getSelectedAIMode();
  }

  return capabilityReportPromise!;
}

export async function refreshDeviceCapabilities(): Promise<DeviceAIMode> {
  if (!capabilityRefreshPromise) {
    capabilityRefreshPromise = selectAfterRegistryDisposal("Refreshing device capabilities.")
      .then((selected) => selected.mode)
      .finally(() => {
        capabilityRefreshPromise = null;
      });
  }
  return capabilityRefreshPromise;
}

export function releaseLocalAIForMemoryPressure(reason: string): void {
  disposeActiveRegistry(reason);
  clearCachedSelection();
  releaseAllLlamaContextsBestEffort();
}

/**
 * Marks a provider as failed for the remainder of the current app session,
 * clears the mode cache so the next call re-selects without it, and logs the error.
 */
export async function disableAIProviderForSession(providerId: string, error: unknown): Promise<void> {
  disabledProviderIds.add(providerId);
  logger.ai.warn(`Provider disabled for session: ${providerId}`, {
    error: error instanceof Error ? error.message : String(error)
  });
  await selectAfterRegistryDisposal(`Provider disabled for session: ${providerId}`).then(
    () => undefined,
    () => undefined
  );
}

export function forceFallbackModeForResponse(mode: DeviceAIMode, reason: string): DeviceAIMode {
  return toFallbackMode(mode, reason);
}

/**
 * Eagerly loads the active local AI provider's chat model so the first user
 * message doesn't pay the cold-start cost. Safe to call repeatedly; safe to
 * call even when local AI isn't available (it just no-ops).
 */
export async function prewarmLocalAIForChat(): Promise<void> {
  try {
    const chatStatus = await getActiveChatModelStatus();
    let selected = await getSelectedAIMode();
    if (chatStatus.state === "available" && !selected.mode.capabilities.safeChat) {
      await refreshDeviceCapabilities();
      selected = await getSelectedAIMode();
    }
    if (!selected.mode.capabilities.safeChat) return;
    await selected.summaryProvider?.prewarm?.();
  } catch (error) {
    logger.ai.warn("Local AI prewarm skipped due to error.", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export function resetModeSelectionForTests(): void {
  disabledProviderIds.clear();
  capabilityRefreshPromise = null;
  disposeActiveRegistry("Resetting mode selection for tests.");
  clearCachedSelection();
}
