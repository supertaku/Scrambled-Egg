import { describe, expect, it } from "vitest";

import {
  activityForMascotStatus,
  bondLevelForFamiliarity,
  moodBadgeForMascotMood,
  moodForActivity,
  nextBondState
} from "./hakiMascotState";

describe("living Haki mascot state", () => {
  it("maps app status into Skia activities", () => {
    expect(activityForMascotStatus("idle")).toBe("idle");
    expect(activityForMascotStatus("typing")).toBe("thinking");
    expect(activityForMascotStatus("teaching")).toBe("answering");
    expect(activityForMascotStatus("success")).toBe("success");
    expect(activityForMascotStatus("error")).toBe("error");
    expect(activityForMascotStatus("groggy")).toBe("groggy");
  });

  it("derives mood from explicit activity without exposing chat content", () => {
    expect(moodForActivity("success", "curious")).toBe("happy");
    expect(moodForActivity("error", "happy")).toBe("concerned");
    expect(moodForActivity("sleepy", "curious")).toBe("sleepy");
    expect(moodForActivity("walking", "curious")).toBe("curious");
  });

  it("updates local bond state from interaction events only", () => {
    const initial = {
      familiarity: 0,
      interactionCount: 0,
      lastInteractionAt: null,
      mood: "curious" as const,
      recentPositiveEvents: 0,
      recentNegativeEvents: 0
    };

    const afterPet = nextBondState(initial, "pet", "2026-06-10T01:00:00.000Z");
    const afterPlay = nextBondState(afterPet, "play", "2026-06-10T01:00:02.000Z");
    const afterPokes = nextBondState(afterPlay, "pokeBurst", "2026-06-10T01:00:04.000Z");

    expect(afterPet).toMatchObject({ familiarity: 2, interactionCount: 1, mood: "happy" });
    expect(afterPlay).toMatchObject({ familiarity: 4, interactionCount: 2, recentPositiveEvents: 2 });
    expect(afterPokes).toMatchObject({ familiarity: 4, interactionCount: 3, mood: "annoyed", recentNegativeEvents: 1 });
  });

  it("keeps bond levels and mood badges compact", () => {
    expect(bondLevelForFamiliarity(0)).toBe("new");
    expect(bondLevelForFamiliarity(5)).toBe("familiar");
    expect(bondLevelForFamiliarity(13)).toBe("bonded");
    expect(moodBadgeForMascotMood("curious")).toBe("Curious");
    expect(moodBadgeForMascotMood("dizzy")).toBe("Dizzy");
  });
});
