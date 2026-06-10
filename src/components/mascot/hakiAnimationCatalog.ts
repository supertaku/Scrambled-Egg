import type { HakiActivity, HakiAnimationEvent, HakiBondLevel, HakiMood } from "./hakiMascotState";

export type HakiAnimationName =
  | "static"
  | HakiActivity
  | HakiAnimationEvent
  | "featherCheck"
  | "preen"
  | "headTilt"
  | "footShuffle"
  | "wingStretch"
  | "lookAround"
  | "yawn"
  | "bondedGreeting";

export interface ResolveHakiAnimationInput {
  activity: HakiActivity;
  explicitEvent?: HakiAnimationEvent | undefined;
  mood?: HakiMood;
  reducedMotion: boolean;
}

const PLAYFUL_IDLE: HakiAnimationName[] = ["featherCheck", "preen", "headTilt", "footShuffle", "wingStretch", "lookAround", "yawn"];

export function resolveHakiAnimation(input: ResolveHakiAnimationInput): HakiAnimationName {
  if (input.reducedMotion) return "static";
  if (input.explicitEvent) return input.explicitEvent;
  if (input.activity === "success" || input.activity === "error") return input.activity;
  return input.activity;
}

export function chooseIdleVariant(seed: number, bondLevel: HakiBondLevel): HakiAnimationName | "none" {
  const normalized = Math.abs(Math.trunc(seed));
  if (bondLevel === "bonded" && normalized % 11 === 0) return "bondedGreeting";
  const frequency = bondLevel === "bonded" ? 2 : bondLevel === "familiar" ? 3 : bondLevel === "warming" ? 4 : 6;
  if (normalized % frequency !== 0 && bondLevel !== "bonded") return "none";
  return PLAYFUL_IDLE[normalized % PLAYFUL_IDLE.length] ?? "headTilt";
}

export const HAKI_ANIMATION_DURATIONS = {
  breathMs: 3600,
  blinkMs: 190,
  reactionMs: 1100,
  successMs: 1280,
  idleVariantMs: 2300
} as const;
