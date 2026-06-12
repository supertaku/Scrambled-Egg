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
  getDatabase: vi.fn(async () => ({ getAllAsync }))
}));

import { getUnansweredQuestionReport } from "./historyService";

beforeEach(() => {
  getAllAsync.mockReset();
});

describe("getUnansweredQuestionReport", () => {
  it("maps aggregated rows into report entries", async () => {
    getAllAsync.mockResolvedValue([
      { question: "How do I get a dorm slot?", occurrences: 3, last_asked_at: "2026-06-10 09:00:00" },
      { question: "Shuttle schedule?", occurrences: 1, last_asked_at: null }
    ]);

    const report = await getUnansweredQuestionReport(5);

    expect(report).toEqual([
      { question: "How do I get a dorm slot?", occurrences: 3, lastAskedAt: "2026-06-10 09:00:00" },
      { question: "Shuttle schedule?", occurrences: 1, lastAskedAt: null }
    ]);
  });

  it("filters by every known fallback marker and applies the limit", async () => {
    getAllAsync.mockResolvedValue([]);

    await getUnansweredQuestionReport(7);

    const [sql, params] = getAllAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("conversation_memory");
    expect(params.at(-1)).toBe(7);
    const likeParams = params.slice(0, -1) as string[];
    expect(likeParams.length).toBeGreaterThanOrEqual(3);
    expect(likeParams).toContain("%I do not have enough saved TUP info for that yet%");
    expect(likeParams).toContain("%I don't have a solid saved answer for that yet%");
    expect(likeParams).toContain("%No reliable answer found%");
    // Every LIKE param needs a matching clause in the WHERE.
    expect(sql.match(/m\.answer LIKE \?/g)).toHaveLength(likeParams.length);
  });
});
