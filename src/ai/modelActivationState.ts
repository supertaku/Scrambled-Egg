import type { LocalAIProviderId } from "./LocalAIProvider";
import type { ModelRuntimeFormat } from "./modelDownloadConfig";

export interface ModelActivationEvidence {
  activeModelId: string | null;
  filePresent: boolean;
  manifestPresent: boolean;
  modelId: string;
  runtimeAvailable: boolean;
  runtimeFormat: ModelRuntimeFormat;
  selectedProviderId: LocalAIProviderId | null;
  smokeTestStatus: "not_required" | "pending" | "passed" | "failed";
  smokeTestFailureReason?: string | null;
}

export interface ModelActivationState {
  ready: boolean;
  reason: string | null;
}

export function providerIdForRuntime(runtimeFormat: ModelRuntimeFormat): LocalAIProviderId {
  return runtimeFormat === "litert-lm" ? "litert-lm" : "llama-rn";
}

export function evaluateModelActivation(evidence: ModelActivationEvidence): ModelActivationState {
  if (!evidence.filePresent) return { ready: false, reason: "The downloaded model file is missing." };
  if (!evidence.manifestPresent) return { ready: false, reason: "The model manifest is missing or invalid." };
  if (!evidence.runtimeAvailable) return { ready: false, reason: "The required native runtime is unavailable in this build." };
  if (evidence.smokeTestStatus === "pending") return { ready: false, reason: "The activation smoke test has not completed." };
  if (evidence.smokeTestStatus === "failed") {
    return { ready: false, reason: evidence.smokeTestFailureReason || "The activation smoke test failed." };
  }
  if (evidence.activeModelId !== evidence.modelId) return { ready: false, reason: "This model is installed but not selected." };
  if (evidence.selectedProviderId !== providerIdForRuntime(evidence.runtimeFormat)) {
    return { ready: false, reason: "Chat capability selection does not match this model runtime." };
  }
  return { ready: true, reason: null };
}
