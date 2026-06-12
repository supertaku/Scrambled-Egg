import { describe, expect, it, vi } from "vitest";

import { evaluateModelActivation } from "@/ai/modelActivationState";
import * as localModelMetadata from "@/ai/localModelMetadata";
import * as modelActivationProbe from "@/ai/modelActivationProbe";

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
  it("builds a LiteRT activation request with the native bridge request ID", () => {
    const buildInput = (modelActivationProbe as unknown as {
      buildLiteRtActivationProbeInput?: (modelPath: string, requestId: string) => Record<string, unknown>;
    }).buildLiteRtActivationProbeInput;

    expect(typeof buildInput).toBe("function");
    expect(buildInput?.("/models/gemma.litertlm", "activation-test-1")).toMatchObject({
      modelPath: "/models/gemma.litertlm",
      requestId: "activation-test-1",
      question: "Reply with exactly: Haki ready."
    });
  });

  it("cancels and releases native LiteRT state after a failed probe", async () => {
    const cleanup = (modelActivationProbe as unknown as {
      cleanupLiteRtActivationProbe?: (
        module: { cancelGeneration?: (requestId: string) => Promise<boolean>; release?: () => Promise<void> },
        requestId: string
      ) => Promise<void>;
    }).cleanupLiteRtActivationProbe;
    const cancelGeneration = vi.fn(async () => true);
    const release = vi.fn(async () => undefined);

    expect(typeof cleanup).toBe("function");
    await cleanup?.({ cancelGeneration, release }, "activation-test-1");

    expect(cancelGeneration).toHaveBeenCalledWith("activation-test-1");
    expect(release).toHaveBeenCalledOnce();
  });

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

  it("requires runtime, active model, smoke test, and selected provider agreement", () => {
    expect(evaluateModelActivation(base)).toEqual({ ready: true, reason: null });
    expect(evaluateModelActivation({ ...base, selectedProviderId: "llama-rn" })).toMatchObject({ ready: false });
  });
});
