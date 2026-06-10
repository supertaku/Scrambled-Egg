import { access, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { HAKI_RIG_PARTS } from "./hakiRigManifest";

const ASSET_DIR = resolve(process.cwd(), "assets/images/mascot/haki-v3");

describe("Haki v3 runtime assets", () => {
  it("contains alpha-safe rig parts with valid pivots", async () => {
    for (const part of Object.values(HAKI_RIG_PARTS)) {
      const path = resolve(ASSET_DIR, part.asset);
      await expect(access(path)).resolves.toBeUndefined();
      const metadata = await sharp(path).metadata();
      expect(metadata.hasAlpha).toBe(true);
      expect(metadata.width).toBeLessThanOrEqual(2048);
      expect(metadata.height).toBeLessThanOrEqual(2048);
      expect(part.pivotX).toBeGreaterThanOrEqual(0);
      expect(part.pivotX).toBeLessThanOrEqual(part.width);
      expect(part.pivotY).toBeGreaterThanOrEqual(0);
      expect(part.pivotY).toBeLessThanOrEqual(part.height);
    }
  });

  it("keeps compressed runtime artwork below 15 MB", async () => {
    const files = (await readdir(ASSET_DIR)).filter((file) => file.endsWith(".png"));
    const sizes = await Promise.all(files.map((file) => stat(resolve(ASSET_DIR, file)).then((entry) => entry.size)));
    expect(sizes.reduce((total, size) => total + size, 0)).toBeLessThan(15 * 1024 * 1024);
  });
});
