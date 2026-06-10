import { describe, expect, it } from "vitest";

import { classifyHakiGesture } from "./hakiGestures";

describe("Haki gestures", () => {
  it("classifies petting, dragging, and swiping without layout movement", () => {
    expect(classifyHakiGesture({ distanceX: 34, durationMs: 900, reversals: 3, velocityX: 40 })).toBe("pet");
    expect(classifyHakiGesture({ distanceX: 24, durationMs: 500, reversals: 0, velocityX: 48 })).toBe("drag");
    expect(classifyHakiGesture({ distanceX: 80, durationMs: 130, reversals: 0, velocityX: 900 })).toBe("swipe");
  });
});
