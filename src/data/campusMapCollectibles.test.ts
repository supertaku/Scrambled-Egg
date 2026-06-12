import { describe, expect, it } from "vitest";

import {
  allFeathersCollected,
  campusFeathers,
  findFeatherAt,
  isFeatherReachable
} from "./campusMapCollectibles";

describe("campusFeathers", () => {
  it("places every feather on a walkable tile", () => {
    for (const feather of campusFeathers) {
      expect(isFeatherReachable(feather), `${feather.id} must sit on a walk zone`).toBe(true);
    }
  });

  it("uses unique ids", () => {
    expect(new Set(campusFeathers.map((feather) => feather.id)).size).toBe(campusFeathers.length);
  });
});

describe("findFeatherAt", () => {
  it("collects a feather the player stands on", () => {
    const feather = campusFeathers[0]!;
    expect(findFeatherAt(feather.position, new Set())?.id).toBe(feather.id);
  });

  it("collects within the pickup radius but not from far away", () => {
    const feather = campusFeathers[0]!;
    const near = { x: feather.position.x + 1.5, y: feather.position.y };
    const far = { x: feather.position.x + 6, y: feather.position.y };
    expect(findFeatherAt(near, new Set())?.id).toBe(feather.id);
    expect(findFeatherAt(far, new Set())).toBeUndefined();
  });

  it("ignores already-collected feathers", () => {
    const feather = campusFeathers[0]!;
    expect(findFeatherAt(feather.position, new Set([feather.id]))).toBeUndefined();
  });
});

describe("allFeathersCollected", () => {
  it("tracks completion", () => {
    expect(allFeathersCollected(new Set())).toBe(false);
    expect(allFeathersCollected(new Set(campusFeathers.map((feather) => feather.id)))).toBe(true);
  });
});
