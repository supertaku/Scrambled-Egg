import { describe, expect, it } from "vitest";

import { HAKI_BOND_STORAGE_KEY, createHakiBondStore } from "./hakiBondService";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    async getItem(key: string) {
      return data.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      data.set(key, value);
    }
  };
}

describe("hakiBondService", () => {
  it("persists local bond state without storing chat content", async () => {
    const storage = memoryStorage();
    const store = createHakiBondStore(storage, () => "2026-06-10T02:00:00.000Z");

    const afterTap = await store.recordBondEvent("tap");
    const afterSuccess = await store.recordBondEvent("answer_success");
    const loaded = await store.getBondState();

    expect(afterTap).toMatchObject({
      familiarity: 1,
      interactionCount: 1,
      mood: "curious"
    });
    expect(afterSuccess).toMatchObject({
      familiarity: 4,
      interactionCount: 2,
      mood: "happy"
    });
    expect(loaded).toEqual(afterSuccess);
    expect(JSON.stringify(loaded)).not.toMatch(/question|answer|chat|message|campus/i);
  });

  it("falls back to the default state when stored data is invalid", async () => {
    const store = createHakiBondStore(memoryStorage({ "haki.mascotBond.v1": "{broken" }));

    await expect(store.getBondState()).resolves.toMatchObject({
      familiarity: 0,
      interactionCount: 0,
      mood: "curious"
    });
  });

  it("migrates and clamps the previous v1 shape without resetting familiarity", async () => {
    const storage = memoryStorage({
      [HAKI_BOND_STORAGE_KEY]: JSON.stringify({
        familiarity: 18,
        interactionCount: 42,
        lastInteractionAt: "2026-06-09T12:00:00.000Z",
        mood: "happy",
        recentPositiveEvents: 99,
        recentNegativeEvents: -3,
        ignoredChatText: "must not survive"
      })
    });
    const store = createHakiBondStore(storage);

    await expect(store.getBondState()).resolves.toEqual({
      familiarity: 18,
      interactionCount: 42,
      lastInteractionAt: "2026-06-09T12:00:00.000Z",
      mood: "happy",
      recentPositiveEvents: 5,
      recentNegativeEvents: 0
    });
  });
});
