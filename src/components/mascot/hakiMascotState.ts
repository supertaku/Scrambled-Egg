import type { MascotStatus } from "./mascotConfig";

export type HakiActivity =
  | "idle"
  | "listening"
  | "thinking"
  | "answering"
  | "success"
  | "error"
  | "sleepy"
  | "groggy"
  | "onboarding"
  | "modelOperation"
  | "walking"
  | "exploring"
  | "admin";

export type HakiPlacement =
  | "header"
  | "chatListening"
  | "chatAvatar"
  | "onboarding"
  | "modelStatus"
  | "tabPopup"
  | "admin"
  | "mapPlayer"
  | "mapDialogue";

export type HakiMood = "calm" | "curious" | "happy" | "sleepy" | "dizzy" | "concerned" | "annoyed" | "focused";
export type HakiBondLevel = "new" | "warming" | "familiar" | "bonded";
export type HakiDirection = "front" | "left" | "right" | "back";
export type HakiAnimationEvent = "attention" | "pet" | "drag" | "swipe" | "tripleTap" | "pokeBurst" | "wake" | "groggy";
export type HakiInteractionEvent = HakiAnimationEvent | "tap" | "doubleTap" | "longPress";
export type HakiBondEvent =
  | "tap"
  | "sleep"
  | "wake"
  | "groggy"
  | "answer_success"
  | "answer_error"
  | "positive_feedback"
  | "negative_feedback"
  | "pet"
  | "play"
  | "pokeBurst"
  | "mapDiscovery"
  | "returnVisit";

export interface HakiBondState {
  familiarity: number;
  interactionCount: number;
  lastInteractionAt: string | null;
  mood: HakiMood;
  recentPositiveEvents: number;
  recentNegativeEvents: number;
}

export const DEFAULT_HAKI_BOND_STATE: HakiBondState = {
  familiarity: 0,
  interactionCount: 0,
  lastInteractionAt: null,
  mood: "curious",
  recentPositiveEvents: 0,
  recentNegativeEvents: 0
};

const MOOD_BADGE: Record<HakiMood, string> = {
  calm: "Calm",
  curious: "Curious",
  happy: "Happy",
  sleepy: "Sleepy",
  dizzy: "Dizzy",
  concerned: "Concerned",
  annoyed: "Annoyed",
  focused: "Focused"
};

export function activityForMascotStatus(status: MascotStatus): HakiActivity {
  switch (status) {
    case "thinking":
    case "typing":
    case "interrogating":
      return "thinking";
    case "teaching":
    case "idea":
      return "answering";
    case "success":
      return "success";
    case "error":
      return "error";
    case "sleepy":
      return "sleepy";
    case "groggy":
      return "groggy";
    default:
      return "idle";
  }
}

export function bondLevelForFamiliarity(familiarity: number): HakiBondLevel {
  if (familiarity >= 12) return "bonded";
  if (familiarity >= 4) return "familiar";
  if (familiarity >= 1) return "warming";
  return "new";
}

export function moodBadgeForMascotMood(mood: HakiMood): string {
  return MOOD_BADGE[mood];
}

export function moodForActivity(activity: HakiActivity, fallback: HakiMood): HakiMood {
  if (activity === "success") return "happy";
  if (activity === "error") return "concerned";
  if (activity === "sleepy") return "sleepy";
  if (activity === "groggy") return "dizzy";
  if (activity === "thinking" || activity === "modelOperation") return "focused";
  return fallback;
}

export function nextBondState(state: HakiBondState, event: HakiBondEvent, at = new Date().toISOString()): HakiBondState {
  const base: HakiBondState = {
    ...state,
    interactionCount: state.interactionCount + 1,
    lastInteractionAt: at
  };

  switch (event) {
    case "answer_success":
    case "positive_feedback":
      return positive(base, state, 3);
    case "pet":
    case "play":
    case "mapDiscovery":
      return positive(base, state, 2);
    case "returnVisit":
      return positive(base, state, 1);
    case "answer_error":
    case "negative_feedback":
      return negative(base, state, "concerned");
    case "pokeBurst":
      return negative(base, state, "annoyed");
    case "groggy":
      return negative(base, state, "dizzy");
    case "sleep":
      return { ...base, familiarity: Math.min(20, state.familiarity + 1), mood: "sleepy" };
    case "wake":
    case "tap":
    default:
      return { ...base, familiarity: Math.min(20, state.familiarity + 1), mood: "curious" };
  }
}

function positive(base: HakiBondState, previous: HakiBondState, amount: number): HakiBondState {
  return {
    ...base,
    familiarity: Math.min(20, previous.familiarity + amount),
    mood: "happy",
    recentPositiveEvents: Math.min(5, previous.recentPositiveEvents + 1),
    recentNegativeEvents: Math.max(0, previous.recentNegativeEvents - 1)
  };
}

function negative(base: HakiBondState, previous: HakiBondState, mood: HakiMood): HakiBondState {
  return {
    ...base,
    mood,
    recentNegativeEvents: Math.min(5, previous.recentNegativeEvents + 1)
  };
}

export type HakiMascotActivity = HakiActivity;
export type HakiMascotMood = HakiMood;
export type HakiMascotPlacement = HakiPlacement;
