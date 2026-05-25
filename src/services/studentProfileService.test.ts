import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS } from "@/utils/constants";

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    multiRemove: async (keys: string[]) => keys.forEach((key) => storage.delete(key)),
    removeItem: async (key: string) => { storage.delete(key); },
    setItem: async (key: string, value: string) => { storage.set(key, value); }
  }
}));

vi.mock("expo-secure-store", () => ({
  deleteItemAsync: async () => undefined,
  getItemAsync: async () => null,
  isAvailableAsync: async () => false,
  setItemAsync: async () => undefined
}));

vi.mock("expo-file-system", () => ({
  Directory: class {
    create(): void {}
  },
  File: class {
    exists = false;
    uri = "";
  },
  Paths: { document: "profile-root" }
}));

import { getStudentAvatarUri, getStudentProfile, saveStudentProfile, studentProfileToChatContext } from "./studentProfileService";

describe("student profile compatibility and chat context", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("normalizes legacy stored profiles without a section value", async () => {
    storage.set(STORAGE_KEYS.STUDENT_PROFILE, JSON.stringify({
      name: "Joshua",
      studentId: "100",
      course: "BSIT",
      year: "4"
    }));

    const profile = await getStudentProfile();

    expect(profile.section).toBe("");
    expect(profile.name).toBe("Joshua");
  });

  it("passes section into protected context without changing disclosure guidance", () => {
    const context = studentProfileToChatContext({
      avatarUri: "",
      course: "BSIT",
      name: "Joshua",
      section: "4A",
      studentId: "100",
      year: "4"
    });

    expect(context).toContain("Section: 4A");
    expect(context).toContain("Never repeat the student's ID, course, year level, or section");
  });

  it("stores an avatar key so chat can display it without loading core profile fields", async () => {
    await saveStudentProfile({
      avatarUri: "file:///avatar.png",
      course: "BSIT",
      name: "Joshua",
      section: "4A",
      studentId: "100",
      year: "4"
    });

    expect(await getStudentAvatarUri()).toBe("file:///avatar.png");
    expect(storage.get(STORAGE_KEYS.STUDENT_PROFILE_AVATAR_URI)).toBe("file:///avatar.png");
  });
});
