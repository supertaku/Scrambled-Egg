import { describe, expect, it, vi } from "vitest";

import { RecoverableAsyncResource } from "@/ai/recoverableAsyncResource";

describe("RecoverableAsyncResource", () => {
  it("clears a rejected creation so the next request can recreate the resource", async () => {
    const resource = new RecoverableAsyncResource<string>();
    let attempts = 0;
    const create = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("native initialization failed");
      return "ready";
    });

    await expect(resource.get("model-a", create, async () => undefined)).rejects.toThrow("native initialization failed");
    await expect(resource.get("model-a", create, async () => undefined)).resolves.toBe("ready");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight creation for concurrent requests with the same key", async () => {
    const resource = new RecoverableAsyncResource<object>();
    let resolveCreation!: (value: object) => void;
    const value = {};
    const create = vi.fn(() => new Promise<object>((resolve) => {
      resolveCreation = resolve;
    }));

    const first = resource.get("model-a", create, async () => undefined);
    const second = resource.get("model-a", create, async () => undefined);
    await Promise.resolve();
    resolveCreation(value);

    await expect(Promise.all([first, second])).resolves.toEqual([value, value]);
    expect(create).toHaveBeenCalledOnce();
  });

  it("releases the old keyed resource before creating a replacement", async () => {
    const resource = new RecoverableAsyncResource<string>();
    const events: string[] = [];
    const release = vi.fn(async (pending: Promise<string>) => {
      events.push(`release:${await pending}`);
    });

    await resource.get("model-a", async () => {
      events.push("create:a");
      return "a";
    }, release);
    await resource.get("model-b", async () => {
      events.push("create:b");
      return "b";
    }, release);

    expect(events).toEqual(["create:a", "release:a", "create:b"]);
  });

  it("invalidates and releases the current resource before allowing recreation", async () => {
    const resource = new RecoverableAsyncResource<string>();
    const release = vi.fn(async (pending: Promise<string>) => {
      await pending;
    });
    const create = vi.fn(async () => "context");

    await resource.get("model-a", create, release);
    await resource.invalidate(release);
    await resource.get("model-a", create, release);

    expect(release).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledTimes(2);
  });
});
