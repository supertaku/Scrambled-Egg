import {
  classifyModelEvaluationFailure,
  type LocalModelManifest,
  type LocalModelEvaluationSummary
} from "./localModelMetadata";

export function localFilePathFromUri(uri: string): string {
  return uri.startsWith("file://") ? decodeURIComponent(uri.slice("file://".length)) : uri;
}

export function buildEvaluationSummary(
  passed: boolean,
  failureReason: string | null,
  startedAt: number,
  evaluatedAt: string,
  finishedAt = Date.now()
): LocalModelEvaluationSummary {
  return {
    evaluatedAt,
    passed,
    failureReason,
    durationMs: Math.max(0, finishedAt - startedAt),
    failureCategory: failureReason ? classifyModelEvaluationFailure(failureReason) : null
  };
}

export function evaluatedManifest(
  manifest: LocalModelManifest,
  passed: boolean,
  failureReason: string | null,
  startedAt: number,
  evaluatedAt: string
): LocalModelManifest {
  return {
    ...manifest,
    evaluationStatus: passed ? "passed" : "failed",
    lastEvaluation: buildEvaluationSummary(passed, failureReason, startedAt, evaluatedAt)
  };
}
