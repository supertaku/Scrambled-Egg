import { NativeModules } from "react-native";

import type {
  DeviceCapabilityClass,
  LocalModelTier,
  SafeChatInput,
  SafeChatResult,
  LocalSummaryResult,
  SummarizeFromSourcesInput
} from "./LocalAIProvider";

export interface HakiLocalAIModule {
  isAvailable?: () => Promise<boolean> | boolean;
  getCapabilities?: () => Promise<Partial<{
    summary: boolean;
    safeChat: boolean;
    embeddings: boolean;
    reranking: boolean;
    architecture: string | string[];
    freeStorageGB: number | string;
    memoryGB: number | string;
    modelAssetsAvailable: boolean;
    modelName: string;
    modelParameterCountB: number;
    modelQuantization: string;
    modelTier: LocalModelTier;
    recommendedModelTier: LocalModelTier;
    modelAssetPath: string;
    modelLoadTimeMs: number;
    lastInferenceTimeMs: number;
    streamingSupported: boolean;
    approximateDeviceCapability: DeviceCapabilityClass;
    memoryClass: string;
    unavailableReasons: string[];
  }>>;
  summarizeFromSources?: (input: SummarizeFromSourcesInput) => Promise<Partial<LocalSummaryResult> | string>;
  answerSafeChat?: (input: SafeChatInput) => Promise<Partial<SafeChatResult> | string>;
  streamSafeChat?: (
    input: SafeChatInput,
    streamIdOrTokenCallback: string | ((token: string) => void)
  ) => Promise<Partial<SafeChatResult> | string>;
  embedText?: (text: string) => Promise<number[]>;
  isModelTierDownloaded?: (tier: string) => Promise<boolean>;
  release?: () => Promise<void> | void;
}

export function getExecuTorchNativeModule(): HakiLocalAIModule | null {
  return (NativeModules.HakiExecuTorch as HakiLocalAIModule | undefined) ?? null;
}

export function getAppleFoundationModelsNativeModule(): HakiLocalAIModule | null {
  try {
    const { requireNativeModule } = require("expo-modules-core");
    return requireNativeModule("HakiAppleFoundationModels") as HakiLocalAIModule;
  } catch (error) {
    return (NativeModules.HakiAppleFoundationModels as HakiLocalAIModule | undefined) ?? null;
  }
}
