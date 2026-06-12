import { beforeAll, describe, expect, it, vi } from "vitest";

import { createModelOperationCoordinator } from "./modelOperationCoordinator";

beforeAll(() => {
  vi.stubGlobal("__DEV__", false);
});

describe("model operation coordinator", () => {
  it("publishes patched operation phases to subscribers", () => {
    const coordinator = createModelOperationCoordinator(() => "2026-06-12T00:00:00.000Z");
    const listener = vi.fn();
    coordinator.subscribe(listener);
    coordinator.emit(coordinator.operationFor("gemma", "Gemma", "catalog-gemma", "downloading"));
    coordinator.patch({ phase: "verifying" });

    expect(listener.mock.calls.at(-1)?.[0]).toMatchObject({
      modelId: "gemma",
      phase: "verifying",
      updatedAt: "2026-06-12T00:00:00.000Z"
    });
  });

  it("waits for active inference before entering a model mutation", async () => {
    const coordinator = createModelOperationCoordinator();
    coordinator.emit(coordinator.operationFor("gemma", "Gemma", null, "activating"));
    let releaseInference!: () => void;
    const inference = coordinator.withInferenceLease(
      () => new Promise<void>((resolve) => {
        releaseInference = resolve;
      })
    );

    const mutation = coordinator.startMutation(coordinator.get()!.operationId);
    await Promise.resolve();
    expect(coordinator.get()?.phase).toBe("waiting_for_chat");

    releaseInference();
    await inference;
    await mutation;
    coordinator.endMutation();
    expect(coordinator.isBusy()).toBe(false);
  });
});
