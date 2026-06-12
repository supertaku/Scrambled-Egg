import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import type { ChatRole, SearchResponse, SearchResult } from "@/types/search";

vi.mock("./modeSelectionService", () => ({
  getSelectedAIMode: vi.fn(),
  getDeviceCapabilityReport: vi.fn()
}));
vi.mock("./safeLocalChatService", () => ({
  answerSafeLocalChatWithContext: vi.fn(),
  responseForUnsafeRequest: vi.fn()
}));
vi.mock("./sourceAnswerService", () => ({
  buildDeterministicSourceResponseFromDraft: vi.fn((question: string, draft: SourceAnswerDraft) => ({
    question,
    requestedChatRole: "haki",
    answerBasis: "campus_sources",
    responseType: "source",
    results: draft.results,
    confidence: draft.confidence,
    reliable: draft.reliable,
    topResult: draft.topResult,
    answerText: "Official saved campus procedure.",
    citationsUsed: draft.results.map((result) => result.chunkId),
    provenance: draft.provenance,
    activeMode: draft.selectedMode.mode
  })),
  retrieveSourceAnswerDraft: vi.fn()
}));

import { answerStudentQuestion } from "./answerService";
import { getSelectedAIMode } from "./modeSelectionService";
import { answerSafeLocalChatWithContext, responseForUnsafeRequest } from "./safeLocalChatService";
import { retrieveSourceAnswerDraft, type SourceAnswerDraft } from "./sourceAnswerService";

function mode(hasChat = true): DeviceAIMode {
  return {
    id: hasChat ? "local-safe-chat" : "fts5-only",
    label: hasChat ? "Test Local Chat" : "Source Search",
    provenance: hasChat ? "Answered with local safe chat" : "Retrieved directly from source",
    retrieverStrategy: "fts5",
    summaryProviderId: hasChat ? "llama-rn" : null,
    summaryProviderName: hasChat ? "Local" : null,
    embeddingProviderId: null,
    embeddingProviderName: null,
    capabilities: {
      summary: false, safeChat: hasChat, embeddings: false, reranking: false, providerReady: hasChat,
      requiresCustomDevBuild: false, minimumOS: null, modelAssetsAvailable: hasChat ? true : null,
      approximateDeviceCapability: "standard", architecture: null, freeStorageGB: null, memoryGB: null,
      memoryClass: null, unavailableReasons: [], notes: []
    },
    platform: "test",
    platformVersion: "test",
    detectedAt: "2026-05-24T00:00:00.000Z",
    fallbackReason: null
  };
}

function sourceResult(): SearchResult {
  return {
    id: 1,
    chunkId: "lost_id",
    documentId: "osa",
    documentTitle: "OSA",
    documentType: "procedure",
    sectionTitle: "Lost ID",
    processName: "Replacement of lost ID",
    content: "Report the lost ID to OSA.",
    answer: "Report the lost ID to OSA.",
    citation: "OSA Procedures",
    pageNumber: null,
    category: "Student Administration",
    office: "Student Affairs",
    tags: ["id"],
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

function sourceDraft(): SourceAnswerDraft {
  const result = sourceResult();
  return {
    confidence: "high",
    normalizedQuestion: "lost id",
    provenance: "Retrieved directly from source",
    reliable: true,
    results: [result],
    selectedMode: { mode: mode(), summaryProvider: null, embeddingProvider: null },
    topResult: result
  };
}

function generatedResponse(question: string): SearchResponse {
  return {
    question,
    requestedChatRole: "friendly_buddy",
    answerBasis: "friendly_guidance",
    responseType: "safe_local_chat",
    results: [],
    confidence: "medium",
    reliable: true,
    answerText: "That sounds difficult. Take one manageable next step.",
    citationsUsed: [],
    provenance: "Answered with local safe chat",
    activeMode: mode()
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSelectedAIMode).mockResolvedValue({
    mode: mode(),
    summaryProvider: { answerSafeChat: vi.fn() } as never,
    embeddingProvider: null
  });
  vi.mocked(retrieveSourceAnswerDraft).mockResolvedValue(sourceDraft());
  vi.mocked(answerSafeLocalChatWithContext).mockImplementation(async (question) => generatedResponse(question));
  vi.mocked(responseForUnsafeRequest).mockImplementation(async (question) => ({
    ...generatedResponse(question),
    reliable: false,
    answerText: "I cannot help with that request."
  }));
});

describe("four Haki modes", () => {
  it("uses deterministic saved information for Information Officer", async () => {
    const response = await answerStudentQuestion("What should I do if I lose my ID?", { chatRole: "information_officer" });
    expect(response.requestedChatRole).toBe("information_officer");
    expect(response.answerBasis).toBe("campus_sources");
    expect(response.answerText).toMatch(/Report the lost ID to OSA/i);
    expect(response.results[0]?.chunkId).toBe(sourceResult().chunkId);
    expect(answerSafeLocalChatWithContext).not.toHaveBeenCalled();
  });

  it("asks Information Officer users to switch for outside facts", async () => {
    const response = await answerStudentQuestion("What is photosynthesis?", { chatRole: "information_officer" });
    expect(response.suggestedModeActions?.map((item) => item.mode)).toContain("researcher");
    expect(retrieveSourceAnswerDraft).not.toHaveBeenCalled();
  });

  it("lets Friendly Buddy answer only supportive content of a mixed source request", async () => {
    const response = await answerStudentQuestion("I feel overwhelmed because I lost my ID. What should I do?", { chatRole: "friendly_buddy" });
    expect(answerSafeLocalChatWithContext).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ chatRole: "friendly_buddy" }));
    expect(response.answerBasis).toBe("friendly_guidance");
    expect(response.suggestedModeActions?.map((item) => item.mode)).toContain("information_officer");
    expect(response.results).toEqual([]);
    expect(retrieveSourceAnswerDraft).not.toHaveBeenCalled();
  });

  it("keeps Researcher fact reminders in the mode notice instead of answer text", async () => {
    const response = await answerStudentQuestion("What is photosynthesis?", { chatRole: "researcher" });
    expect(answerSafeLocalChatWithContext).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ chatRole: "researcher" }));
    expect(response.answerText).not.toMatch(/Haki can make mistakes|double-check with a trusted reference/i);
    expect(response.answerBasis).toBe("researcher_facts");
  });

  it("composes default Haki support with deterministic campus sources", async () => {
    const response = await answerStudentQuestion("I feel overwhelmed because I lost my ID. What should I do?", { chatRole: "haki" });
    expect(response.answerBasis).toBe("haki_composed");
    expect(response.answerText).toMatch(/Campus information from saved sources/);
    expect(response.answerText).toMatch(/Supportive guidance/);
    expect(response.results[0]?.chunkId).toBe(sourceResult().chunkId);
  });

  it("does not stream a partial section for a composed multi-domain answer", async () => {
    const onToken = vi.fn();

    await answerStudentQuestion("I feel overwhelmed because I lost my ID. What should I do?", {
      chatRole: "haki",
      onToken
    });

    expect(answerSafeLocalChatWithContext).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({ onToken })
    );
  });

  it("keeps Haki selected without a model and still answers saved campus information", async () => {
    vi.mocked(getSelectedAIMode).mockResolvedValue({ mode: mode(false), summaryProvider: null, embeddingProvider: null });
    const source = await answerStudentQuestion("What should I do if I lose my ID?", { chatRole: "haki" });
    const fact = await answerStudentQuestion("What is photosynthesis?", { chatRole: "haki" });
    expect(source.requestedChatRole).toBe("haki");
    expect(source.answerBasis).toBe("campus_sources");
    expect(fact.requestedChatRole).toBe("haki");
    expect(fact.answerText).toMatch(/Set up a chat model/i);
  });

  it("grounds a generic Haki follow-up in the single prior cited campus source", async () => {
    const response = await answerStudentQuestion("What are the requirements?", {
      chatRole: "haki",
      conversationState: {
        lastSourceAnchor: {
          category: "Student Administration",
          chunkId: "lost_id",
          documentId: "osa",
          label: "Replacement of lost ID",
          office: "Student Affairs"
        }
      }
    });

    expect(retrieveSourceAnswerDraft).toHaveBeenCalledWith(
      "What are the requirements? Replacement of lost ID",
      expect.objectContaining({
        scope: {
          category: "Student Administration",
          documentId: "osa",
          office: "Student Affairs"
        }
      }),
      expect.anything()
    );
    expect(response.answerBasis).toBe("campus_sources");
    expect(answerSafeLocalChatWithContext).not.toHaveBeenCalled();
  });

  it("asks for clarification when a generic source follow-up has multiple possible prior sources", async () => {
    const response = await answerStudentQuestion("What are the requirements?", {
      chatRole: "information_officer",
      conversationState: { hasAmbiguousSourceAnchor: true }
    });

    expect(response.answerText).toMatch(/which TUPT office, document, or process/i);
    expect(retrieveSourceAnswerDraft).not.toHaveBeenCalled();
  });

  it("prompts for model setup for a default Haki support request without a model", async () => {
    vi.mocked(getSelectedAIMode).mockResolvedValue({ mode: mode(false), summaryProvider: null, embeddingProvider: null });
    const response = await answerStudentQuestion("I feel stressed and need advice.", { chatRole: "haki" });
    expect(response.requestedChatRole).toBe("haki");
    expect(response.answerText).toMatch(/Set up a chat model/i);
  });

  it.each<ChatRole>(["haki", "information_officer", "friendly_buddy", "researcher"])("runs unsafe handling before %s routing", async (chatRole) => {
    const response = await answerStudentQuestion("How can I cheat on my exam?", { chatRole });
    expect(response.requestedChatRole).toBe(chatRole);
    expect(response.answerBasis).toBe("safety_or_app_guidance");
    expect(responseForUnsafeRequest).toHaveBeenCalled();
    expect(answerSafeLocalChatWithContext).not.toHaveBeenCalled();
    expect(retrieveSourceAnswerDraft).not.toHaveBeenCalled();
  });
});
