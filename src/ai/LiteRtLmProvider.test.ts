import { beforeEach, describe, expect, it, vi } from "vitest";

type TokenListener = (event: { requestId?: string; token?: string }) => void;

const mocks = vi.hoisted(() => ({
  answerSafeChat: vi.fn(),
  cancelGeneration: vi.fn(),
  getActiveChatModelStatus: vi.fn(),
  getModule: vi.fn(),
  prepareModel: vi.fn(),
  removeTokenListener: vi.fn(),
  summarizeFromSources: vi.fn(),
  streamSafeChat: vi.fn(),
  tokenListener: null as TokenListener | null
}));

vi.mock("react-native", () => ({
  DeviceEventEmitter: {
    addListener: vi.fn((_eventName: string, listener: TokenListener) => {
      mocks.tokenListener = listener;
      return { remove: mocks.removeTokenListener };
    })
  }
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    ai: {
      error: vi.fn(),
      log: vi.fn(),
      warn: vi.fn()
    }
  }
}));

vi.mock("./localModelManager", () => ({
  getActiveChatModelStatus: mocks.getActiveChatModelStatus,
  withLocalModelInferenceLease: async <T>(task: () => Promise<T>) => task()
}));

vi.mock("./deviceHardwareProfile", () => ({
  getDeviceHardwareProfile: vi.fn(async () => ({ thermalState: "unknown" }))
}));

vi.mock("./localModelMetadata", () => ({
  deviceCapabilityClassForTier: vi.fn(() => "unknown")
}));

vi.mock("./nativeRuntimeAdapters", () => ({
  liteRtLmRuntime: {
    getModule: mocks.getModule,
    release: vi.fn()
  }
}));

import { LiteRtLmProvider } from "./LiteRtLmProvider";

function activeManifestStatus() {
  return {
    role: "chat",
    state: "available",
    modelDirectory: "file:///models",
    manifestPath: "file:///models/manifest.json",
    rejectionReasons: [],
    manifest: {
      evaluationStatus: "passed",
      runtimeFormat: "litert-lm",
      uri: "file:///data/user/0/com.tupt.haki/files/gemma.litertlm"
    }
  };
}

function safeChatInput(signal?: AbortSignal) {
  return {
    appContext: "TUPT student assistant.",
    question: "Explain enrollment.",
    instruction: "Answer safely.",
    ...(signal ? { abortSignal: signal } : {})
  };
}

describe("LiteRtLmProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tokenListener = null;
    mocks.cancelGeneration.mockResolvedValue(true);
    mocks.getModule.mockReturnValue({
      answerSafeChat: mocks.answerSafeChat,
      cancelGeneration: mocks.cancelGeneration,
      prepareModel: mocks.prepareModel,
      summarizeFromSources: mocks.summarizeFromSources,
      streamSafeChat: mocks.streamSafeChat
    });
    mocks.getActiveChatModelStatus.mockResolvedValue(activeManifestStatus());
  });

  it("prepares the active LiteRT model without generating a chat response", async () => {
    mocks.prepareModel.mockResolvedValue(undefined);
    const provider = new LiteRtLmProvider();

    await provider.prewarm?.();

    expect(mocks.prepareModel).toHaveBeenCalledOnce();
    expect(mocks.prepareModel).toHaveBeenCalledWith(
      "/data/user/0/com.tupt.haki/files/gemma.litertlm"
    );
    expect(mocks.answerSafeChat).not.toHaveBeenCalled();
  });

  it("returns the completed streamed response and removes its listener", async () => {
    mocks.streamSafeChat.mockImplementation(async (input: { requestId: string }) => {
      mocks.tokenListener?.({ requestId: input.requestId, token: "Complete answer" });
      return "Complete answer";
    });
    const onToken = vi.fn();
    const provider = new LiteRtLmProvider();

    const result = await provider.streamSafeChat(safeChatInput(), onToken);

    expect(result).toMatchObject({ status: "ok", text: "Complete answer" });
    expect(onToken).toHaveBeenCalledWith("Complete answer");
    expect(mocks.removeTokenListener).toHaveBeenCalledOnce();
  });

  it("returns partial text promptly when abort wins over a hanging native stream and cancel", async () => {
    mocks.streamSafeChat.mockImplementation((input: { requestId: string }) => {
      mocks.tokenListener?.({ requestId: input.requestId, token: "Partial answer" });
      return new Promise(() => undefined);
    });
    mocks.cancelGeneration.mockReturnValue(new Promise(() => undefined));
    const controller = new AbortController();
    const provider = new LiteRtLmProvider();
    const generation = provider.streamSafeChat(safeChatInput(controller.signal), vi.fn());

    await vi.waitFor(() => expect(mocks.tokenListener).not.toBeNull());
    controller.abort();

    await expect(Promise.race([
      generation,
      new Promise((_, reject) => setTimeout(() => reject(new Error("generation remained pending")), 100))
    ])).resolves.toMatchObject({
      status: "incomplete",
      text: "Partial answer"
    });
    expect(mocks.removeTokenListener).toHaveBeenCalledOnce();
  });

  it("returns promptly when abort wins over a hanging non-streaming request", async () => {
    mocks.answerSafeChat.mockReturnValue(new Promise(() => undefined));
    mocks.cancelGeneration.mockReturnValue(new Promise(() => undefined));
    const controller = new AbortController();
    const provider = new LiteRtLmProvider();
    const generation = provider.answerSafeChat(safeChatInput(controller.signal));

    await vi.waitFor(() => expect(mocks.answerSafeChat).toHaveBeenCalledOnce());
    controller.abort();

    await expect(Promise.race([
      generation,
      new Promise((_, reject) => setTimeout(() => reject(new Error("generation remained pending")), 100))
    ])).resolves.toMatchObject({ status: "incomplete", text: "" });
  });

  it("returns an incomplete streamed response when the hard deadline wins", async () => {
    vi.useFakeTimers();
    try {
      mocks.streamSafeChat.mockReturnValue(new Promise(() => undefined));
      const provider = new LiteRtLmProvider();
      const generation = provider.streamSafeChat(safeChatInput(), vi.fn());
      await Promise.resolve();
      await Promise.resolve();

      await vi.advanceTimersByTimeAsync(120_001);

      await expect(generation).resolves.toMatchObject({ status: "incomplete", text: "" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects summarization when its hard deadline wins", async () => {
    vi.useFakeTimers();
    try {
      mocks.summarizeFromSources.mockReturnValue(new Promise(() => undefined));
      const provider = new LiteRtLmProvider();
      const summary = provider.summarizeFromSources({
        instruction: "Use the sources.",
        question: "What is required?",
        sources: []
      });
      const rejectedSummary = expect(summary).rejects.toThrow(
        "LiteRT-LM summarization canceled: timeout."
      );
      await Promise.resolve();
      await Promise.resolve();

      await vi.advanceTimersByTimeAsync(120_001);

      await rejectedSummary;
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores late tokens after cancellation and releases the next generation slot", async () => {
    let firstRequestId = "";
    mocks.streamSafeChat
      .mockImplementationOnce((input: { requestId: string }) => {
        firstRequestId = input.requestId;
        return new Promise(() => undefined);
      })
      .mockResolvedValueOnce("Second answer");
    const firstController = new AbortController();
    const firstTokens = vi.fn();
    const provider = new LiteRtLmProvider();
    const first = provider.streamSafeChat(safeChatInput(firstController.signal), firstTokens);

    await vi.waitFor(() => expect(firstRequestId).not.toBe(""));
    firstController.abort();
    await first;
    mocks.tokenListener?.({ requestId: firstRequestId, token: "late token" });

    const second = await provider.streamSafeChat(safeChatInput(), vi.fn());

    expect(firstTokens).not.toHaveBeenCalled();
    expect(second).toMatchObject({ status: "ok", text: "Second answer" });
  });
});
