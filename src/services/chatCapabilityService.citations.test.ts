import { describe, expect, it } from "vitest";

import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import type { SearchResult } from "@/types/search";

import { buildDeterministicCapabilityResponse } from "./chatCapabilityService";
import type { SourceAnswerDraft } from "./sourceAnswerService";

function mode(): DeviceAIMode {
  return {
    id: "fts5-only",
    label: "Source Search",
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
      approximateDeviceCapability: "standard",
      architecture: null,
      freeStorageGB: null,
      memoryGB: null,
      memoryClass: null,
      unavailableReasons: [],
      notes: []
    },
    platform: "test",
    platformVersion: "test",
    detectedAt: "2026-05-24T00:00:00.000Z",
    fallbackReason: null
  };
}

function result(chunkId: string, documentId: string, answer: string): SearchResult {
  return {
    id: 1,
    chunkId,
    documentId,
    documentTitle: documentId,
    documentType: "procedure",
    sectionTitle: answer,
    processName: answer,
    content: answer,
    answer,
    citation: documentId,
    pageNumber: null,
    category: "Student Administration",
    office: "Student Affairs",
    tags: [],
    lastUpdated: null,
    synonyms: [],
    steps: null,
    prerequisites: null,
    officeLocation: null,
    contactInfo: null,
    priority: 1,
    snippet: null,
    contentHighlight: null,
    bm25Score: 1,
    rankScore: 1,
    confidence: "high"
  };
}

describe("summary source alignment", () => {
  it("summarizes and cites only chunks from the selected source document", () => {
    const top = result("lost-id-step-1", "osa", "Report the lost ID to Student Affairs.");
    const supporting = result("lost-id-step-2", "osa", "Bring the required replacement documents.");
    const unrelated = result("clinic-hours", "clinic", "The clinic opens during regular office hours.");
    const draft: SourceAnswerDraft = {
      confidence: "high",
      normalizedQuestion: "summarize lost id",
      provenance: "Retrieved directly from source",
      reliable: true,
      results: [top, supporting, unrelated],
      selectedMode: { mode: mode(), summaryProvider: null, embeddingProvider: null },
      topResult: top
    };

    const response = buildDeterministicCapabilityResponse("Summarize lost ID replacement.", "summary", draft);

    expect(response.citationsUsed).toEqual([top.chunkId, supporting.chunkId]);
    expect(response.answerText).toContain("Bring the required replacement documents.");
    expect(response.answerText).not.toContain("clinic opens");
  });
});
