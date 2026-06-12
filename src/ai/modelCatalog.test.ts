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

function androidWithRam(memoryGB: number): DeviceHardwareProfile {
  return { ...android8GB, memoryGB, memoryClass: `${memoryGB}GB`, freeStorageGB: 40 };
}

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

  it("includes Phi-4-mini and Qwen3 8B without exposing an ONNX runtime", () => {
    expect(GGUF_MODELS.find((model) => model.id === "phi-4-mini-gguf")).toMatchObject({
      runtimeFormat: "gguf",
      chatTemplateFamily: "phi",
      minimumRamGB: 8,
      recommendedRamGB: 12,
      lifecycleChannel: "evaluation"
    });
    expect(GGUF_MODELS.find((model) => model.id === "qwen3-8b")).toMatchObject({
      runtimeFormat: "gguf",
      minimumRamGB: 12,
      recommendedRamGB: 12
    });
    expect(GGUF_MODELS.some((model) => model.runtimeFormat.includes("onnx") || model.id.includes("onnx"))).toBe(false);
  });

  it("pins every downloadable model to an immutable revision and digest", () => {
    expect(GGUF_MODELS.every((model) => /\/resolve\/[0-9a-f]{40}\//.test(model.url))).toBe(true);
    expect(GGUF_MODELS.every((model) => /^[0-9a-f]{40}$/.test(model.artifactRevision))).toBe(true);
    expect(GGUF_MODELS.every((model) => /^[0-9a-f]{64}$/.test(model.sha256Hex))).toBe(true);

    expect(GGUF_MODELS.find((model) => model.id === "phi-4-mini-gguf")).toMatchObject({
      artifactRevision: "7ff82c2aaa4dde30121698a973765f39be5288c0",
      sha256Hex: "01999f17c39cc3074afae5e9c539bc82d45f2dd7faa3917c66cbef76fce8c0c2",
      sizeMB: 2491874688 / 1024 ** 2
    });
  });

  it("uses explicit minimum and recommended total-RAM requirements", () => {
    const expected = {
      "qwen-2.5-0.5b": [4, 4],
      "llama-3.2-1b": [4, 6],
      "gemma-4-e2b-litert-lm": [4, 6],
      "llama-3.2-3b": [6, 8],
      "gemma-4-e4b-litert-lm": [7, 8],
      "qwen-2.5-3b": [8, 8],
      "qwen3-4b": [8, 8],
      "phi-4-mini-gguf": [8, 12],
      "qwen-2.5-7b": [12, 12],
      "qwen3-8b": [12, 12],
      "qwen3-14b": [16, 16]
    } as const;

    for (const [id, [minimumRamGB, recommendedRamGB]] of Object.entries(expected)) {
      expect(GGUF_MODELS.find((model) => model.id === id)).toMatchObject({ minimumRamGB, recommendedRamGB });
    }
  });

  it("exposes the intended catalog tiers at 4, 6, 7, 8, 12, and 16GB", () => {
    const idsFor = (memoryGB: number) => GGUF_MODELS
      .filter((model) => catalogDownloadFitsHardwareForDownload(model, androidWithRam(memoryGB)))
      .map((model) => model.id);

    expect(idsFor(4)).toEqual(["qwen-2.5-0.5b", "llama-3.2-1b", "gemma-4-e2b-litert-lm"]);
    expect(idsFor(6)).toContain("llama-3.2-3b");
    expect(idsFor(7)).toContain("gemma-4-e4b-litert-lm");
    expect(idsFor(8)).toContain("phi-4-mini-gguf");
    expect(idsFor(12)).toContain("qwen3-8b");
    expect(idsFor(16)).toContain("qwen3-14b");
  });
});
