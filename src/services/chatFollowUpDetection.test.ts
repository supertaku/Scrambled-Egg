import { describe, expect, it } from "vitest";

import { isFollowUpQuestion } from "@/services/chatFollowUpDetection";

describe("isFollowUpQuestion", () => {
  it("returns false without prior turns", () => {
    expect(isFollowUpQuestion("tell me more", false)).toBe(false);
  });

  it("detects continuation phrases", () => {
    expect(isFollowUpQuestion("Continue", true)).toBe(true);
    expect(isFollowUpQuestion("go on", true)).toBe(true);
  });

  it("treats concrete campus nouns as new questions", () => {
    expect(isFollowUpQuestion("how much is tuition", true)).toBe(false);
    expect(isFollowUpQuestion("what about the registrar", true)).toBe(false);
  });

  it("treats bare pronouns without entities as follow-ups", () => {
    expect(isFollowUpQuestion("why is that", true)).toBe(true);
  });
});
