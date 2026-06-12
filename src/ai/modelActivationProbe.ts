import {
  classifyModelEvaluationFailure,
  type LocalModelManifest,
  type LocalModelEvaluationSummary
} from "./localModelMetadata";

export function nativeSafeChatText(result: unknown): string {
  if (typeof result === "string") return result.trim();
  if (!result || typeof result !== "object") return "";
  const record = result as { text?: unknown; answer?: unknown; response?: unknown; message?: unknown };
  for (const value of [record.text, record.answer, record.response, record.message]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function localFilePathFromUri(uri: string): string {
  return uri.startsWith("file://") ? decodeURIComponent(uri.slice("file://".length)) : uri;
}

export function withActivationTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timer = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  return Promise.race([promise, timer]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
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
