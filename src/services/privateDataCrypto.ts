import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

import { tokenizeQuery } from "@/retrieval/queryNormalizer";

export const PRIVATE_DATA_PREFIX = "enc:v1:";
const PRIVATE_DATA_KEY = "haki-private-data-key-v1";

interface PrivateDataBackend {
  getKeyHex(): Promise<string>;
  open(payload: string, keyHex: string): Promise<string>;
  seal(plaintext: string, keyHex: string): Promise<string>;
}

export interface PrivateDataCodec {
  decrypt(value: string): Promise<string>;
  encrypt(value: string): Promise<string>;
  needsMigration(value: string): boolean;
}

export function isEncryptedPrivateText(value: string): boolean {
  return value.startsWith(PRIVATE_DATA_PREFIX);
}

export function fingerprintPrivateToken(token: string, keyHex: string): string {
  const normalized = token.trim().toLowerCase();
  return bytesToHex(hmac(sha256, hexToBytes(keyHex), utf8ToBytes(`haki-search-v1:${normalized}`)));
}

export function createPrivateDataCodec(backend: PrivateDataBackend): PrivateDataCodec {
  return {
    async decrypt(value: string): Promise<string> {
      if (!isEncryptedPrivateText(value)) return value;
      const keyHex = await backend.getKeyHex();
      return backend.open(value.slice(PRIVATE_DATA_PREFIX.length), keyHex);
    },
    async encrypt(value: string): Promise<string> {
      const keyHex = await backend.getKeyHex();
      return `${PRIVATE_DATA_PREFIX}${await backend.seal(value, keyHex)}`;
    },
    needsMigration(value: string): boolean {
      return !isEncryptedPrivateText(value);
    }
  };
}

let keyPromise: Promise<string> | null = null;

async function getOrCreateKeyHex(): Promise<string> {
  if (!keyPromise) {
    keyPromise = (async () => {
      const [SecureStore, Crypto] = await Promise.all([import("expo-secure-store"), import("expo-crypto")]);
      if (!(await SecureStore.isAvailableAsync())) {
        throw new Error("Secure storage is unavailable; private Haki data cannot be persisted safely.");
      }
      const existing = await SecureStore.getItemAsync(PRIVATE_DATA_KEY);
      if (existing) return existing;
      const generated = bytesToHex(await Crypto.getRandomBytesAsync(32));
      await SecureStore.setItemAsync(PRIVATE_DATA_KEY, generated);
      return generated;
    })().catch((error) => {
      keyPromise = null;
      throw error;
    });
  }
  return keyPromise;
}

const privateDataCodec = createPrivateDataCodec({
  getKeyHex: getOrCreateKeyHex,
  async open(payload, keyHex) {
    const Crypto = await import("expo-crypto");
    const key = await Crypto.AESEncryptionKey.import(keyHex, "hex");
    const sealed = Crypto.AESSealedData.fromCombined(payload);
    const plaintext = await Crypto.aesDecryptAsync(sealed, key, { output: "bytes" });
    if (typeof plaintext === "string") {
      throw new Error("Private data decryption returned an unexpected text encoding.");
    }
    return new TextDecoder().decode(plaintext);
  },
  async seal(plaintext, keyHex) {
    const Crypto = await import("expo-crypto");
    const key = await Crypto.AESEncryptionKey.import(keyHex, "hex");
    const sealed = await Crypto.aesEncryptAsync(utf8ToBytes(plaintext), key);
    const combined = await sealed.combined("base64");
    if (typeof combined !== "string") {
      throw new Error("Private data encryption returned an unexpected binary encoding.");
    }
    return combined;
  }
});

export const decryptPrivateText = privateDataCodec.decrypt;
export const encryptPrivateText = privateDataCodec.encrypt;
export const needsPrivateTextMigration = privateDataCodec.needsMigration;

export async function privateKeywordsForText(value: string): Promise<string> {
  const keyHex = await getOrCreateKeyHex();
  return Array.from(new Set(tokenizeQuery(value)))
    .map((token) => fingerprintPrivateToken(token, keyHex))
    .join(" ");
}

export async function privateFtsQueryForText(value: string): Promise<string | null> {
  const keyHex = await getOrCreateKeyHex();
  const terms = Array.from(new Set(tokenizeQuery(value)))
    .map((token) => fingerprintPrivateToken(token, keyHex));
  return terms.length ? terms.join(" OR ") : null;
}
