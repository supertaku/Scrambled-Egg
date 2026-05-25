import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => { storage.set(key, value); },
    removeItem: async (key: string) => { storage.delete(key); }
  }
}));

import {
  clearPendingChatRequest,
  loadPendingChatRequest,
  savePendingChatRequest
} from "./pendingChatRequestService";

describe("pending chat request", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("persists a background-interrupted prompt until retry or dismissal completes", async () => {
    const request = {
      chatRole: "haki" as const,
      question: "Where is the clinic?",
      startedAt: "2026-05-25T01:00:00.000Z"
    };

    await savePendingChatRequest(request);
    expect(await loadPendingChatRequest()).toEqual(request);

    await clearPendingChatRequest();
    expect(await loadPendingChatRequest()).toBeNull();
  });

  it("ignores malformed stored request data", async () => {
    storage.set("tupt_wiki_pending_chat_request", JSON.stringify({ chatRole: "unknown", question: "Hello" }));
    expect(await loadPendingChatRequest()).toBeNull();
  });
});
