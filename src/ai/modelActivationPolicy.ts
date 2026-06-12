import type { LocalModelManifest } from "./localModelMetadata";

export type LiteRtActivationProbe = (manifest: LocalModelManifest) => Promise<LocalModelManifest>;

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
  probeLiteRt: LiteRtActivationProbe
): Promise<LocalModelManifest> {
  if ((manifest.runtimeFormat ?? "gguf") === "litert-lm") {
    return probeLiteRt(manifest);
  }
  return normalizeGgufActivationManifest(manifest);
}
