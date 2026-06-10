import { describe, expect, it } from "vitest";

import { sanitizeAssistantDisplayText, sanitizeAssistantText } from "@/ai/sanitizeAssistantText";
import {
  estimateTokens,
  pruneChatContext,
  safeInputBudgetTokens,
  safeOutputTokens,
  truncateToEstimatedTokens
} from "@/ai/tokenBudget";
import { calculateConfidence, computeConfidenceScore } from "@/retrieval/confidence";
import { normalizeQuery, tokenizeQuery } from "@/retrieval/queryNormalizer";
import { calculateRankScore, rankSearchResults } from "@/retrieval/ranking";
import { reciprocalRankFusion } from "@/retrieval/rrf";
import { activityForMascotStatus } from "@/components/mascot/hakiMascotState";
import { classifyStudentQuestionIntent } from "@/services/questionIntentService";
import {
  detectReplyLanguage,
  isTagalogLike,
  replyLanguageInstruction,
  speechLocaleForReplyLanguage
} from "@/services/replyLanguageService";
import { getSeedTriviaItems } from "@/services/triviaService";
import type { SearchResult } from "@/types/search";

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 1,
    chunkId: "clinic_regular_consultation",
    documentId: "clinic_doc",
    documentTitle: "Clinic Services",
    documentType: "procedure",
    sectionTitle: "Regular Medical Consultation",
    processName: "Clinic consultation",
    content: "Students who feel sick can visit the TUP-Taguig Clinic for regular medical consultation and first aid.",
    answer: "Go to the TUP-Taguig Clinic for regular medical consultation.",
    citation: "Clinic Services",
    pageNumber: null,
    category: "Health",
    office: "Clinic",
    tags: ["clinic", "health", "sick"],
    lastUpdated: "2026-01-01",
    synonyms: ["medical", "hurt", "illness"],
    steps: null,
    prerequisites: null,
    officeLocation: null,
    contactInfo: null,
    priority: 3,
    snippet: null,
    contentHighlight: null,
    bm25Score: -4,
    rankScore: 0,
    confidence: "medium",
    ...overrides
  };
}

describe("token budget", () => {
  it("estimates, truncates, and prunes chat context deterministically", () => {
    expect(estimateTokens("12345678")).toBe(2);
    expect(truncateToEstimatedTokens("abcdefghij", 2).length).toBeLessThanOrEqual(7);

    const pruned = pruneChatContext([
      { sender: "user", text: "first" },
      { sender: "haki", text: "second" },
      { sender: "user", text: "third" }
    ], 20, 2);

    expect(pruned.map((turn) => turn.text)).toEqual(["second", "third"]);
    expect(safeOutputTokens(1024, "safe-chat")).toBeGreaterThan(safeOutputTokens(1024, "summary"));
    expect(safeInputBudgetTokens(1024, 256)).toBe(640);
  });
});

describe("query normalization", () => {
  it("normalizes punctuation and builds safe fts tokens", () => {
    expect(normalizeQuery("  Lost-ID, please!!! ")).toBe("lost id please");
    expect(tokenizeQuery("What should I do if I lost my ID?")).toContain("lost");
  });
});

describe("ranking and confidence", () => {
  it("scores and ranks source results by relevant fields", () => {
    const clinic = result();
    const library = result({
      chunkId: "library_books",
      documentId: "library_doc",
      documentTitle: "Library",
      sectionTitle: "Borrowing",
      content: "Students may borrow books from the library.",
      answer: "Visit the library for books.",
      citation: "Library",
      category: "Library",
      office: "Library",
      tags: ["library"],
      synonyms: ["books"],
      priority: 1
    });

    expect(calculateRankScore(clinic, "where should I go if I feel sick")).toBeGreaterThan(
      calculateRankScore(library, "where should I go if I feel sick")
    );
    expect(rankSearchResults([library, clinic], "where should I go if I feel sick")[0]?.chunkId).toBe(
      "clinic_regular_consultation"
    );
    expect(computeConfidenceScore(clinic, "where should I go if I feel sick").level).not.toBe("low");
    expect(calculateConfidence([clinic], "where should I go if I feel sick")).not.toBe("low");
  });

  it("fuses duplicate chunks and keeps the better result shape", () => {
    const low = result({ chunkId: "same", confidence: "low", rankScore: 2 });
    const high = result({ chunkId: "same", confidence: "high", rankScore: 1, answer: "Better answer." });
    const other = result({ chunkId: "other", rankScore: 3 });

    const fused = reciprocalRankFusion([[low, other], [high]], 60, 2);

    expect(fused).toHaveLength(2);
    expect(fused[0]?.chunkId).toBe("same");
    expect(fused[0]?.answer).toBe("Better answer.");
  });
});

describe("assistant text sanitizing", () => {
  it("strips prompt echoes and display-only citation footers", () => {
    expect(sanitizeAssistantText("System: hidden\nAssistant: Here you go.")).toBe("Here you go.");
    expect(sanitizeAssistantDisplayText("Here you go.\n\nCITATIONS: chunk_1, chunk_2")).toBe("Here you go.");
    expect(sanitizeAssistantText("<think>private reasoning</think>\nFinal answer.")).toBe("Final answer.");
    expect(sanitizeAssistantText("<think>unfinished reasoning")).toBe("");
  });
});

describe("intent and language services", () => {
  it("routes common student questions without model calls", () => {
    const deviceIntent = classifyStudentQuestionIntent("what is my device specification?");
    const lostIdIntent = classifyStudentQuestionIntent("What should I do if I lost my ID?");

    expect(deviceIntent.type).toBe("safe_question");
    if (deviceIntent.type === "safe_question") {
      expect(deviceIntent.scenario).toBe("device_specification");
      expect(deviceIntent.route).toBe("obvious_general");
    }

    expect(lostIdIntent.type).toBe("safe_question");
    if (lostIdIntent.type === "safe_question") {
      expect(lostIdIntent.route).toBe("source_context");
      expect(lostIdIntent.sourceScope?.office).toBe("Student Affairs");
    }
  });

  it("detects reply language while enforcing English-only assistant replies", () => {
    expect(detectReplyLanguage("May I ask about the Registrar?")).toBe("english");
    expect(isTagalogLike(detectReplyLanguage("nawala ID ko"))).toBe(true);
    expect(replyLanguageInstruction("tagalog")).toMatch(/English only/i);
    expect(speechLocaleForReplyLanguage("taglish")).toMatch(/PH$/);
  });
});

describe("home trivia", () => {
  it("keeps sourced Haki trivia concise", () => {
    const triviaItems = getSeedTriviaItems();

    expect(triviaItems.length).toBeGreaterThan(0);
    expect(triviaItems.some((item) => item.title.toLowerCase().includes("gray hawk"))).toBe(true);
    triviaItems.forEach((item) => {
      const displayed = item.body;
      expect(displayed.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(20);
      expect(displayed).not.toMatch(/Did you know\?/i);
      expect(item.sourceUrl).toMatch(/^https:\/\//);
    });
  });
});

describe("mascot state mapping", () => {
  it("maps shake groggy state to the groggy Skia activity", () => {
    expect(activityForMascotStatus("groggy")).toBe("groggy");
  });
});
