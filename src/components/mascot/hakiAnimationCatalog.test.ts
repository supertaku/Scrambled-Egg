import { describe, expect, it } from "vitest";

import { chooseIdleVariant, resolveHakiAnimation } from "./hakiAnimationCatalog";

describe("Haki animation catalog", () => {
  it("resolves animation priority deterministically", () => {
    expect(resolveHakiAnimation({ activity: "success", explicitEvent: "pet", reducedMotion: true })).toBe("static");
    expect(resolveHakiAnimation({ activity: "error", explicitEvent: "pet", reducedMotion: false })).toBe("pet");
    expect(resolveHakiAnimation({ activity: "success", reducedMotion: false })).toBe("success");
    expect(resolveHakiAnimation({ activity: "thinking", mood: "happy", reducedMotion: false })).toBe("thinking");
  });

  it("uses a stable seed for sparse playful idles", () => {
    expect(chooseIdleVariant(7, "new")).toBe(chooseIdleVariant(7, "new"));
    expect(chooseIdleVariant(9, "bonded")).not.toBe("none");
  });
});
