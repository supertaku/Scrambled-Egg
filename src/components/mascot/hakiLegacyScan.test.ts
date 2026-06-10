import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_FILES = [
  "src/components/mascot/HakiMascot.tsx",
  "src/components/MascotHeader.tsx",
  "src/components/onboarding/OnboardingHaki.tsx",
  "src/components/HakiTabPopup.tsx",
  "src/components/chat/FeatherLoader.tsx",
  "src/components/chat/ChatMessageBubble.tsx",
  "src/components/AdminUnlockModal.tsx",
  "app/chat.tsx",
  "app/campus-map.tsx"
];

describe("Haki legacy runtime scan", () => {
  it("does not reintroduce Rive, pixel sprites, frame timers, or Haki-owned RN Animated motion", () => {
    const sources = SOURCE_FILES.map((file) => ({ file, source: readFileSync(resolve(process.cwd(), file), "utf8") }));
    for (const { source } of sources) expect(source).not.toMatch(/@rive-app|PixelHaki|haki-pixel-|setInterval\([^)]*frame/i);
    const mascotOwned = sources.filter(({ file }) => /HakiMascot|MascotHeader|OnboardingHaki|HakiTabPopup|FeatherLoader/.test(file));
    for (const { source } of mascotOwned) expect(source).not.toMatch(/import\s*\{[^}]*\bAnimated\b[^}]*\}\s*from\s*["']react-native["']/s);
  });

  it("keeps retired mascot runtimes out of direct dependencies", () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies).not.toHaveProperty("@rive-app/react-native");
    expect(pkg.dependencies).not.toHaveProperty("lottie-react-native");
  });
});
