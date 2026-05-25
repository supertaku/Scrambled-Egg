import { describe, expect, it } from "vitest";

import { clampOnboardingStep, requiresFirstRunOnboarding } from "./onboardingState";

describe("onboarding state", () => {
  it("opens first-run setup for new and interrupted users only", () => {
    expect(requiresFirstRunOnboarding({ complete: false, started: false, hasProfileDetails: false })).toBe(true);
    expect(requiresFirstRunOnboarding({ complete: false, started: true, hasProfileDetails: true })).toBe(true);
    expect(requiresFirstRunOnboarding({ complete: false, started: false, hasProfileDetails: true })).toBe(false);
    expect(requiresFirstRunOnboarding({ complete: true, started: true, hasProfileDetails: false })).toBe(false);
  });

  it("keeps restored progress inside the six onboarding pages", () => {
    expect(clampOnboardingStep(-1, 6)).toBe(0);
    expect(clampOnboardingStep(3.8, 6)).toBe(3);
    expect(clampOnboardingStep(99, 6)).toBe(5);
  });
});
