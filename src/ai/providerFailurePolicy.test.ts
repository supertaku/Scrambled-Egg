import { describe, expect, it } from "vitest";

import { providerFailureAction } from "@/ai/providerFailurePolicy";

describe("providerFailureAction", () => {
  it("disables only failures that cannot recover within the current app session", () => {
    expect(providerFailureAction(new Error("llama.rn native runtime is unavailable."), 0, 2)).toBe("disable_provider");
    expect(providerFailureAction(new Error("Downloaded model failed its SHA-256 integrity check."), 0, 2)).toBe("disable_provider");
    expect(providerFailureAction(new Error("Unsupported arm64 architecture."), 0, 2)).toBe("disable_provider");
  });

  it("retries transient initialization, memory, timeout, and unknown failures", () => {
    expect(providerFailureAction(new Error("Failed to initialize llama context."), 0, 2)).toBe("retry_provider");
    expect(providerFailureAction(new Error("Out of memory while loading context."), 0, 2)).toBe("retry_provider");
    expect(providerFailureAction(new Error("Inference timed out."), 1, 2)).toBe("retry_provider");
    expect(providerFailureAction(new Error("Native completion failed."), 0, 2)).toBe("retry_provider");
  });

  it("falls back for the current response after transient retries are exhausted", () => {
    expect(providerFailureAction(new Error("Native completion failed."), 2, 2)).toBe("fallback_response");
  });
});
