/**
 * Normalizes llama.rn completion metadata: native builds may expose token-limit stops as a
 * positive count or a boolean flag.
 */
export function isCompletionStoppedDueToTokenLimit(stoppedLimit: unknown): boolean {
  if (stoppedLimit === true) return true;
  if (typeof stoppedLimit === "number" && stoppedLimit > 0) return true;
  return false;
}
