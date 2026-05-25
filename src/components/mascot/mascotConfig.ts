import type { PixelHakiState } from "./PixelHaki";

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

export const SLEEPING_DIALOGUE = "Zzz... Haki is resting for a bit.";
export const WAKE_DIALOGUE = "Okay, I'm awake. What can I help with?";
export const GROGGY_DIALOGUE = "Hey! Don't shake your phone I feel dizzy!";

export function pixelStateForMascotStatus(status: MascotStatus): PixelHakiState {
  switch (status) {
    case "thinking":
    case "typing":
      return "thinking";
    case "teaching":
    case "idea":
      return "helping";
    case "success":
      return "success";
    case "sleepy":
    case "error":
      return "sleepy";
    case "groggy":
      return "dizzy";
    case "interrogating":
      return "detective";
    case "idle":
    default:
      return "idle";
  }
}
