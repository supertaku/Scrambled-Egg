export type HakiPanGesture = "pet" | "drag" | "swipe";

export interface HakiGestureSample {
  distanceX: number;
  durationMs: number;
  reversals: number;
  velocityX: number;
}

export function classifyHakiGesture(sample: HakiGestureSample): HakiPanGesture {
  if (Math.abs(sample.velocityX) >= 650 && Math.abs(sample.distanceX) >= 45 && sample.durationMs <= 320) return "swipe";
  if (sample.durationMs >= 600 && sample.reversals >= 2 && Math.abs(sample.distanceX) >= 18) return "pet";
  return "drag";
}
