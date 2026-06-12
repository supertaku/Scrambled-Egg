import { describe, expect, it, vi } from "vitest";

import { createLiteRtGenerationGuard } from "./liteRtGenerationGuard";

describe("createLiteRtGenerationGuard", () => {
  it("cancels a native request once when the caller aborts", async () => {
    const controller = new AbortController();
    const cancel = vi.fn(async () => true);
    const guard = createLiteRtGenerationGuard({
      abortSignal: controller.signal,
      cancel,
      requestId: "request-1",
      totalDeadlineMs: 60_000
    });

    guard.start();
    controller.abort();
    await guard.cancellation;
    controller.abort();

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith("request-1");
    expect(guard.reason).toBe("aborted");
    guard.stop();
  });

  it("cancels when the total generation deadline expires", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn(async () => true);
    const guard = createLiteRtGenerationGuard({
      cancel,
      requestId: "request-2",
      totalDeadlineMs: 120_000
    });

    guard.start();
    await vi.advanceTimersByTimeAsync(120_001);
    await guard.cancellation;

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(guard.reason).toBe("timeout");
    guard.stop();
    vi.useRealTimers();
  });

  it("cancels immediately on critical heat and after two serious readings", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn(async () => true);
    const readThermalState = vi
      .fn<() => Promise<"serious" | "critical">>()
      .mockResolvedValueOnce("serious")
      .mockResolvedValueOnce("serious");
    const guard = createLiteRtGenerationGuard({
      cancel,
      readThermalState,
      requestId: "request-3",
      thermalCheckIntervalMs: 1_000,
      totalDeadlineMs: 120_000
    });

    guard.start();
    await vi.advanceTimersByTimeAsync(2_001);
    await guard.cancellation;

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(guard.reason).toBe("thermal-serious");
    guard.stop();
    vi.useRealTimers();
  });
});
