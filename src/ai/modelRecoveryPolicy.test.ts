import { describe, expect, it } from "vitest";

import {
  selectInstalledModelRecoveryCandidate,
  type InstalledModelRecoveryCandidate
} from "./modelRecoveryPolicy";

function candidate(
  id: string,
  overrides: Partial<InstalledModelRecoveryCandidate> = {}
): InstalledModelRecoveryCandidate {
  return {
    id,
    source: "downloaded",
    installedAt: "2026-06-13T00:00:00.000Z",
    runtimeFormat: "litert-lm",
    filePresent: true,
    manifestPresent: true,
    manifestRejectionReasons: [],
    activationPolicy: "auto-after-smoke-test",
    hardwareCompatible: true,
    verifiedSha256: "abc123",
    expectedSha256: "abc123",
    evaluationFailureCategory: "timeout",
    ...overrides
  };
}

describe("selectInstalledModelRecoveryCandidate", () => {
  it("selects the newest compatible verified LiteRT download when no model is active", () => {
    const older = candidate("older", { installedAt: "2026-06-12T00:00:00.000Z" });
    const newer = candidate("newer", { installedAt: "2026-06-13T00:00:00.000Z" });

    expect(selectInstalledModelRecoveryCandidate(null, [older, newer])).toBe(newer);
  });

  it.each(["timeout", "empty_output"] as const)(
    "allows a legacy %s evaluation to be revalidated",
    (evaluationFailureCategory) => {
      const recoverable = candidate("recoverable", { evaluationFailureCategory });

      expect(selectInstalledModelRecoveryCandidate(null, [recoverable])).toBe(recoverable);
    }
  );

  it("does not recover any model when another model is already active", () => {
    expect(selectInstalledModelRecoveryCandidate("active", [candidate("stranded")])).toBeNull();
  });

  it.each([
    ["missing file", { filePresent: false }],
    ["missing manifest", { manifestPresent: false }],
    ["manifest rejection", { manifestRejectionReasons: ["Requires more RAM."] }],
    ["manual activation", { activationPolicy: "manual" as const }],
    ["GGUF runtime", { runtimeFormat: "gguf" as const }],
    ["admin import", { source: "admin-imported" as const }],
    ["incompatible hardware", { hardwareCompatible: false }],
    ["missing verified hash", { verifiedSha256: null }],
    ["hash mismatch", { verifiedSha256: "different" }],
    ["missing catalog hash", { expectedSha256: null }],
    ["missing runtime failure", { evaluationFailureCategory: "missing_runtime" as const }],
    ["memory pressure failure", { evaluationFailureCategory: "memory_pressure" as const }],
    ["corrupt artifact failure", { evaluationFailureCategory: "corrupt_artifact" as const }],
    ["unsupported architecture failure", { evaluationFailureCategory: "unsupported_architecture" as const }],
    ["initialization failure", { evaluationFailureCategory: "initialization_failed" as const }]
  ])("does not recover a model with %s", (_label, overrides) => {
    expect(
      selectInstalledModelRecoveryCandidate(null, [candidate("ineligible", overrides)])
    ).toBeNull();
  });
});
