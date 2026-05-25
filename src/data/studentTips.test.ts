import { describe, expect, it } from "vitest";

import { studentTips } from "@/data/studentTips";

describe("student tips", () => {
  it("adds four new general tips to each existing category", () => {
    const counts = new Map<string, number>();
    for (const tip of studentTips) {
      counts.set(tip.category, (counts.get(tip.category) ?? 0) + 1);
    }

    expect(studentTips).toHaveLength(60);
    expect(counts.size).toBe(12);
    for (const count of counts.values()) {
      expect(count).toBe(5);
    }
  });
});
