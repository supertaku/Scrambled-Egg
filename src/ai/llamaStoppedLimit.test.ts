import { describe, expect, it } from "vitest";

import { isCompletionStoppedDueToTokenLimit } from "@/ai/llamaStoppedLimit";

describe("isCompletionStoppedDueToTokenLimit", () => {
  it("returns false for absent or zero stops", () => {
    expect(isCompletionStoppedDueToTokenLimit(undefined)).toBe(false);
    expect(isCompletionStoppedDueToTokenLimit(null)).toBe(false);
    expect(isCompletionStoppedDueToTokenLimit(false)).toBe(false);
    expect(isCompletionStoppedDueToTokenLimit(0)).toBe(false);
    expect(isCompletionStoppedDueToTokenLimit(-1)).toBe(false);
    expect(isCompletionStoppedDueToTokenLimit("yes")).toBe(false);
  });

  it("returns true for positive numeric limits or boolean true", () => {
    expect(isCompletionStoppedDueToTokenLimit(1)).toBe(true);
    expect(isCompletionStoppedDueToTokenLimit(true)).toBe(true);
  });
});
