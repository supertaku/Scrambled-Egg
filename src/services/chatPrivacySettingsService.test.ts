import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS } from "@/utils/constants";

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => { storage.set(key, value); }
  }
}));

import { getChatPrivacySettings, setUseProfileContext, setUseRelatedHistory } from "./chatPrivacySettingsService";

describe("chat privacy settings", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("does not attach personal context unless the student opts in", async () => {
    expect(await getChatPrivacySettings()).toEqual({
      useProfileContext: false,
      useRelatedHistory: false
    });

    await setUseProfileContext(true);
    await setUseRelatedHistory(true);

    expect(storage.get(STORAGE_KEYS.CHAT_USE_PROFILE_CONTEXT)).toBe("true");
    expect(await getChatPrivacySettings()).toEqual({
      useProfileContext: true,
      useRelatedHistory: true
    });
  });
});
