import { readFileSync } from "node:fs";

export function readSource(relativePathFromRepoRoot: string): string {
  return readFileSync(new URL(`../../${relativePathFromRepoRoot}`, import.meta.url), "utf8");
}

export function sourceIncludes(relativePathFromRepoRoot: string, pattern: RegExp): boolean {
  return pattern.test(readSource(relativePathFromRepoRoot));
}

export function sourceExcludes(relativePathFromRepoRoot: string, pattern: RegExp): boolean {
  return !sourceIncludes(relativePathFromRepoRoot, pattern);
}
