import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = join(HERE, "../../../assets/images/mascot/hd-v2");
const ASSET_MAP_SOURCE = readFileSync(join(HERE, "hdAssets.ts"), "utf8");

const FULL_BODY_ASSETS = [
  "haki-idle.png",
  "haki-thinking.png",
  "haki-typing.png",
  "haki-interrogating.png",
  "haki-sleepy.png",
  "haki-teaching.png",
  "haki-idea.png",
  "haki-success.png",
  "haki-error.png",
  "haki-groggy.png",
  "haki-detective.png",
  "haki-onboarding-celebration.png",
  "haki-onboarding-learning.png",
  "haki-onboarding-welcome.png",
  "haki-model-downloading.png",
  "haki-model-ready.png",
  "haki-model-switching.png",
  "haki-model-verifying.png"
] as const;

function readPngContract(filename: string) {
  const png = readFileSync(join(ASSET_DIR, filename));
  return {
    signature: png.subarray(1, 4).toString("ascii"),
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    colorType: png.readUInt8(25)
  };
}

describe("HD Haki assets", () => {
  it("maps every behavior to a dedicated generated asset", () => {
    const expectedAssets = [...FULL_BODY_ASSETS, "haki-chat-portrait.png"];

    for (const filename of expectedAssets) {
      expect(ASSET_MAP_SOURCE).toContain(`/hd-v2/${filename}`);
    }
    expect(new Set(expectedAssets).size).toBe(19);
    expect(ASSET_MAP_SOURCE).not.toContain("grayhawk-");
  });

  it("uses one transparent portrait canvas for full-body art", () => {
    for (const filename of FULL_BODY_ASSETS) {
      expect(readPngContract(filename)).toEqual({
        signature: "PNG",
        width: 1086,
        height: 1448,
        colorType: 6
      });
    }
  });

  it("uses a transparent square canvas for the compact chat portrait", () => {
    expect(readPngContract("haki-chat-portrait.png")).toEqual({
      signature: "PNG",
      width: 1254,
      height: 1254,
      colorType: 6
    });
  });
});
