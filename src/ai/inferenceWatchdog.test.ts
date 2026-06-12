import { describe, expect, it, vi } from "vitest";

import { createInferenceWatchdog, watchdogConfigForTier } from "./inferenceWatchdog";

function fakeClock(start = 0) {
  let current = start;
  return {
    advance(ms: number) {
      current += ms;
    },
    now: () => current
  };
}

describe("createInferenceWatchdog", () => {
  it("breaches when no token arrives before the first-token deadline", () => {
    const clock = fakeClock();
    const onBreach = vi.fn();
    const watchdog = createInferenceWatchdog(
      { checkIntervalMs: 100_000, firstTokenDeadlineMs: 1000, totalDeadlineMs: 5000 },
      onBreach,
      clock.now
    );

    watchdog.start();
    clock.advance(999);
    watchdog.check();
    expect(watchdog.breached).toBe(false);

    clock.advance(2);
    watchdog.check();
    expect(watchdog.breached).toBe(true);
    expect(watchdog.breachReason).toBe("first-token-timeout");
    expect(onBreach).toHaveBeenCalledExactlyOnceWith("first-token-timeout");
    watchdog.stop();
  });

  it("does not breach first-token deadline once a token arrived", () => {
    const clock = fakeClock();
    const onBreach = vi.fn();
    const watchdog = createInferenceWatchdog(
      { checkIntervalMs: 100_000, firstTokenDeadlineMs: 1000, totalDeadlineMs: 5000 },
      onBreach,
      clock.now
    );

    watchdog.start();
    clock.advance(500);
    watchdog.onActivity();
    clock.advance(3000);
    watchdog.check();
    expect(watchdog.breached).toBe(false);
    watchdog.stop();
  });

  it("breaches the total deadline even with steady tokens", () => {
    const clock = fakeClock();
    const onBreach = vi.fn();
    const watchdog = createInferenceWatchdog(
      { checkIntervalMs: 100_000, firstTokenDeadlineMs: 1000, totalDeadlineMs: 5000 },
      onBreach,
      clock.now
    );

    watchdog.start();
    for (let i = 0; i < 10; i += 1) {
      clock.advance(400);
      watchdog.onActivity();
      watchdog.check();
    }
    // 4000ms elapsed, still fine.
    expect(watchdog.breached).toBe(false);

    clock.advance(1100);
    watchdog.onActivity();
    watchdog.check();
    expect(watchdog.breachReason).toBe("total-timeout");
    expect(onBreach).toHaveBeenCalledTimes(1);
    watchdog.stop();
  });

  it("reports a breach only once", () => {
    const clock = fakeClock();
    const onBreach = vi.fn();
    const watchdog = createInferenceWatchdog(
      { checkIntervalMs: 100_000, firstTokenDeadlineMs: 1000, totalDeadlineMs: 5000 },
      onBreach,
      clock.now
    );

    watchdog.start();
    clock.advance(2000);
    watchdog.check();
    watchdog.check();
    clock.advance(10_000);
    watchdog.check();
    expect(onBreach).toHaveBeenCalledTimes(1);
    watchdog.stop();
  });

  it("never breaches after stop", () => {
    const clock = fakeClock();
    const onBreach = vi.fn();
    const watchdog = createInferenceWatchdog(
      { checkIntervalMs: 100_000, firstTokenDeadlineMs: 1000, totalDeadlineMs: 5000 },
      onBreach,
      clock.now
    );

    watchdog.start();
    watchdog.stop();
    clock.advance(60_000);
    watchdog.check();
    expect(watchdog.breached).toBe(false);
    expect(onBreach).not.toHaveBeenCalled();
  });
});

describe("watchdogConfigForTier", () => {
  it("gives slow tiers a longer first-token window", () => {
    expect(watchdogConfigForTier("tiny").firstTokenDeadlineMs).toBe(25_000);
    expect(watchdogConfigForTier("minimum").firstTokenDeadlineMs).toBe(25_000);
    expect(watchdogConfigForTier("good").firstTokenDeadlineMs).toBe(15_000);
    expect(watchdogConfigForTier(undefined).firstTokenDeadlineMs).toBe(15_000);
  });

  it("caps every tier at the same total deadline", () => {
    expect(watchdogConfigForTier("tiny").totalDeadlineMs).toBe(120_000);
    expect(watchdogConfigForTier("flagship").totalDeadlineMs).toBe(120_000);
  });
});
