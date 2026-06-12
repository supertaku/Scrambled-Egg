import type { ContextParams } from "llama.rn";

import type {
  DeviceThermalState,
  LocalExecutionBackend,
  LocalModelPerformanceProfile
} from "./LocalAIProvider";
import type { DeviceHardwareProfile, LocalModelManifest } from "./localModelMetadata";

export const LOCAL_MODEL_PROFILE_VERSION = 1;
export const ACCELERATION_MIN_SPEEDUP = 1.1;

export interface ExecutionCandidate {
  backend: LocalExecutionBackend;
  initOptions: Partial<ContextParams>;
}

function deviceNamesMatching(hardware: DeviceHardwareProfile, pattern: RegExp): string[] {
  return hardware.backendDevices
    .filter((device) => pattern.test(device))
    .map((device) => device.split(":").at(-1)?.trim() || device);
}

// Benchmark candidates cover CPU, Metal, and OpenCL only. The Hexagon (HTP)
// kernel libraries bundled under android assets (ggml-hexagon/) are loaded by
// the llama.rn runtime itself when the app.json plugin flag
// `enableOpenCLAndHexagon` is set; Hexagon-aware candidate selection is
// deliberately not modeled here yet because it needs representative-device
// benchmarks first.
export function executionCandidatesForHardware(hardware: DeviceHardwareProfile): ExecutionCandidate[] {
  const candidates: ExecutionCandidate[] = [{ backend: "cpu", initOptions: { n_gpu_layers: 0 } }];

  if (hardware.platform === "ios") {
    candidates.push({ backend: "metal", initOptions: { n_gpu_layers: 99 } });
  }

  if (hardware.platform === "android") {
    const openClDevices = deviceNamesMatching(hardware, /opencl/i);
    if (openClDevices.length > 0) {
      candidates.push({
        backend: "opencl",
        initOptions: { n_gpu_layers: 99, devices: openClDevices }
      });
    }
  }

  return candidates;
}

export function executionOptionsForManifest(manifest: LocalModelManifest): Partial<ContextParams> {
  const backend = manifest.executionProfile?.executionBackend ?? "cpu";
  if (backend === "metal") {
    return { n_gpu_layers: 99 };
  }
  if (backend === "opencl") {
    const deviceNames = manifest.executionProfile?.availableBackends
      .filter((entry) => /opencl/i.test(entry))
      .map((entry) => entry.split(":").at(-1)?.trim() || entry);
    return { n_gpu_layers: 99, ...(deviceNames?.length ? { devices: deviceNames } : {}) };
  }
  return { n_gpu_layers: 0 };
}

function thermalUnsafe(state: DeviceThermalState): boolean {
  return state === "serious" || state === "critical";
}

export function chooseExecutionProfile(
  baseline: LocalModelPerformanceProfile,
  accelerated: LocalModelPerformanceProfile | null
): LocalModelPerformanceProfile {
  if (!accelerated) {
    return baseline;
  }

  const baselineSpeed = baseline.decodeTokensPerSecond ?? 0;
  const acceleratedSpeed = accelerated.decodeTokensPerSecond ?? 0;
  const sufficientlyFaster = baselineSpeed > 0 && acceleratedSpeed >= baselineSpeed * ACCELERATION_MIN_SPEEDUP;
  const thermallyAllowed =
    !thermalUnsafe(accelerated.thermalStateBefore) && !thermalUnsafe(accelerated.thermalStateAfter);

  if (sufficientlyFaster && thermallyAllowed && !accelerated.failureReason) {
    return { ...accelerated, accelerationStatus: "selected" };
  }

  const reason = accelerated.failureReason ??
    (!thermallyAllowed ? "Accelerated benchmark increased thermal pressure." : "Accelerated backend did not improve decode speed by 10%.");
  return { ...baseline, accelerationStatus: "fallback", failureReason: reason };
}

export function modelPerformanceKey(manifest: Pick<LocalModelManifest, "fileHash" | "uri" | "sizeBytes">): string {
  return manifest.fileHash ?? `${manifest.uri}:${manifest.sizeBytes}`;
}
