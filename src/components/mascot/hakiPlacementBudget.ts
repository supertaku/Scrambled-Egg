import type { HakiPlacement } from "./hakiMascotState";

export type HakiDetailLevel = "full" | "compact" | "map" | "static";

export interface HakiPlacementBudget {
  animate: boolean;
  detail: HakiDetailLevel;
  showMoodBadge: boolean;
}

const BUDGETS: Record<HakiPlacement, HakiPlacementBudget> = {
  header: { animate: true, detail: "full", showMoodBadge: true },
  chatListening: { animate: true, detail: "compact", showMoodBadge: false },
  chatAvatar: { animate: false, detail: "static", showMoodBadge: false },
  onboarding: { animate: true, detail: "full", showMoodBadge: true },
  modelStatus: { animate: true, detail: "compact", showMoodBadge: true },
  tabPopup: { animate: true, detail: "full", showMoodBadge: false },
  admin: { animate: true, detail: "compact", showMoodBadge: false },
  mapPlayer: { animate: true, detail: "map", showMoodBadge: false },
  mapDialogue: { animate: true, detail: "compact", showMoodBadge: false }
};

export function placementBudgetFor(placement: HakiPlacement): HakiPlacementBudget {
  return BUDGETS[placement];
}
