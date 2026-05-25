import { describe, expect, it } from "vitest";

import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import { FRIENDLY_BUDDY_LOCAL_CHAT_INSTRUCTION, RESEARCHER_LOCAL_CHAT_INSTRUCTION, safeChatInstructionForTier } from "@/ai/prompts";
import {
  buildModeScopeResponse,
  classifyHakiDomains,
  composeHakiResponse,
  friendlyGuidanceResponse,
  withResearcherMetadata
} from "@/services/chatRoleService";
import { classifyStudentQuestionIntent } from "@/services/questionIntentService";
import type { SearchResponse, SearchResult } from "@/types/search";

function stubMode(): DeviceAIMode {
  return {
    id: "local-safe-chat",
    label: "Test",
    provenance: "Answered with local safe chat",
    retrieverStrategy: "fts5",
    summaryProviderId: "llama-rn",
    summaryProviderName: "Local",
    embeddingProviderId: null,
    embeddingProviderName: null,
    capabilities: {
      summary: false, safeChat: true, embeddings: false, reranking: false, providerReady: true,
      requiresCustomDevBuild: false, minimumOS: null, modelAssetsAvailable: true,
      approximateDeviceCapability: "standard", architecture: null, freeStorageGB: null,
      memoryGB: null, memoryClass: null, unavailableReasons: [], notes: []
    },
    platform: "test",
    platformVersion: "test",
    detectedAt: "2026-05-24T00:00:00.000Z",
    fallbackReason: null
  };
}

function sourceResult(): SearchResult {
  return {
    id: 1, chunkId: "lost_id", documentId: "osa", documentTitle: "OSA", documentType: "procedure",
    sectionTitle: "Lost ID", processName: "Lost ID", content: "Report to OSA.", answer: "Report to OSA.",
    citation: "OSA", pageNumber: null, category: "Student Administration", office: "Student Affairs",
    tags: [], lastUpdated: null, synonyms: [], steps: null, prerequisites: null, officeLocation: null,
    contactInfo: null, priority: 1, snippet: null, contentHighlight: null, bm25Score: 1, rankScore: 1,
    confidence: "high"
  };
}

function response(overrides: Partial<SearchResponse> = {}): SearchResponse {
  return {
    question: "question",
    requestedChatRole: "haki",
    answerBasis: "haki_guidance",
    responseType: "safe_local_chat",
    results: [],
    confidence: "medium",
    reliable: true,
    answerText: "Text.",
    citationsUsed: [],
    provenance: "Answered with local safe chat",
    activeMode: stubMode(),
    ...overrides
  };
}

describe("four-mode domain and scope policy", () => {
  it("recognizes a mixed campus and support prompt", () => {
    const question = "I feel overwhelmed because I lost my ID. What should I do?";
    expect(classifyHakiDomains(question, classifyStudentQuestionIntent(question))).toEqual([
      "campus_information",
      "supportive_advice"
    ]);
  });

  it("gives a specialized mode one-tap alternatives for an out-of-scope prompt", () => {
    const mismatch = buildModeScopeResponse("What is photosynthesis?", "information_officer", ["external_fact"], stubMode());
    expect(mismatch.answerText).toMatch(/another Haki mode/i);
    expect(mismatch.suggestedModeActions?.map((item) => item.mode)).toEqual(["researcher", "haki"]);
    expect(mismatch.suggestedModeActions?.every((item) => item.rerunQuestion)).toBe(true);
  });
});

describe("generated-mode constraints and composition", () => {
  it("keeps Friendly Buddy free of campus-leaking generated guidance", () => {
    const blocked = friendlyGuidanceResponse(
      "I am stressed after losing my ID.",
      response({ answerText: "Submit an affidavit to OSA and pay \u20b1150." }),
      ["campus_information"]
    );
    expect(blocked.answerText).not.toMatch(/affidavit|150/i);
    expect(blocked.suggestedModeActions?.[0]?.mode).toBe("information_officer");
  });

  it("keeps the researcher answer text clear of the top-level accuracy notice", () => {
    const factual = withResearcherMetadata(response({ answerText: "Photosynthesis converts light into stored chemical energy." }));
    expect(factual.answerBasis).toBe("researcher_facts");
    expect(factual.answerText).toBe("Photosynthesis converts light into stored chemical energy.");
  });

  it("removes a legacy inline researcher reminder from returned text", () => {
    const factual = withResearcherMetadata(response({
      answerText: "Photosynthesis converts light into stored chemical energy.\n\nReminder: Haki can make mistakes. Please verify important facts with reliable sources."
    }));
    expect(factual.answerText).toBe("Photosynthesis converts light into stored chemical energy.");
  });

  it("composes default Haki responses with sources only from the campus block", () => {
    const result = sourceResult();
    const campus = response({
      answerBasis: "campus_sources",
      responseType: "source",
      results: [result],
      topResult: result,
      citationsUsed: [result.chunkId],
      answerText: "Report to OSA."
    });
    const support = response({ requestedChatRole: "friendly_buddy", answerBasis: "friendly_guidance", answerText: "That sounds stressful. Take one manageable next step." });
    const combined = composeHakiResponse("I feel stressed because I lost my ID.", campus, support);
    expect(combined.requestedChatRole).toBe("haki");
    expect(combined.answerBasis).toBe("haki_composed");
    expect(combined.answerText).toMatch(/Campus information from saved sources/);
    expect(combined.answerText).toMatch(/Supportive guidance/);
    expect(combined.citationsUsed).toEqual([result.chunkId]);
  });

  it("preserves the model setup message when default Haki cannot generate support", () => {
    const unavailable = response({
      reliable: false,
      answerText: "Saved campus information is available now, but this response needs a local chat model.",
      provenance: "General chat unavailable without local AI"
    });
    const combined = composeHakiResponse("I feel overwhelmed.", undefined, unavailable);
    expect(combined.requestedChatRole).toBe("haki");
    expect(combined.answerText).toMatch(/needs a local chat model/i);
  });

  it("defines bounded prompts for Friendly Buddy and Researcher", () => {
    for (const instruction of [FRIENDLY_BUDDY_LOCAL_CHAT_INSTRUCTION, safeChatInstructionForTier("minimum", "friendly_buddy")]) {
      expect(instruction).toMatch(/psychologist|PhD/i);
      expect(instruction).toMatch(/therapist/i);
      expect(instruction).toMatch(/campus facts|campus fees/i);
    }
    expect(RESEARCHER_LOCAL_CHAT_INSTRUCTION).toMatch(/outside campus|non-campus/i);
    expect(RESEARCHER_LOCAL_CHAT_INSTRUCTION).toMatch(/do not provide TUPT/i);
  });
});
