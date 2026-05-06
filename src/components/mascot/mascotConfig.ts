import type { ImageSourcePropType } from "react-native";

export type MascotStatus =
  | "idle"
  | "thinking"
  | "interrogating"
  | "sleepy"
  | "teaching"
  | "idea"
  | "typing"
  | "success"
  | "error"
  | "groggy";

export type InteractiveMascotState = "awake" | "sleeping" | "groggy";

export const DOUBLE_TAP_DELAY_MS = 260;
export const GROGGY_RECOVERY_MS = 10_000;
export const WAKE_DIALOGUE_VISIBLE_MS = 3500;

export const SLEEPING_DIALOGUE = "Zzz... Haki is sleeping. Tap him again to wake him up.";
export const WAKE_DIALOGUE = "Okay, gising na ako. Ano'ng concern natin?";
export const GROGGY_DIALOGUE = "Whoa... groggy ako. Give me a minute to recover.";

export const mascotImages: Record<MascotStatus, ImageSourcePropType> = {
  idle: require("../../../assets/images/mascot/grayhawk-idle.png"),
  sleepy: require("../../../assets/images/mascot/grayhawk-sleepy.png"),
  thinking: require("../../../assets/images/mascot/grayhawk-thinking.png"),
  teaching: require("../../../assets/images/mascot/grayhawk-teaching.png"),
  typing: require("../../../assets/images/mascot/grayhawk-thinking.png"),
  interrogating: require("../../../assets/images/mascot/grayhawk-thinking.png"),
  idea: require("../../../assets/images/mascot/grayhawk-teaching.png"),
  success: require("../../../assets/images/mascot/grayhawk-teaching.png"),
  error: require("../../../assets/images/mascot/grayhawk-sleepy.png"),
  groggy: require("../../../assets/images/mascot/grayhawk-sleepy.png")
};
