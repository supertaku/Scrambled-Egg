import { Platform } from "react-native";

import { unavailableCapabilities, type LocalAICapabilities } from "./LocalAIProvider";
import { getLiteRtLmNativeModule, type HakiLocalAIModule } from "./nativeModules";
import { logger } from "@/utils/logger";

class LiteRtLmRuntimeAdapter {
  readonly minimumOS = "Android build with the HakiLiteRtLm native bridge";

  isPlatformSupported(): boolean {
    return Platform.OS === "android";
  }

  getModule(): HakiLocalAIModule | null {
    return getLiteRtLmNativeModule();
  }

  async isRuntimeAvailable(warning = "LiteRT-LM runtime check failed"): Promise<boolean> {
    if (!this.isPlatformSupported()) return false;
    const nativeModule = this.getModule();
    if (!nativeModule) return false;
    try {
      if (nativeModule.isRuntimeAvailable) return (await nativeModule.isRuntimeAvailable()) === true;
      if (nativeModule.isAvailable) return (await nativeModule.isAvailable()) === true;
      return Boolean(nativeModule.answerSafeChat || nativeModule.summarizeFromSources);
    } catch (error) {
      logger.ai.warn(warning, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  unavailable(notes: string[]): LocalAICapabilities {
    return { ...unavailableCapabilities(notes, this.minimumOS), runtimeFormat: "litert-lm" };
  }

  async release(): Promise<void> {
    await this.getModule()?.release?.();
  }
}

export const liteRtLmRuntime = new LiteRtLmRuntimeAdapter();
