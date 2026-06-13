import { describe, expect, it } from "vitest";

import { evaluateModelActivation } from "@/ai/modelActivationState";
import * as localModelMetadata from "@/ai/localModelMetadata";

const base = {
  activeModelId: "gemma-4-e2b-litert-lm",
  filePresent: true,
  manifestPresent: true,
  modelId: "gemma-4-e2b-litert-lm",
  runtimeAvailable: true,
  runtimeFormat: "litert-lm" as const,
  selectedProviderId: "litert-lm" as const,
  smokeTestStatus: "passed" as const
};

describe("model activation truth", () => {
  it("normalizes activation failures into persisted diagnostic categories", () => {
    const classify = (localModelMetadata as unknown as {
      classifyModelEvaluationFailure?: (message: string) => string;
    }).classifyModelEvaluationFailure;

    expect(typeof classify).toBe("function");
    expect(classify?.("LiteRT-LM native runtime is unavailable.")).toBe("missing_runtime");
    expect(classify?.("Activation probe timed out.")).toBe("timeout");
    expect(classify?.("Activation probe returned an empty response.")).toBe("empty_output");
    expect(classify?.("OutOfMemoryError while initializing the engine.")).toBe("memory_pressure");
    expect(classify?.("Model file is missing or corrupt.")).toBe("corrupt_artifact");
  });

  it("does not treat a completed download as ready before smoke testing", () => {
    expect(evaluateModelActivation({ ...base, smokeTestStatus: "pending" })).toEqual({
      ready: false,
      reason: "The activation smoke test has not completed."
    });
  });

  it("keeps a failed downloaded model retryable with its actionable reason", () => {
    expect(evaluateModelActivation({
      ...base,
      smokeTestStatus: "failed",
      smokeTestFailureReason: "Install an updated Android build."
    })).toEqual({ ready: false, reason: "Install an updated Android build." });
  });

  it("does not apply LiteRT smoke-test state to GGUF activation", () => {
    expect(evaluateModelActivation({
      ...base,
      modelId: "llama-3.2-1b",
      activeModelId: "llama-3.2-1b",
      runtimeFormat: "gguf",
      selectedProviderId: "llama-rn",
      smokeTestStatus: "failed",
      smokeTestFailureReason: "A legacy performance benchmark failed."
    })).toEqual({ ready: true, reason: null });
  });

  it("requires runtime, active model, smoke test, and selected provider agreement", () => {
    expect(evaluateModelActivation(base)).toEqual({ ready: true, reason: null });
    expect(evaluateModelActivation({ ...base, selectedProviderId: "llama-rn" })).toMatchObject({ ready: false });
  });
});
