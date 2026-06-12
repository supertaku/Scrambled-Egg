import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const THEMED_FEATURE_SCREENS = [
  "app/campus-map.tsx",
  "app/library-topic/[chunkId].tsx",
  "app/library.tsx",
  "app/map.tsx",
  "app/tips.tsx"
];

function uiSourceFiles(directory: string): string[] {
  return readdirSync(resolve(process.cwd(), directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return uiSourceFiles(relative);
    return /\.(ts|tsx)$/.test(entry.name) ? [relative] : [];
  });
}

describe("feature palette boundaries", () => {
  it.each(THEMED_FEATURE_SCREENS)("keeps raw hex colors out of %s", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    expect(source.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
  });

  it("keeps raw hex colors inside theme-owned modules", () => {
    const uiFiles = [...uiSourceFiles("app"), ...uiSourceFiles("src/components")];
    const violations = uiFiles.flatMap((file) => {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      return (source.match(/#[0-9a-f]{3,8}\b/gi) ?? []).map((color) => `${file}: ${color}`);
    });
    expect(violations).toEqual([]);
  });
});
