import type { DeviceAIMode } from "./DeviceAIMode";
import type { LocalAIProvider } from "./LocalAIProvider";
import type {
  AccelerationStatus,
  DeviceCapabilityClass,
  DeviceThermalState,
  LocalExecutionBackend,
  LocalAIProviderId,
  LocalModelPerformanceProfile,
  LocalModelTier
} from "./LocalAIProvider";
import { getDeviceHardwareProfile } from "./deviceHardwareProfile";
import { deviceCapabilityClassForTier, recommendedDeviceModelTier } from "./localModelMetadata";
import { selectDeviceAIMode, type ProviderProbe } from "./modeSelectionPolicy";
import {
  getDeviceCapabilitySnapshot,
  getPlatformVersionString,
  type NormalizedPlatform
} from "./providerUtils";
import { createLocalAIProviderRegistry, type LocalAIProviderRegistry } from "./providerRegistry";
import { logger } from "@/utils/logger";

export interface CapabilityDetector {
  detectBestMode(): Promise<DeviceAIMode>;
  getCapabilityReport(): Promise<DeviceCapabilityReport>;
  refreshCapabilities(): Promise<DeviceAIMode>;
}

export interface ProviderCapabilityReport {
  id: LocalAIProviderId;
  name: string;
  runtimeAvailable: boolean;
  available: boolean;
  summaryAvailable: boolean;
  safeChatAvailable: boolean;
  embeddingsAvailable: boolean;
  modelAssetsAvailable: boolean | null;
  modelName: string | null;
  modelParameterCountB: number | null;
  modelQuantization: string | null;
  modelTier: LocalModelTier;
  recommendedModelTier: LocalModelTier;
  bridgePresent: boolean;
  modelAssetPath: string | null;
  modelManifestPath: string | null;
  modelImportStatus: "missing" | "available" | "rejected" | "runtime_unavailable" | null;
  modelFileHash: string | null;
  modelRejectionReasons: string[];
  modelLoadTimeMs: number | null;
  lastInferenceTimeMs: number | null;
  contextWindowTokens: number | null;
  safeInputBudgetTokens: number | null;
  maxOutputTokens: number | null;
  streamingSupported: boolean;
  executionBackend: LocalExecutionBackend;
  availableBackends: string[];
  accelerationStatus: AccelerationStatus;
  performanceProfile: LocalModelPerformanceProfile | null;
  thermalState: DeviceThermalState;
  approximateDeviceCapability: DeviceCapabilityClass;
  architecture: string | null;
  freeStorageGB: number | null;
  memoryGB: number | null;
  memoryClass: string | null;
  unavailableReasons: string[];
  notes: string[];
}

export interface DeviceCapabilityReport {
  platform: NormalizedPlatform;
  osVersion: string;
  baseFtsAvailable: boolean;
  appleFoundationModelsAvailable: boolean;
  llamaRnAvailable: boolean;
  embeddingsAvailable: boolean;
  safeChatAvailable: boolean;
  summarizationAvailable: boolean;
  selectedMode: DeviceAIMode;
  unavailableReasons: string[];
  lastCheckedAt: string;
  approximateDeviceCapability: DeviceCapabilityClass;
  memoryClass: string | null;
  supportedAbis: string[];
  architecture: string | null;
  memoryGB: number | null;
  freeStorageGB: number | null;
  lowMemory: boolean | null;
  recommendedModelTier: LocalModelTier;
  providers: ProviderCapabilityReport[];
}

export class DefaultCapabilityDetector implements CapabilityDetector {
  constructor(
    private readonly registry: LocalAIProviderRegistry = createLocalAIProviderRegistry(),
    private readonly disabledProviderIds: ReadonlySet<string> = new Set()
  ) {}

  async detectBestMode(): Promise<DeviceAIMode> {
    const report = await this.getCapabilityReport();
    return report.selectedMode;
  }

  async refreshCapabilities(): Promise<DeviceAIMode> {
    return this.detectBestMode();
  }

  async getCapabilityReport(): Promise<DeviceCapabilityReport> {
    const fallbackCapabilities = await this.registry.fallback.getCapabilities();
    const reportOrder = [
      this.registry.appleFoundationModels,
      this.registry.liteRtLm,
      this.registry.onnxGenAi,
      this.registry.llamaRn
    ];
    const device = getDeviceCapabilitySnapshot();
    const hardware = await getDeviceHardwareProfile();

    const reportProbes: ProviderProbe[] = [];
    for (const provider of reportOrder) {
      reportProbes.push(await this.inspectProvider(provider));
    }

    const now = new Date().toISOString();
    const platform = device.platform;
    const platformVersion = device.osVersion || getPlatformVersionString();
    const selection = selectDeviceAIMode({
      reportProbes,
      fallbackCapabilities,
      approximateDeviceCapability: device.approximateDeviceCapability,
      memoryClass: device.memoryClass,
      platform,
      platformVersion,
      now
    });
    const { selectedMode, summaryProbe, embeddingProbe } = selection;
    const providerReports = reportProbes.map((probe) => this.toProviderReport(probe));
    const recommendedModelTier = recommendedDeviceModelTier(hardware);
    const approximateDeviceCapability =
      recommendedModelTier === "unknown"
        ? selectedMode.capabilities.approximateDeviceCapability
        : deviceCapabilityClassForTier(recommendedModelTier);
    const unavailableReasons = this.buildUnavailableReasons({
      summaryProbe,
      embeddingProbe,
      providerReports,
      deviceNotes: device.notes
    });

    return {
      platform,
      osVersion: platformVersion,
      baseFtsAvailable: true,
      appleFoundationModelsAvailable: providerReports.some(
        (provider) => provider.id === "apple-foundation-models" && provider.runtimeAvailable
      ),
      llamaRnAvailable: providerReports.some(
        (provider) => provider.id === "llama-rn" && provider.runtimeAvailable
      ),
      embeddingsAvailable: Boolean(embeddingProbe),
      safeChatAvailable: providerReports.some((provider) => provider.safeChatAvailable),
      summarizationAvailable: providerReports.some((provider) => provider.summaryAvailable),
      selectedMode,
      unavailableReasons,
      lastCheckedAt: now,
      approximateDeviceCapability,
      memoryClass: hardware.memoryClass ?? selectedMode.capabilities.memoryClass,
      supportedAbis: hardware.supportedAbis,
      architecture: hardware.architecture,
      memoryGB: hardware.memoryGB,
      freeStorageGB: hardware.freeStorageGB,
      lowMemory: hardware.lowMemory,
      recommendedModelTier,
      providers: providerReports
    };
  }

  private async inspectProvider(provider: LocalAIProvider): Promise<ProviderProbe> {
    if (this.disabledProviderIds.has(provider.id)) {
      const capabilities = await provider.getCapabilities().catch(() => ({
        summary: false,
        safeChat: false,
        embeddings: false,
        reranking: false,
        providerReady: false,
        requiresCustomDevBuild: true,
        minimumOS: null,
        modelAssetsAvailable: null,
        approximateDeviceCapability: "unknown" as const,
        memoryClass: null,
        unavailableReasons: [`${provider.name} is disabled after a runtime failure in this session.`],
        notes: [`${provider.name} is disabled after a runtime failure in this session.`]
      }));

      return {
        provider,
        available: false,
        capabilities: {
          ...capabilities,
          summary: false,
          safeChat: false,
          embeddings: false,
          providerReady: false,
          unavailableReasons: [
            `${provider.name} is disabled after a runtime failure in this session.`,
            ...capabilities.unavailableReasons
          ]
        }
      };
    }

    try {
      const [available, capabilities] = await Promise.all([provider.isAvailable(), provider.getCapabilities()]);
      return { provider, available, capabilities };
    } catch (error) {
      logger.ai.warn(`${provider.name} detection failed`, { error: error instanceof Error ? error.message : String(error) });
      return {
        provider,
        available: false,
        capabilities: {
          summary: false,
          safeChat: false,
          embeddings: false,
          reranking: false,
          providerReady: false,
          requiresCustomDevBuild: true,
          minimumOS: null,
          modelAssetsAvailable: null,
          approximateDeviceCapability: "unknown",
          memoryClass: null,
          unavailableReasons: [`${provider.name} detection failed and was ignored for this session.`],
          notes: [`${provider.name} detection failed and was ignored for this session.`]
        }
      };
    }
  }

  private toProviderReport(probe: ProviderProbe): ProviderCapabilityReport {
    const unavailableReasons = [
      ...(probe.available ? [] : [`${probe.provider.name} runtime is unavailable.`]),
      ...probe.capabilities.unavailableReasons
    ];

    return {
      id: probe.provider.id,
      name: probe.provider.name,
      runtimeAvailable: probe.available,
      available: probe.available && probe.capabilities.providerReady,
      summaryAvailable: probe.available && probe.capabilities.summary,
      safeChatAvailable: probe.available && probe.capabilities.safeChat,
      embeddingsAvailable: probe.available && probe.capabilities.embeddings,
      modelAssetsAvailable: probe.capabilities.modelAssetsAvailable,
      modelName: probe.capabilities.modelName ?? null,
      modelParameterCountB: probe.capabilities.modelParameterCountB ?? null,
      modelQuantization: probe.capabilities.modelQuantization ?? null,
      modelTier: probe.capabilities.modelTier ?? "unknown",
      recommendedModelTier: probe.capabilities.recommendedModelTier ?? "unknown",
      bridgePresent: probe.capabilities.bridgePresent ?? false,
      modelAssetPath: probe.capabilities.modelAssetPath ?? null,
      modelManifestPath: probe.capabilities.modelManifestPath ?? null,
      modelImportStatus: probe.capabilities.modelImportStatus ?? null,
      modelFileHash: probe.capabilities.modelFileHash ?? null,
      modelRejectionReasons: probe.capabilities.modelRejectionReasons ?? [],
      modelLoadTimeMs: probe.capabilities.modelLoadTimeMs ?? null,
      lastInferenceTimeMs: probe.capabilities.lastInferenceTimeMs ?? null,
      contextWindowTokens: probe.capabilities.contextWindowTokens ?? null,
      safeInputBudgetTokens: probe.capabilities.safeInputBudgetTokens ?? null,
      maxOutputTokens: probe.capabilities.maxOutputTokens ?? null,
      streamingSupported: probe.capabilities.streamingSupported ?? false,
      executionBackend: probe.capabilities.executionBackend ?? "unknown",
      availableBackends: probe.capabilities.availableBackends ?? [],
      accelerationStatus: probe.capabilities.accelerationStatus ?? "not_checked",
      performanceProfile: probe.capabilities.performanceProfile ?? null,
      thermalState: probe.capabilities.thermalState ?? "unknown",
      approximateDeviceCapability: probe.capabilities.approximateDeviceCapability,
      architecture: probe.capabilities.architecture ?? null,
      freeStorageGB: probe.capabilities.freeStorageGB ?? null,
      memoryGB: probe.capabilities.memoryGB ?? null,
      memoryClass: probe.capabilities.memoryClass,
      unavailableReasons: Array.from(new Set(unavailableReasons)),
      notes: probe.capabilities.notes
    };
  }

  private buildUnavailableReasons(input: {
    summaryProbe: ProviderProbe | null;
    embeddingProbe: ProviderProbe | null;
    providerReports: ProviderCapabilityReport[];
    deviceNotes: string[];
  }): string[] {
    const reasons = [
      ...input.deviceNotes,
      ...input.providerReports.flatMap((provider) => provider.unavailableReasons)
    ];

    if (!input.summaryProbe) {
      reasons.push("Local summarization is unavailable, so Local Summary Mode and Hybrid Local AI cannot be selected.");
    }

    if (!input.embeddingProbe) {
      reasons.push("Local embeddings are unavailable, so Semantic Search Mode and Hybrid Local AI cannot be selected.");
    }

    return Array.from(new Set(reasons));
  }
}
