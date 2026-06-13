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
    const validateLiteRt = vi.fn(async (_value: LocalModelManifest) => undefined);

    const result = await prepareManifestForActivation(manifest("gguf"), validateLiteRt);

    expect(validateLiteRt).not.toHaveBeenCalled();
    expect(result.evaluationStatus).toBe("not_required");
    expect(result.lastEvaluation).toBeNull();
  });

  it("marks LiteRT activation passed after validation without generated text", async () => {
    const validateLiteRt = vi.fn(async (_value: LocalModelManifest) => undefined);

    const result = await prepareManifestForActivation(manifest("litert-lm"), validateLiteRt);

    expect(validateLiteRt).toHaveBeenCalledOnce();
    expect(result.evaluationStatus).toBe("passed");
    expect(result.lastEvaluation).toMatchObject({
      passed: true,
      failureReason: null,
      failureCategory: null
    });
  });
});
