import { describe, expect, it } from "vitest";

import { parseLocalModelManifest } from "./localModelManifestSchema";
import { buildLocalModelManifest } from "./localModelMetadata";
import type { DeviceHardwareProfile } from "./localModelMetadata";

const hardware: DeviceHardwareProfile = {
  platform: "android",
  osVersion: "14",
  architecture: "arm64",
  supportedAbis: ["arm64-v8a"],
  memoryGB: 7.1,
  memoryClass: "high",
  freeStorageGB: 110,
  cpuCoreCount: 8,
  lowMemory: false,
  thermalState: "nominal",
  backendDevices: []
};

function writtenManifestJson(): string {
  const manifest = buildLocalModelManifest({
    role: "chat",
    source: "downloaded",
    sourceId: "llama-3.2-1b",
    downloadId: "llama-3.2-1b",
    originalName: "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    storedName: "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    uri: "file:///models/installed/llama-3.2-1b/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    manifestPath: "file:///models/installed/llama-3.2-1b/manifest.json",
    sizeBytes: 808 * 1024 * 1024,
    fileHash: "abc123",
    metadata: {
      modelName: "Llama 3.2 1B Instruct",
      modelParameterCountB: 1,
      modelQuantization: "Q4_K_M",
      modelTier: "tiny",
      chatTemplate: {
        status: "supported",
        modelFamily: "llama",
        templateFamily: "llama",
        reason: "Known Llama 3 instruct template.",
        modelFamilySource: "gguf-metadata",
        templateFamilySource: "gguf-metadata"
      },
      rawInfo: null
    },
    hardware,
    now: "2026-06-12T00:00:00.000Z",
    runtimeFormat: "gguf"
  });
  return JSON.stringify(manifest, null, 2);
}

describe("parseLocalModelManifest", () => {
  it("round-trips a manifest produced by buildLocalModelManifest", () => {
    // Regression: writers emit version 2, but the parser only accepted
    // version 1 — every installed model became "missing or invalid".
    const parsed = parseLocalModelManifest(writtenManifestJson());
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe(2);
    expect(parsed?.storedName).toBe("Llama-3.2-1B-Instruct-Q4_K_M.gguf");
  });

  it("still reads version 1 manifests from earlier app builds", () => {
    const legacy = JSON.parse(writtenManifestJson()) as Record<string, unknown>;
    legacy.version = 1;
    expect(parseLocalModelManifest(JSON.stringify(legacy))).not.toBeNull();
  });

  it("rejects unknown future versions", () => {
    const future = JSON.parse(writtenManifestJson()) as Record<string, unknown>;
    future.version = 3;
    expect(parseLocalModelManifest(JSON.stringify(future))).toBeNull();
  });

  it.each(["role", "uri", "storedName", "manifestPath", "sizeBytes", "rejectionReasons"])(
    "rejects manifests missing %s",
    (field) => {
      const broken = JSON.parse(writtenManifestJson()) as Record<string, unknown>;
      delete broken[field];
      expect(parseLocalModelManifest(JSON.stringify(broken))).toBeNull();
    }
  );

  it("rejects malformed JSON", () => {
    expect(parseLocalModelManifest("{not json")).toBeNull();
  });
});
