import { describe, expect, it, vi } from "vitest";

import type { LocalModelManifest } from "@/ai/localModelMetadata";
import { prepareManifestForActivation } from "@/ai/modelActivationPolicy";

function manifest(runtimeFormat: "gguf" | "litert-lm"): LocalModelManifest {
  return {
    version: 2,
    role: "chat",
    originalName: runtimeFormat === "gguf" ? "model.gguf" : "model.litertlm",
    storedName: runtimeFormat === "gguf" ? "model.gguf" : "model.litertlm",
    uri: `file:///models/model.${runtimeFormat === "gguf" ? "gguf" : "litertlm"}`,
    runtimeFormat,
    sizeBytes: 1024,
    fileHash: "hash",
    fileHashAlgorithm: "md5",
    modelName: "Test model",
    modelParameterCountB: 1,
    modelQuantization: runtimeFormat === "gguf" ? "Q4_K_M" : "int4",
    modelTier: "tiny",
    recommendedModelTier: "tiny",
    importedAt: "2026-06-12T00:00:00.000Z",
    validatedAt: "2026-06-12T00:00:00.000Z",
    manifestPath: "file:///models/manifest.json",
    rejectionReasons: [],
    evaluationStatus: "failed",
    lastEvaluation: {
      evaluatedAt: "2026-06-12T00:00:00.000Z",
      passed: false,
      failureReason: "Legacy benchmark failed.",
      failureCategory: "initialization_failed"
    }
  };
}

describe("prepareManifestForActivation", () => {
  it("makes a validated GGUF activation independent from legacy benchmark failures", async () => {
    const probeLiteRt = vi.fn(async (value: LocalModelManifest) => value);

    const result = await prepareManifestForActivation(manifest("gguf"), probeLiteRt);

    expect(probeLiteRt).not.toHaveBeenCalled();
    expect(result.evaluationStatus).toBe("not_required");
    expect(result.lastEvaluation).toBeNull();
  });

  it("requires the LiteRT activation probe and returns its evaluated manifest", async () => {
    const evaluated = {
      ...manifest("litert-lm"),
      evaluationStatus: "passed" as const,
      lastEvaluation: {
        evaluatedAt: "2026-06-12T00:00:01.000Z",
        passed: true,
        failureReason: null
      }
    };
    const probeLiteRt = vi.fn(async () => evaluated);

    const result = await prepareManifestForActivation(manifest("litert-lm"), probeLiteRt);

    expect(probeLiteRt).toHaveBeenCalledOnce();
    expect(result).toBe(evaluated);
  });
});
