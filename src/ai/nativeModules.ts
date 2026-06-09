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
  isRuntimeAvailable?: () => Promise<boolean> | boolean;
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
  summarizeFromSources?: (input: SummarizeFromSourcesInput & { modelPath?: string }) => Promise<Partial<LocalSummaryResult> | string>;
  answerSafeChat?: (input: SafeChatInput & { modelPath?: string }) => Promise<Partial<SafeChatResult> | string>;
  streamSafeChat?: (
    input: SafeChatInput & { modelPath?: string },
    streamIdOrTokenCallback: string | ((token: string) => void)
  ) => Promise<Partial<SafeChatResult> | string>;
  embedText?: (text: string) => Promise<number[]>;
  isModelTierDownloaded?: (tier: string) => Promise<boolean>;
  release?: () => Promise<void> | void;
}

export function getAppleFoundationModelsNativeModule(): HakiLocalAIModule | null {
  try {
    const { requireNativeModule } = require("expo-modules-core");
    return requireNativeModule("HakiAppleFoundationModels") as HakiLocalAIModule;
  } catch (error) {
    return (NativeModules.HakiAppleFoundationModels as HakiLocalAIModule | undefined) ?? null;
  }
}

export function getLiteRtLmNativeModule(): HakiLocalAIModule | null {
  try {
    const { requireNativeModule } = require("expo-modules-core");
    return requireNativeModule("HakiLiteRtLm") as HakiLocalAIModule;
  } catch (error) {
    return (NativeModules.HakiLiteRtLm as HakiLocalAIModule | undefined) ?? null;
  }
}

export function getOnnxGenAiNativeModule(): HakiLocalAIModule | null {
  try {
    const { requireNativeModule } = require("expo-modules-core");
    return requireNativeModule("HakiOnnxGenAi") as HakiLocalAIModule;
  } catch (error) {
    return (NativeModules.HakiOnnxGenAi as HakiLocalAIModule | undefined) ?? null;
  }
}
