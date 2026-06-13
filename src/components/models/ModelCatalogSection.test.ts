import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("model catalog presentation", () => {
  it("shows download size plus minimum and recommended total device RAM", () => {
    const source = readFileSync(join(process.cwd(), "src/components/models/ModelCatalogSection.tsx"), "utf8");

    expect(source).toContain("Device RAM:");
    expect(source).toContain("recommendedRamGB");
    expect(source).not.toContain("GB+ RAM");
  });

  it("shows non-technical Haki Notes without raw phone specifications", () => {
    const source = readFileSync(join(process.cwd(), "app/models.tsx"), "utf8");

    expect(source).toContain("Haki Notes");
    expect(source).toContain("Haki only shows models that are suitable for this phone.");
    expect(source).toContain("Downloaded models run on this phone and can work offline.");
    expect(source).toContain("If Haki feels slow, switch to a smaller downloaded model.");
    expect(source).not.toContain("Campus Haki already answers");
    expect(source).not.toContain("total RAM");
    expect(source).not.toContain("free storage");
  });

  it("does not expose evaluation or smoke-test terminology", () => {
    const source = readFileSync(join(process.cwd(), "src/components/models/ModelCatalogSection.tsx"), "utf8");

    expect(source).not.toMatch(/In evaluation|on-device smoke test/i);
  });
});
