import { describe, expect, it, vi } from "vitest";

import { replaceProviderRegistry } from "@/ai/providerRegistryLifecycle";

describe("replaceProviderRegistry", () => {
  it("waits for old provider disposal before creating the replacement", async () => {
    let finishDisposal!: () => void;
    const events: string[] = [];
    const registry = {
      dispose: vi.fn(() => new Promise<void>((resolve) => {
        finishDisposal = () => {
          events.push("disposed");
          resolve();
        };
      }))
    };
    const create = vi.fn(async () => {
      events.push("created");
      return "replacement";
    });

    const replacement = replaceProviderRegistry(registry, create, () => undefined);
    await Promise.resolve();
    expect(create).not.toHaveBeenCalled();
    finishDisposal();

    await expect(replacement).resolves.toBe("replacement");
    expect(events).toEqual(["disposed", "created"]);
  });

  it("reports cleanup errors but still creates a replacement", async () => {
    const cleanupError = new Error("release failed");
    const onCleanupError = vi.fn();

    const result = await replaceProviderRegistry(
      { dispose: async () => { throw cleanupError; } },
      async () => "replacement",
      onCleanupError
    );

    expect(result).toBe("replacement");
    expect(onCleanupError).toHaveBeenCalledWith(cleanupError);
  });
});
