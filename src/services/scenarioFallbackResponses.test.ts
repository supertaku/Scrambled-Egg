import { describe, expect, it } from "vitest";

import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import { buildSourceMissFallbackResponse } from "@/services/scenarioResponseService";

function stubMode(): DeviceAIMode {
  return {
    id: "fts5-only",
    label: "Offline Mode: Source Search",
    provenance: "Retrieved directly from source",
    retrieverStrategy: "fts5",
    summaryProviderId: null,
    summaryProviderName: null,
    embeddingProviderId: null,
    embeddingProviderName: null,
    capabilities: {
      summary: false,
      safeChat: false,
      embeddings: false,
      reranking: false,
      providerReady: false,
      requiresCustomDevBuild: false,
      minimumOS: null,
      modelAssetsAvailable: null,
      approximateDeviceCapability: "unknown",
      architecture: null,
      freeStorageGB: null,
      memoryGB: null,
      memoryClass: null,
      unavailableReasons: [],
      notes: []
    },
    platform: "node",
    platformVersion: "test",
    detectedAt: new Date().toISOString(),
    fallbackReason: null
  };
}

describe("buildSourceMissFallbackResponse", () => {
  it("marks unreliable source misses without refusing as unsafe", () => {
    const intent = {
      type: "safe_question" as const,
      capability: "university_answer" as const,
      language: "english" as const,
      route: "source_context" as const,
      scenario: "student_admin" as const
    };
    const response = buildSourceMissFallbackResponse("lost ID card", intent, stubMode());
    expect(response.reliable).toBe(false);
    expect(response.confidence).toBe("low");
    expect(response.provenance).toBe("No reliable saved source found");
    expect(response.answerText).toContain("For now,");
    expect(response.responseType).toBe("source");
  });
});
