import { Platform } from "react-native";

import type { LocalAICapabilities } from "./LocalAIProvider";
import { unavailableCapabilities } from "./LocalAIProvider";
import type { ModelRuntimeFormat } from "./modelDownloadConfig";
import {
  getLiteRtLmNativeModule,
  getOnnxGenAiNativeModule,
  type HakiLocalAIModule
} from "./nativeModules";
import { logger } from "@/utils/logger";

type NativeRuntimeFormat = Extract<ModelRuntimeFormat, "litert-lm" | "onnx-genai">;
type NativeRuntimePlatform = "android" | "ios";

interface NativeRuntimeAdapterConfig {
  id: NativeRuntimeFormat;
  name: string;
  minimumOS: string;
  supportedPlatforms: NativeRuntimePlatform[];
  getModule: () => HakiLocalAIModule | null;
}

class NativeRuntimeAdapter {
  readonly id: NativeRuntimeFormat;
  readonly name: string;
  readonly minimumOS: string;

  private readonly supportedPlatforms: NativeRuntimePlatform[];
  private readonly moduleLoader: () => HakiLocalAIModule | null;

  constructor(config: NativeRuntimeAdapterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.minimumOS = config.minimumOS;
    this.supportedPlatforms = config.supportedPlatforms;
    this.moduleLoader = config.getModule;
  }

  isPlatformSupported(): boolean {
    return this.supportedPlatforms.includes(Platform.OS as NativeRuntimePlatform);
  }

  getModule(): HakiLocalAIModule | null {
    return this.moduleLoader();
  }

  async isRuntimeAvailable(warning = `${this.name} runtime check failed`): Promise<boolean> {
    if (!this.isPlatformSupported()) return false;
    const nativeModule = this.getModule();
    if (!nativeModule) return false;

    try {
      if (nativeModule.isRuntimeAvailable) return (await nativeModule.isRuntimeAvailable()) === true;
      if (nativeModule.isAvailable) return (await nativeModule.isAvailable()) === true;
      return true;
    } catch (error) {
      logger.ai.warn(warning, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  unavailable(notes: string[]): LocalAICapabilities {
    return {
      ...unavailableCapabilities(notes, this.minimumOS),
      runtimeFormat: this.id
    };
  }

  async release(): Promise<void> {
    await this.getModule()?.release?.();
  }
}

export const liteRtLmRuntime = new NativeRuntimeAdapter({
  id: "litert-lm",
  name: "LiteRT-LM",
  minimumOS: "Android preview build with HakiLiteRtLm native bridge",
  supportedPlatforms: ["android"],
  getModule: getLiteRtLmNativeModule
});

export const onnxGenAiRuntime = new NativeRuntimeAdapter({
  id: "onnx-genai",
  name: "ONNX Runtime GenAI",
  minimumOS: "Android/iOS build with HakiOnnxGenAi native bridge",
  supportedPlatforms: ["android", "ios"],
  getModule: getOnnxGenAiNativeModule
});
