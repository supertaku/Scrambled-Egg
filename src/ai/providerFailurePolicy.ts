import { classifyModelEvaluationFailure } from "./localModelMetadata";

export type ProviderFailureAction = "disable_provider" | "fallback_response" | "retry_provider";

export function providerFailureAction(
  error: unknown,
  attempt: number,
  maximumRetries: number
): ProviderFailureAction {
  const message = error instanceof Error ? error.message : String(error);
  const category = classifyModelEvaluationFailure(message);
  if (
    category === "missing_runtime" ||
    category === "unsupported_architecture" ||
    category === "corrupt_artifact"
  ) {
    return "disable_provider";
  }
  return attempt < maximumRetries ? "retry_provider" : "fallback_response";
}
