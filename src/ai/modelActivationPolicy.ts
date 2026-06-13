import type { LocalModelManifest } from "./localModelMetadata";
import { evaluatedManifest } from "./modelActivationProbe";

export type LiteRtActivationValidator = (manifest: LocalModelManifest) => Promise<void>;

export function normalizeGgufActivationManifest(manifest: LocalModelManifest): LocalModelManifest {
  if ((manifest.runtimeFormat ?? "gguf") !== "gguf") return manifest;
  if (manifest.evaluationStatus === "not_required" && manifest.lastEvaluation == null) return manifest;
  return {
    ...manifest,
    evaluationStatus: "not_required",
    lastEvaluation: null
  };
}

export async function prepareManifestForActivation(
  manifest: LocalModelManifest,
  validateLiteRt: LiteRtActivationValidator
): Promise<LocalModelManifest> {
  if ((manifest.runtimeFormat ?? "gguf") === "litert-lm") {
    const startedAt = Date.now();
    await validateLiteRt(manifest);
    return evaluatedManifest(manifest, true, null, startedAt, new Date().toISOString());
  }
  return normalizeGgufActivationManifest(manifest);
}
