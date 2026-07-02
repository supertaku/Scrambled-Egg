import { describe, expect, it, vi } from "vitest";

import { createLiteRtGenerationGuard } from "./liteRtGenerationGuard";

vi.mock("@/utils/logger", () => ({
  logger: {
    ai: {
      error: vi.fn(),
      log: vi.fn(),
      warn: vi.fn()
    }
  }
}));

describe("createLiteRtGenerationGuard", () => {
  it("signals cancellation before a hanging native cancel request settles", async () => {
    const controller = new AbortController();
    const cancel = vi.fn(() => new Promise<boolean>(() => undefined));
    const guard = createLiteRtGenerationGuard({
      abortSignal: controller.signal,
      cancel,
      requestId: "request-hanging-cancel",
      totalDeadlineMs: 60_000
    });

    guard.start();
    controller.abort();

    await expect(guard.cancellation).resolves.toBeUndefined();
    expect(cancel).toHaveBeenCalledOnce();
    expect(guard.reason).toBe("aborted");
    guard.stop();
  });

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

  it("keeps the terminal reason stable after stop and repeated aborts", async () => {
    const controller = new AbortController();
    const cancel = vi.fn(async () => true);
    const guard = createLiteRtGenerationGuard({
      abortSignal: controller.signal,
      cancel,
      requestId: "request-stable-reason",
      totalDeadlineMs: 60_000
    });

    guard.start();
    controller.abort();
    await guard.cancellation;
    guard.stop();
    controller.abort();

    expect(guard.reason).toBe("aborted");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("does not reject cancellation when the native cancel request rejects", async () => {
    const controller = new AbortController();
    const guard = createLiteRtGenerationGuard({
      abortSignal: controller.signal,
      cancel: vi.fn(async () => {
        throw new Error("native bridge detached");
      }),
      requestId: "request-rejected-cancel",
      totalDeadlineMs: 60_000
    });

    guard.start();
    controller.abort();

    await expect(guard.cancellation).resolves.toBeUndefined();
    expect(guard.reason).toBe("aborted");
    guard.stop();
  });

  it("removes the abort listener when stopped", () => {
    const controller = new AbortController();
    const removeEventListener = vi.spyOn(controller.signal, "removeEventListener");
    const guard = createLiteRtGenerationGuard({
      abortSignal: controller.signal,
      cancel: vi.fn(async () => true),
      requestId: "request-listener-cleanup",
      totalDeadlineMs: 60_000
    });

    guard.start();
    guard.stop();

    expect(removeEventListener).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(guard.reason).toBeNull();
  });
});
