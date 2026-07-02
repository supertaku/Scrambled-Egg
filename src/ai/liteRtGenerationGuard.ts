import type { DeviceThermalState } from "./LocalAIProvider";
import { logger } from "@/utils/logger";

export type LiteRtCancellationReason = "aborted" | "thermal-critical" | "thermal-serious" | "timeout";

interface LiteRtGenerationGuardOptions {
  abortSignal?: AbortSignal;
  cancel: (requestId: string) => Promise<boolean>;
  cancelAckDeadlineMs?: number;
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
const DEFAULT_CANCEL_ACK_DEADLINE_MS = 5_000;

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
    resolveCancellation();

    let cancelAckTimer: ReturnType<typeof setTimeout> | null = null;
    const cancelAckTimeout = new Promise<{ kind: "timeout" }>((resolve) => {
      cancelAckTimer = setTimeout(
        () => resolve({ kind: "timeout" }),
        options.cancelAckDeadlineMs ?? DEFAULT_CANCEL_ACK_DEADLINE_MS
      );
    });
    const cancelRequest = Promise.resolve()
      .then(() => options.cancel(options.requestId))
      .then(
        (accepted) => ({ kind: "result" as const, accepted }),
        (error: unknown) => ({ kind: "error" as const, error })
      );

    void Promise.race([cancelRequest, cancelAckTimeout]).then((outcome) => {
      if (cancelAckTimer) clearTimeout(cancelAckTimer);
      if (outcome.kind === "timeout") {
        logger.ai.warn("LiteRT-LM cancellation acknowledgement timed out.", {
          reason: nextReason,
          requestId: options.requestId
        });
      } else if (outcome.kind === "error") {
        logger.ai.warn("LiteRT-LM cancellation request failed.", {
          error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
          reason: nextReason,
          requestId: options.requestId
        });
      } else if (!outcome.accepted) {
        logger.ai.warn("LiteRT-LM cancellation request was not accepted.", {
          reason: nextReason,
          requestId: options.requestId
        });
      }
    });
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
