import { beforeEach, describe, expect, it, vi } from "vitest";

const getAllAsync = vi.fn();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn()
  }
}));

vi.mock("@/db/database", () => ({
  getDatabase: vi.fn(async () => ({
    getAllAsync,
    runAsync: vi.fn(),
    withTransactionAsync: vi.fn()
  }))
}));

vi.mock("./privateDataCrypto", () => ({
  decryptPrivateText: vi.fn(async (value: string) => value.replace(/^enc:/, "")),
  encryptPrivateText: vi.fn(async (value: string) => `enc:${value}`),
  needsPrivateTextMigration: vi.fn(() => false),
  privateFtsQueryForText: vi.fn(async () => ""),
  privateKeywordsForText: vi.fn(async () => "")
}));

import { getUnansweredQuestionReport } from "./historyService";

beforeEach(() => {
  getAllAsync.mockReset();
});

describe("getUnansweredQuestionReport", () => {
  it("decrypts recent memory and aggregates source-miss questions locally", async () => {
    getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes("keywords")) return [];
      return [
        {
          id: 1,
          question: "enc:How do I get a dorm slot?",
          answer: "enc:I do not have enough saved TUP info for that yet.",
          last_asked_at: "2026-06-10 09:00:00"
        },
        {
          id: 2,
          question: "enc:how do i get a dorm slot?",
          answer: "enc:No reliable answer found.",
          last_asked_at: "2026-06-11 10:00:00"
        },
        {
          id: 3,
          question: "enc:Where is the Registrar?",
          answer: "enc:The Registrar is listed in the saved campus guide.",
          last_asked_at: "2026-06-12 11:00:00"
        }
      ];
    });

    await expect(getUnansweredQuestionReport(10)).resolves.toEqual([
      {
        question: "How do I get a dorm slot?",
        occurrences: 2,
        lastAskedAt: "2026-06-11 10:00:00"
      }
    ]);

    const reportCall = getAllAsync.mock.calls.find(([sql]) => String(sql).includes("last_asked_at"));
    expect(reportCall?.[0]).toContain("conversation_memory");
    expect(reportCall?.[1]).toEqual([80]);
    expect(reportCall?.[0]).not.toContain("answer LIKE");
  });

  it("sorts by occurrences and applies the requested report limit", async () => {
    getAllAsync.mockResolvedValue([
      {
        id: 4,
        question: "enc:Shuttle schedule?",
        answer: "enc:I don't have a solid saved answer for that yet.",
        last_asked_at: "2026-06-09 08:00:00"
      },
      {
        id: 5,
        question: "enc:Dorm slot?",
        answer: "enc:No reliable answer found.",
        last_asked_at: "2026-06-10 08:00:00"
      },
      {
        id: 6,
        question: "enc:dorm slot?",
        answer: "enc:No reliable answer found.",
        last_asked_at: "2026-06-11 08:00:00"
      }
    ]);

    await expect(getUnansweredQuestionReport(1)).resolves.toEqual([
      { question: "Dorm slot?", occurrences: 2, lastAskedAt: "2026-06-11 08:00:00" }
    ]);
  });
});
