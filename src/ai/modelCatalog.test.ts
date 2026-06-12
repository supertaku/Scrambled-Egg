import { describe, expect, it } from "vitest";

import type { DeviceHardwareProfile } from "@/ai/localModelMetadata";
import {
  catalogDownloadFitsHardware,
  catalogDownloadFitsHardwareForDownload,
  groupCatalogByRecommendation
} from "@/ai/modelCatalog";
import { GGUF_MODELS } from "@/ai/modelDownloadConfig";

const android8GB: DeviceHardwareProfile = {
  platform: "android",
  osVersion: "35",
  supportedAbis: ["arm64-v8a"],
  architecture: "arm64-v8a",
  memoryGB: 8,
  memoryClass: "8GB",
  lowMemory: false,
  cpuCoreCount: 8,
  freeStorageGB: 20,
  backendDevices: ["cpu:Android CPU"]
};

describe("local model catalog", () => {
  it("contains Android-only Gemma 4 LiteRT-LM recommendations", () => {
    const e2b = GGUF_MODELS.find((model) => model.id === "gemma-4-e2b-litert-lm");
    const e4b = GGUF_MODELS.find((model) => model.id === "gemma-4-e4b-litert-lm");

    expect(e2b).toMatchObject({
      runtimeFormat: "litert-lm",
      recommendationGroup: "recommended",
      supportedPlatforms: ["android"]
    });
    expect(e4b).toMatchObject({
      runtimeFormat: "litert-lm",
      recommendationGroup: "recommended",
      supportedPlatforms: ["android"]
    });
  });

  it("pins Gemma LiteRT-LM artifacts to immutable revisions and official digests", () => {
    const e2b = GGUF_MODELS.find((model) => model.id === "gemma-4-e2b-litert-lm")!;
    const e4b = GGUF_MODELS.find((model) => model.id === "gemma-4-e4b-litert-lm")!;

    expect(e2b.url).toContain("/resolve/6e5c4f1e395deb959c494953478fa5cec4b8008f/");
    expect(e2b.sha256Hex).toBe("181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c");
    expect(e2b.sizeMB).toBeCloseTo(2588147712 / 1024 ** 2, 3);

    expect(e4b.url).toContain("/resolve/28299f30ee4d43294517a4ac93abd6163412f07f/");
    expect(e4b.sha256Hex).toBe("0b2a8980ce155fd97673d8e820b4d29d9c7d99b8fa6806f425d969b145bd52e0");
    expect(e4b.sizeMB).toBeCloseTo(3659530240 / 1024 ** 2, 3);
  });

  it("keeps Gemma downloadable for a capable phone but not activatable without its runtime", () => {
    const gemma = GGUF_MODELS.find((model) => model.id === "gemma-4-e4b-litert-lm")!;

    expect(catalogDownloadFitsHardwareForDownload(gemma, android8GB)).toBe(true);
    expect(catalogDownloadFitsHardware(gemma, android8GB, { "litert-lm": false, gguf: true })).toBe(false);
    expect(catalogDownloadFitsHardware(gemma, android8GB, { "litert-lm": true, gguf: true })).toBe(true);
  });

  it("groups compatible downloads into recommended, alternative, and experimental sections", () => {
    const grouped = groupCatalogByRecommendation(GGUF_MODELS);

    expect(grouped.recommended.some((model) => model.id === "gemma-4-e2b-litert-lm")).toBe(true);
    expect(grouped.alternative.length).toBeGreaterThan(0);
    expect(grouped.experimental.length).toBeGreaterThan(0);
  });
});
