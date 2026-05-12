import { sha256 } from "@noble/hashes/sha2.js";

/**
 * Incremental SHA-256 over a file (binary-safe). Streams chunks so multi-GB
 * GGUF files never load entirely into JS heap.
 */
export async function sha256HexFromFileLike(file: { stream: () => ReadableStream<Uint8Array> }): Promise<string> {
  const h = sha256.create();
  const reader = file.stream().getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length > 0) {
        h.update(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  const digest = h.digest();
  return uint8ToLowerHex(digest);
}

export function normalizeSha256Hex(value: string): string {
  return value.trim().toLowerCase().replace(/^0x/i, "");
}

function uint8ToLowerHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i]!.toString(16).padStart(2, "0");
  }
  return out;
}
