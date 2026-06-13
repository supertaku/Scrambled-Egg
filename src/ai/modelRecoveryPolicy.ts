import type { LocalModelEvaluationFailureCategory } from "./localModelMetadata";
import type { InstalledModelSource } from "./modelLibraryStore";
import type { ModelActivationPolicy, ModelRuntimeFormat } from "./modelDownloadConfig";

export interface InstalledModelRecoveryCandidate {
  id: string;
  source: InstalledModelSource;
  installedAt: string;
  runtimeFormat: ModelRuntimeFormat;
  filePresent: boolean;
  manifestPresent: boolean;
  manifestRejectionReasons: string[];
  activationPolicy: ModelActivationPolicy;
  hardwareCompatible: boolean;
  verifiedSha256: string | null;
  expectedSha256: string | null;
  evaluationFailureCategory: LocalModelEvaluationFailureCategory | null;
}

const RECOVERABLE_EVALUATION_FAILURES = new Set<LocalModelEvaluationFailureCategory>([
  "timeout",
  "empty_output"
]);

function hashesMatch(verified: string | null, expected: string | null): boolean {
  return Boolean(verified && expected && verified.trim().toLowerCase() === expected.trim().toLowerCase());
}

export function selectInstalledModelRecoveryCandidate<T extends InstalledModelRecoveryCandidate>(
  activeModelId: string | null,
  candidates: T[]
): T | null {
  if (activeModelId) return null;
  return candidates
    .filter((candidate) =>
      candidate.source === "downloaded" &&
      candidate.runtimeFormat === "litert-lm" &&
      candidate.filePresent &&
      candidate.manifestPresent &&
      candidate.manifestRejectionReasons.length === 0 &&
      candidate.activationPolicy !== "manual" &&
      candidate.hardwareCompatible &&
      hashesMatch(candidate.verifiedSha256, candidate.expectedSha256) &&
      (candidate.evaluationFailureCategory === null ||
        RECOVERABLE_EVALUATION_FAILURES.has(candidate.evaluationFailureCategory))
    )
    .sort((left, right) => Date.parse(right.installedAt) - Date.parse(left.installedAt))[0] ?? null;
}
