import { describe, expect, it } from "vitest";

import { evaluateModelActivation } from "@/ai/modelActivationState";

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

  it("requires runtime, active model, smoke test, and selected provider agreement", () => {
    expect(evaluateModelActivation(base)).toEqual({ ready: true, reason: null });
    expect(evaluateModelActivation({ ...base, selectedProviderId: "llama-rn" })).toMatchObject({ ready: false });
  });
});
