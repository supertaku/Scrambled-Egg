import type { DeviceAIMode } from "./DeviceAIMode";
import {
  HYBRID_LOCAL_AI_LABEL,
  LOCAL_SAFE_CHAT_LABEL,
  LOCAL_SUMMARY_LABEL,
  SEMANTIC_SEARCH_LABEL,
  SOURCE_SEARCH_LABEL,
  provenanceForSummaryProvider
} from "./DeviceAIMode";
import type {
  DeviceCapabilityClass,
  LocalAICapabilities,
  LocalAIProvider,
  LocalAIProviderId
} from "./LocalAIProvider";
import type { NormalizedPlatform } from "./providerUtils";

export interface ProviderProbe {
  provider: LocalAIProvider;
  available: boolean;
  capabilities: LocalAICapabilities;
}

export interface ModeSelectionInput {
  reportProbes: ProviderProbe[];
  fallbackCapabilities: LocalAICapabilities;
  approximateDeviceCapability: DeviceCapabilityClass;
  memoryClass: string | null;
  platform: NormalizedPlatform;
  platformVersion: string;
  now: string;
}

export interface ModeSelectionResult {
  selectedMode: DeviceAIMode;
  summaryProbe: ProviderProbe | null;
  embeddingProbe: ProviderProbe | null;
}

function mergeCapabilities(
  fallbackCapabilities: LocalAICapabilities,
  summaryProbe: ProviderProbe | null,
  embeddingProbe: ProviderProbe | null,
  approximateDeviceCapability: DeviceCapabilityClass,
  memoryClass: string | null
): LocalAICapabilities {
  const notes = [
    ...fallbackCapabilities.notes,
    ...(summaryProbe?.capabilities.notes ?? []),
    ...(embeddingProbe && embeddingProbe.provider.id !== summaryProbe?.provider.id ? embeddingProbe.capabilities.notes : [])
  ];

  return {
    summary: Boolean(summaryProbe?.capabilities.summary),
    safeChat: Boolean(summaryProbe?.capabilities.safeChat),
    embeddings: Boolean(embeddingProbe?.capabilities.embeddings),
    reranking: Boolean(summaryProbe?.capabilities.reranking || embeddingProbe?.capabilities.reranking),
    providerReady: true,
    requiresCustomDevBuild: Boolean(
      summaryProbe?.capabilities.requiresCustomDevBuild || embeddingProbe?.capabilities.requiresCustomDevBuild
    ),
    minimumOS: summaryProbe?.capabilities.minimumOS ?? embeddingProbe?.capabilities.minimumOS ?? fallbackCapabilities.minimumOS,
    modelAssetsAvailable:
      summaryProbe?.capabilities.modelAssetsAvailable ??
      embeddingProbe?.capabilities.modelAssetsAvailable ??
      fallbackCapabilities.modelAssetsAvailable,
    modelName: summaryProbe?.capabilities.modelName ?? embeddingProbe?.capabilities.modelName ?? fallbackCapabilities.modelName ?? null,
    modelParameterCountB:
      summaryProbe?.capabilities.modelParameterCountB ??
      embeddingProbe?.capabilities.modelParameterCountB ??
      fallbackCapabilities.modelParameterCountB ??
      null,
    modelQuantization:
      summaryProbe?.capabilities.modelQuantization ??
      embeddingProbe?.capabilities.modelQuantization ??
      fallbackCapabilities.modelQuantization ??
      null,
    modelTier:
      summaryProbe?.capabilities.modelTier ??
      embeddingProbe?.capabilities.modelTier ??
      fallbackCapabilities.modelTier ??
      "unknown",
    recommendedModelTier:
      summaryProbe?.capabilities.recommendedModelTier ??
      embeddingProbe?.capabilities.recommendedModelTier ??
      fallbackCapabilities.recommendedModelTier ??
      "unknown",
    bridgePresent: Boolean(
      summaryProbe?.capabilities.bridgePresent ??
      embeddingProbe?.capabilities.bridgePresent ??
      fallbackCapabilities.bridgePresent
    ),
    modelAssetPath:
      summaryProbe?.capabilities.modelAssetPath ??
      embeddingProbe?.capabilities.modelAssetPath ??
      fallbackCapabilities.modelAssetPath ??
      null,
    modelManifestPath:
      summaryProbe?.capabilities.modelManifestPath ??
      embeddingProbe?.capabilities.modelManifestPath ??
      fallbackCapabilities.modelManifestPath ??
      null,
    modelImportStatus:
      summaryProbe?.capabilities.modelImportStatus ??
      embeddingProbe?.capabilities.modelImportStatus ??
      fallbackCapabilities.modelImportStatus ??
      "missing",
    modelFileHash:
      summaryProbe?.capabilities.modelFileHash ??
      embeddingProbe?.capabilities.modelFileHash ??
      fallbackCapabilities.modelFileHash ??
      null,
    modelRejectionReasons: Array.from(
      new Set([
        ...(summaryProbe?.capabilities.modelRejectionReasons ?? []),
        ...(embeddingProbe?.capabilities.modelRejectionReasons ?? []),
        ...(fallbackCapabilities.modelRejectionReasons ?? [])
      ])
    ),
    modelLoadTimeMs:
      summaryProbe?.capabilities.modelLoadTimeMs ??
      embeddingProbe?.capabilities.modelLoadTimeMs ??
      fallbackCapabilities.modelLoadTimeMs ??
      null,
    lastInferenceTimeMs:
      summaryProbe?.capabilities.lastInferenceTimeMs ??
      embeddingProbe?.capabilities.lastInferenceTimeMs ??
      fallbackCapabilities.lastInferenceTimeMs ??
      null,
    contextWindowTokens:
      summaryProbe?.capabilities.contextWindowTokens ??
      embeddingProbe?.capabilities.contextWindowTokens ??
      fallbackCapabilities.contextWindowTokens ??
      null,
    safeInputBudgetTokens:
      summaryProbe?.capabilities.safeInputBudgetTokens ??
      embeddingProbe?.capabilities.safeInputBudgetTokens ??
      fallbackCapabilities.safeInputBudgetTokens ??
      null,
    maxOutputTokens:
      summaryProbe?.capabilities.maxOutputTokens ??
      embeddingProbe?.capabilities.maxOutputTokens ??
      fallbackCapabilities.maxOutputTokens ??
      null,
    streamingSupported: Boolean(
      summaryProbe?.capabilities.streamingSupported ||
      embeddingProbe?.capabilities.streamingSupported ||
      fallbackCapabilities.streamingSupported
    ),
    approximateDeviceCapability:
      summaryProbe?.capabilities.approximateDeviceCapability !== "unknown"
        ? summaryProbe?.capabilities.approximateDeviceCapability ?? approximateDeviceCapability
        : embeddingProbe?.capabilities.approximateDeviceCapability !== "unknown"
          ? embeddingProbe?.capabilities.approximateDeviceCapability ?? approximateDeviceCapability
          : approximateDeviceCapability,
    architecture:
      summaryProbe?.capabilities.architecture ??
      embeddingProbe?.capabilities.architecture ??
      fallbackCapabilities.architecture ??
      null,
    freeStorageGB:
      summaryProbe?.capabilities.freeStorageGB ??
      embeddingProbe?.capabilities.freeStorageGB ??
      fallbackCapabilities.freeStorageGB ??
      null,
    memoryGB:
      summaryProbe?.capabilities.memoryGB ??
      embeddingProbe?.capabilities.memoryGB ??
      fallbackCapabilities.memoryGB ??
      null,
    memoryClass: summaryProbe?.capabilities.memoryClass ?? embeddingProbe?.capabilities.memoryClass ?? memoryClass,
    unavailableReasons: Array.from(
      new Set([
        ...(summaryProbe?.capabilities.unavailableReasons ?? []),
        ...(embeddingProbe?.capabilities.unavailableReasons ?? [])
      ])
    ),
    notes: Array.from(new Set(notes))
  };
}

function isUsableSummaryProbe(probe: ProviderProbe): boolean {
  return probe.available && (probe.capabilities.summary || probe.capabilities.safeChat);
}

function isUsableEmbeddingProbe(probe: ProviderProbe): boolean {
  return probe.available && probe.capabilities.embeddings && Boolean(probe.provider.embedText);
}

function findProbe(reportProbes: ProviderProbe[], providerId: LocalAIProviderId): ProviderProbe | null {
  return reportProbes.find((probe) => probe.provider.id === providerId) ?? null;
}

function buildHybridMode(input: ModeSelectionInput, providerProbe: ProviderProbe): ModeSelectionResult {
  const capabilities = mergeCapabilities(
    input.fallbackCapabilities,
    providerProbe,
    providerProbe,
    input.approximateDeviceCapability,
    input.memoryClass
  );

  return {
    selectedMode: {
      id: "hybrid-local-ai",
      label: HYBRID_LOCAL_AI_LABEL,
      provenance: "Retrieved with hybrid search",
      retrieverStrategy: "hybrid",
      summaryProviderId: providerProbe.provider.id,
      summaryProviderName: providerProbe.provider.name,
      embeddingProviderId: providerProbe.provider.id,
      embeddingProviderName: providerProbe.provider.name,
      capabilities,
      platform: input.platform,
      platformVersion: input.platformVersion,
      detectedAt: input.now,
      fallbackReason: null
    },
    summaryProbe: providerProbe,
    embeddingProbe: providerProbe
  };
}

function buildLocalSummaryMode(input: ModeSelectionInput, providerProbe: ProviderProbe): ModeSelectionResult {
  const capabilities = mergeCapabilities(
    input.fallbackCapabilities,
    providerProbe,
    null,
    input.approximateDeviceCapability,
    input.memoryClass
  );
  const hasSummary = providerProbe.capabilities.summary;

  return {
    selectedMode: {
      id: hasSummary ? "local-summary" : "local-safe-chat",
      label: hasSummary ? LOCAL_SUMMARY_LABEL : LOCAL_SAFE_CHAT_LABEL,
      provenance: hasSummary ? provenanceForSummaryProvider(providerProbe.provider.id) : "Answered with local safe chat",
      retrieverStrategy: "fts5",
      summaryProviderId: providerProbe.provider.id,
      summaryProviderName: providerProbe.provider.name,
      embeddingProviderId: null,
      embeddingProviderName: null,
      capabilities,
      platform: input.platform,
      platformVersion: input.platformVersion,
      detectedAt: input.now,
      fallbackReason: null
    },
    summaryProbe: providerProbe,
    embeddingProbe: null
  };
}

function buildSemanticMode(input: ModeSelectionInput, providerProbe: ProviderProbe): ModeSelectionResult {
  const capabilities = mergeCapabilities(
    input.fallbackCapabilities,
    null,
    providerProbe,
    input.approximateDeviceCapability,
    input.memoryClass
  );

  return {
    selectedMode: {
      id: "semantic-search",
      label: SEMANTIC_SEARCH_LABEL,
      provenance: "Retrieved with semantic search",
      retrieverStrategy: "semantic",
      summaryProviderId: null,
      summaryProviderName: null,
      embeddingProviderId: providerProbe.provider.id,
      embeddingProviderName: providerProbe.provider.name,
      capabilities,
      platform: input.platform,
      platformVersion: input.platformVersion,
      detectedAt: input.now,
      fallbackReason: null
    },
    summaryProbe: null,
    embeddingProbe: providerProbe
  };
}

function buildFtsOnlyMode(input: ModeSelectionInput): ModeSelectionResult {
  const capabilities = mergeCapabilities(
    input.fallbackCapabilities,
    null,
    null,
    input.approximateDeviceCapability,
    input.memoryClass
  );

  return {
    selectedMode: {
      id: "fts5-only",
      label: SOURCE_SEARCH_LABEL,
      provenance: "Retrieved directly from source",
      retrieverStrategy: "fts5",
      summaryProviderId: null,
      summaryProviderName: null,
      embeddingProviderId: null,
      embeddingProviderName: null,
      capabilities,
      platform: input.platform,
      platformVersion: input.platformVersion,
      detectedAt: input.now,
      fallbackReason: null
    },
    summaryProbe: null,
    embeddingProbe: null
  };
}

export function selectDeviceAIMode(input: ModeSelectionInput): ModeSelectionResult {
  const appleProbe = findProbe(input.reportProbes, "apple-foundation-models");
  const llamaProbe = findProbe(input.reportProbes, "llama-rn");

  if (input.platform === "ios") {
    if (appleProbe && isUsableSummaryProbe(appleProbe) && isUsableEmbeddingProbe(appleProbe)) {
      return buildHybridMode(input, appleProbe);
    }
    if (appleProbe && isUsableSummaryProbe(appleProbe)) {
      return buildLocalSummaryMode(input, appleProbe);
    }
    if (llamaProbe && isUsableSummaryProbe(llamaProbe) && isUsableEmbeddingProbe(llamaProbe)) {
      return buildHybridMode(input, llamaProbe);
    }
    if (llamaProbe && isUsableSummaryProbe(llamaProbe)) {
      return buildLocalSummaryMode(input, llamaProbe);
    }
    if (llamaProbe && isUsableEmbeddingProbe(llamaProbe)) {
      return buildSemanticMode(input, llamaProbe);
    }
  }

  if (input.platform === "android") {
    if (llamaProbe && isUsableSummaryProbe(llamaProbe) && isUsableEmbeddingProbe(llamaProbe)) {
      return buildHybridMode(input, llamaProbe);
    }
    if (llamaProbe && isUsableSummaryProbe(llamaProbe)) {
      return buildLocalSummaryMode(input, llamaProbe);
    }
    if (llamaProbe && isUsableEmbeddingProbe(llamaProbe)) {
      return buildSemanticMode(input, llamaProbe);
    }
  }

  return buildFtsOnlyMode(input);
}
