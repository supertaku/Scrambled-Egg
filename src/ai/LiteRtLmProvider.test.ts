import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  answerSafeChat: vi.fn(),
  getActiveChatModelStatus: vi.fn(),
  getModule: vi.fn(),
  prepareModel: vi.fn()
}));

vi.mock("react-native", () => ({
  DeviceEventEmitter: {
    addListener: vi.fn(() => ({ remove: vi.fn() }))
  }
}));

vi.mock("./localModelManager", () => ({
  getActiveChatModelStatus: mocks.getActiveChatModelStatus,
  withLocalModelInferenceLease: async <T>(task: () => Promise<T>) => task()
}));

vi.mock("./deviceHardwareProfile", () => ({
  getDeviceHardwareProfile: vi.fn()
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

describe("LiteRtLmProvider prewarm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getModule.mockReturnValue({
      answerSafeChat: mocks.answerSafeChat,
      prepareModel: mocks.prepareModel
    });
    mocks.getActiveChatModelStatus.mockResolvedValue({
      role: "chat",
      state: "available",
      modelDirectory: "file:///models",
      manifestPath: "file:///models/manifest.json",
      rejectionReasons: [],
      manifest: {
        runtimeFormat: "litert-lm",
        uri: "file:///data/user/0/com.tupt.haki/files/gemma.litertlm"
      }
    });
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
});
