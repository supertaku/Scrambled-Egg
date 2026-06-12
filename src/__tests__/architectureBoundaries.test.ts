import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function lineCount(relativePath: string): number {
  return source(relativePath).split(/\r?\n/).length;
}

describe("large-module ownership boundaries", () => {
  it("keeps route presentation styles outside the campus map and chat routes", () => {
    expect(source("app/campus-map.tsx")).toContain("@/components/campus-map/campusMapStyles");
    expect(source("app/chat.tsx")).toContain("@/components/chat/chatScreenStyles");
    expect(lineCount("app/campus-map.tsx")).toBeLessThan(700);
    expect(lineCount("app/chat.tsx")).toBeLessThan(700);
  });

  it("keeps source policy and model-operation coordination in focused modules", () => {
    expect(source("src/services/answerService.ts")).toContain("./answerSourcePolicy");
    expect(source("src/ai/localModelManager.ts")).toContain("./modelOperationCoordinator");
    expect(lineCount("src/services/answerService.ts")).toBeLessThan(520);
    expect(lineCount("src/ai/localModelManager.ts")).toBeLessThan(1600);
  });
});
