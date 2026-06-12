import { describe, expect, it } from "vitest";

import {
  PRIVATE_DATA_PREFIX,
  createPrivateDataCodec,
  fingerprintPrivateToken,
  isEncryptedPrivateText
} from "./privateDataCrypto";

describe("private data crypto", () => {
  it("wraps encrypted values and still reads legacy plaintext for migration", async () => {
    const codec = createPrivateDataCodec({
      getKeyHex: async () => "11".repeat(32),
      open: async (payload) => payload.split("").reverse().join(""),
      seal: async (plaintext) => plaintext.split("").reverse().join("")
    });

    const encrypted = await codec.encrypt("private question");

    expect(encrypted.startsWith(PRIVATE_DATA_PREFIX)).toBe(true);
    expect(isEncryptedPrivateText(encrypted)).toBe(true);
    expect(await codec.decrypt(encrypted)).toBe("private question");
    expect(await codec.decrypt("legacy plaintext")).toBe("legacy plaintext");
    expect(codec.needsMigration("legacy plaintext")).toBe(true);
    expect(codec.needsMigration(encrypted)).toBe(false);
  });

  it("creates deterministic keyed search tokens without retaining plaintext", () => {
    const keyA = "22".repeat(32);
    const keyB = "33".repeat(32);

    const first = fingerprintPrivateToken("Registrar", keyA);
    const repeated = fingerprintPrivateToken("registrar", keyA);
    const otherKey = fingerprintPrivateToken("registrar", keyB);

    expect(first).toBe(repeated);
    expect(first).not.toBe(otherKey);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("registrar");
  });

  it("does not treat malformed prefixed data as plaintext", async () => {
    const codec = createPrivateDataCodec({
      getKeyHex: async () => "44".repeat(32),
      open: async () => {
        throw new Error("invalid envelope");
      },
      seal: async (plaintext) => plaintext
    });

    await expect(codec.decrypt(`${PRIVATE_DATA_PREFIX}broken`)).rejects.toThrow("invalid envelope");
  });
});
