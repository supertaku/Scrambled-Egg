import { describe, expect, it } from "vitest";

import { unavailableCapabilities, type LocalAICapabilities, type LocalAIProvider, type LocalAIProviderId } from "@/ai/LocalAIProvider";
import { selectDeviceAIMode, type ProviderProbe } from "@/ai/modeSelectionPolicy";

function capabilities(overrides: Partial<LocalAICapabilities> = {}): LocalAICapabilities {
  return {
    ...unavailableCapabilities([], "Android 12"),
    approximateDeviceCapability: "high",
    memoryClass: "8GB",
    unavailableReasons: [],
    notes: [],
    ...overrides
  };
}

function probe(id: string, caps: LocalAICapabilities): ProviderProbe {
  const provider: LocalAIProvider = {
    id: id as LocalAIProviderId,
    name: id,
    isAvailable: async () => true,
    getCapabilities: async () => caps,
    summarizeFromSources: async () => ({
      status: "no_reliable_answer",
      text: "",
      citationIds: [],
      providerId: id as LocalAIProviderId,
      providerName: id
    }),
    answerSafeChat: async () => ({
      status: "ok",
      text: "ready",
      providerId: id as LocalAIProviderId,
      providerName: id
    })
  };
  return { provider, available: true, capabilities: caps };
}

describe("mode selection", () => {
  it("routes Android chat through an active LiteRT-LM provider before llama.rn", () => {
    const liteRt = probe("litert-lm", capabilities({
      summary: true,
      safeChat: true,
      providerReady: true,
      modelAssetsAvailable: true,
      modelImportStatus: "available"
    }));
    const llama = probe("llama-rn", capabilities({
      summary: true,
      safeChat: true,
      providerReady: true,
      modelAssetsAvailable: true,
      modelImportStatus: "available"
    }));

    const result = selectDeviceAIMode({
      reportProbes: [liteRt, llama],
      fallbackCapabilities: capabilities(),
      approximateDeviceCapability: "high",
      memoryClass: "8GB",
      platform: "android",
      platformVersion: "35",
      now: "2026-06-11T00:00:00.000Z"
    });

    expect(result.selectedMode.summaryProviderId).toBe("litert-lm");
    expect(result.summaryProbe?.provider.id).toBe("litert-lm");
  });
});
