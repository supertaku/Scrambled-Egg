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
export const IDLE_TURN_INTERVAL_MS = 14_000;
export const TURNAROUND_VISIBLE_MS = 1700;
export const WAKE_DIALOGUE_VISIBLE_MS = 3500;

export const SLEEPING_DIALOGUE = "Zzz... Haki is resting. Double-tap me when you need me.";
export const WAKE_DIALOGUE = "Okay, gising na ako. Ano'ng concern natin?";
export const GROGGY_DIALOGUE = "Hey! Don't shake your phone I feel dizzy!";

export const mascotTurnaroundImage: ImageSourcePropType = require("../../../assets/animations/haki-turnaround.gif");

export const mascotImages: Record<MascotStatus, ImageSourcePropType> = {
  idle: require("../../../assets/images/mascot/grayhawk-idle.png"),
  sleepy: require("../../../assets/images/mascot/grayhawk-sleepy.png"),
  thinking: require("../../../assets/images/mascot/grayhawk-thinking.png"),
  teaching: require("../../../assets/images/mascot/haki-white-uniform.png"),
  typing: require("../../../assets/images/mascot/grayhawk-thinking.png"),
  interrogating: require("../../../assets/images/mascot/grayhawk-thinking.png"),
  idea: require("../../../assets/images/mascot/haki-white-uniform.png"),
  success: require("../../../assets/images/mascot/haki-white-uniform.png"),
  error: require("../../../assets/images/mascot/grayhawk-sleepy.png"),
  groggy: require("../../../assets/images/mascot/grayhawk-dizzy.png")
};
