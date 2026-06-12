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

  it("shows the phone's reported total RAM and free storage", () => {
    const source = readFileSync(join(process.cwd(), "app/models.tsx"), "utf8");

    expect(source).toContain("total RAM");
    expect(source).toContain("free storage");
  });
});
