/**
 * Watchdog for local model completions. llama.rn has no built-in timeout: if
 * the runtime stalls (thermal pressure, a wedged backend, a pathological
 * prompt) the only escape today is the user noticing and tapping stop. The
 * watchdog enforces two deadlines and asks the caller to stop generation:
 *
 * - first-token: from start until the first streamed token arrives
 *   (covers prefill stalls; scaled up for tiny tiers on slow phones)
 * - total: hard cap for the whole completion
 *
 * Pure TypeScript with an injectable clock so it is unit-testable.
 */

export type WatchdogBreachReason = "first-token-timeout" | "total-timeout";

export interface WatchdogConfig {
  /** How often the deadlines are evaluated. */
  checkIntervalMs?: number | undefined;
  firstTokenDeadlineMs: number;
  totalDeadlineMs: number;
}

export interface InferenceWatchdog {
  readonly breachReason: WatchdogBreachReason | null;
  readonly breached: boolean;
  /** Evaluate deadlines immediately (interval calls this; tests can too). */
  check(): void;
  /** Call on every streamed token. */
  onActivity(): void;
  start(): void;
  stop(): void;
}

const DEFAULT_CHECK_INTERVAL_MS = 1000;

/** Deadlines tuned per model tier: small models on weak phones prefill slowly. */
export function watchdogConfigForTier(tier: string | undefined): WatchdogConfig {
  const slowTier = tier === "tiny" || tier === "minimum";
  return {
    firstTokenDeadlineMs: slowTier ? 25_000 : 15_000,
    totalDeadlineMs: 120_000
  };
}

export function createInferenceWatchdog(
  config: WatchdogConfig,
  onBreach: (reason: WatchdogBreachReason) => void,
  now: () => number = Date.now
): InferenceWatchdog {
  const checkIntervalMs = config.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;
  let startedAt: number | null = null;
  let sawActivity = false;
  let breachReason: WatchdogBreachReason | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stopTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const check = () => {
    if (startedAt === null || breachReason !== null) {
      return;
    }
    const elapsed = now() - startedAt;
    if (!sawActivity && elapsed > config.firstTokenDeadlineMs) {
      breachReason = "first-token-timeout";
    } else if (elapsed > config.totalDeadlineMs) {
      breachReason = "total-timeout";
    }
    if (breachReason !== null) {
      stopTimer();
      onBreach(breachReason);
    }
  };

  return {
    get breachReason() {
      return breachReason;
    },
    get breached() {
      return breachReason !== null;
    },
    check,
    onActivity() {
      sawActivity = true;
    },
    start() {
      if (startedAt !== null) {
        return;
      }
      startedAt = now();
      timer = setInterval(check, checkIntervalMs);
    },
    stop() {
      stopTimer();
      startedAt = null;
    }
  };
}
