import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import type { ChatMessage } from "@/types/chat";
import type { SearchResult } from "@/types/search";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn()
  }
}));

import AsyncStorage from "@react-native-async-storage/async-storage";

import { saveChatFeedback } from "./chatFeedbackService";

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

function result(chunkId: string, title: string): SearchResult {
  return {
    id: 1,
    chunkId,
    documentId: chunkId,
    documentTitle: title,
    documentType: "procedure",
    sectionTitle: title,
    processName: title,
    content: title,
    answer: title,
    citation: title,
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  vi.mocked(AsyncStorage.setItem).mockResolvedValue();
});

describe("chat feedback source snapshots", () => {
  it("stores only source chunks cited by the displayed answer", async () => {
    const cited = result("lost-id", "Lost ID");
    const retrievedOnly = result("clinic-hours", "Clinic Hours");
    const message: ChatMessage = {
      id: "answer-1",
      sender: "haki",
      text: "Report the lost ID to Student Affairs.",
      result: cited,
      response: {
        question: "What should I do if I lose my ID?",
        requestedChatRole: "haki",
        answerBasis: "campus_sources",
        responseType: "source",
        results: [cited, retrievedOnly],
        confidence: "high",
        reliable: true,
        topResult: cited,
        answerText: "Report the lost ID to Student Affairs.",
        citationsUsed: [cited.chunkId],
        provenance: "Retrieved directly from source",
        activeMode: mode()
      }
    };

    const entry = await saveChatFeedback(message, message.response?.question ?? "", "helpful");

    expect(entry.sources.map((source) => source.chunkId)).toEqual([cited.chunkId]);
  });
});
