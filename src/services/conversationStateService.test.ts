import { describe, expect, it } from "vitest";

import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import type { ChatMessage } from "@/types/chat";
import type { SearchResult } from "@/types/search";

import { classifyStudentQuestionIntent } from "./questionIntentService";
import { buildConversationState } from "./conversationStateService";

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

function result(chunkId: string, processName: string): SearchResult {
  return {
    id: 1,
    chunkId,
    documentId: "osa",
    documentTitle: "OSA",
    documentType: "procedure",
    sectionTitle: processName,
    processName,
    content: processName,
    answer: processName,
    citation: "OSA",
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

function campusMessage(results: SearchResult[], citationsUsed: string[]): ChatMessage {
  const topResult = results[0];
  if (!topResult) {
    throw new Error("A campus message fixture needs at least one result.");
  }

  return {
    id: "assistant-1",
    sender: "haki",
    text: "Saved campus answer.",
    result: topResult,
    response: {
      question: "Prior question",
      requestedChatRole: "haki",
      answerBasis: "campus_sources",
      responseType: "source",
      results,
      confidence: "high",
      reliable: true,
      topResult,
      answerText: "Saved campus answer.",
      citationsUsed,
      provenance: "Retrieved directly from source",
      activeMode: mode()
    }
  };
}

describe("conversation source anchors", () => {
  it("carries a single cited campus process into the next turn as metadata", () => {
    const source = result("lost-id", "Replacement of lost ID");
    const state = buildConversationState({
      intent: classifyStudentQuestionIntent("What are the requirements?"),
      messages: [campusMessage([source], [source.chunkId])],
      question: "What are the requirements?"
    });

    expect(state.lastSourceAnchor).toEqual({
      category: "Student Administration",
      chunkId: "lost-id",
      documentId: "osa",
      label: "Replacement of lost ID",
      office: "Student Affairs"
    });
    expect(state.hasAmbiguousSourceAnchor).toBeUndefined();
  });

  it("marks a prior multi-source answer as ambiguous instead of selecting a source", () => {
    const first = result("lost-id", "Replacement of lost ID");
    const second = result("temporary-id", "Temporary ID");
    const state = buildConversationState({
      intent: classifyStudentQuestionIntent("What are the requirements?"),
      messages: [campusMessage([first, second], [first.chunkId, second.chunkId])],
      question: "What are the requirements?"
    });

    expect(state.lastSourceAnchor).toBeUndefined();
    expect(state.hasAmbiguousSourceAnchor).toBe(true);
  });
});
