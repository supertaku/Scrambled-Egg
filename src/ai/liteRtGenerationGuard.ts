import type { DeviceThermalState } from "./LocalAIProvider";

export type LiteRtCancellationReason = "aborted" | "thermal-critical" | "thermal-serious" | "timeout";

interface LiteRtGenerationGuardOptions {
  abortSignal?: AbortSignal;
  cancel: (requestId: string) => Promise<boolean>;
  readThermalState?: () => Promise<DeviceThermalState>;
  requestId: string;
  thermalCheckIntervalMs?: number;
  totalDeadlineMs: number;
}

export interface LiteRtGenerationGuard {
  readonly cancellation: Promise<void>;
  readonly reason: LiteRtCancellationReason | null;
  start(): void;
  stop(): void;
}

const DEFAULT_THERMAL_CHECK_INTERVAL_MS = 5_000;

export function createLiteRtGenerationGuard(options: LiteRtGenerationGuardOptions): LiteRtGenerationGuard {
  let reason: LiteRtCancellationReason | null = null;
  let started = false;
  let seriousReadings = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let thermalTimer: ReturnType<typeof setInterval> | null = null;
  let thermalReadInFlight = false;
  let resolveCancellation!: () => void;
  const cancellation = new Promise<void>((resolve) => {
    resolveCancellation = resolve;
  });

  const clearTimers = () => {
    if (timeout) clearTimeout(timeout);
    if (thermalTimer) clearInterval(thermalTimer);
    timeout = null;
    thermalTimer = null;
  };

  const cancelOnce = (nextReason: LiteRtCancellationReason) => {
    if (reason) return;
    reason = nextReason;
    clearTimers();
    void options.cancel(options.requestId).catch(() => false).finally(resolveCancellation);
  };

  const onAbort = () => cancelOnce("aborted");

  const checkThermalState = async () => {
    if (!options.readThermalState || thermalReadInFlight || reason) return;
    thermalReadInFlight = true;
    try {
      const state = await options.readThermalState();
      if (state === "critical") {
        cancelOnce("thermal-critical");
        return;
      }
      if (state === "serious") {
        seriousReadings += 1;
        if (seriousReadings >= 2) cancelOnce("thermal-serious");
      } else {
        seriousReadings = 0;
      }
    } finally {
      thermalReadInFlight = false;
    }
  };

  return {
    cancellation,
    get reason() {
      return reason;
    },
    start() {
      if (started) return;
      started = true;
      options.abortSignal?.addEventListener("abort", onAbort, { once: true });
      if (options.abortSignal?.aborted) {
        onAbort();
        return;
      }
      timeout = setTimeout(() => cancelOnce("timeout"), options.totalDeadlineMs);
      if (options.readThermalState) {
        thermalTimer = setInterval(
          () => void checkThermalState(),
          options.thermalCheckIntervalMs ?? DEFAULT_THERMAL_CHECK_INTERVAL_MS
        );
      }
    },
    stop() {
      clearTimers();
      options.abortSignal?.removeEventListener("abort", onAbort);
    }
  };
}
