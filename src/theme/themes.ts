import { palette } from "./palette";

export type ThemeMode = "light" | "dark";
export type ThemePreference = "system" | ThemeMode;

/**
 * Semantic theme tokens. Every key the legacy `colors` object exposed is kept
 * so existing imports compile and render identically; new code should prefer
 * the semantic names (bg, textPrimary, card, ...) added at the bottom.
 */
export interface ThemeColors {
  // Brand
  maroon: string;
  maroonDark: string;
  maroonDeep: string;
  maroonSoft: string;
  maroonGlow: string;

  // Neutrals
  white: string;
  ink: string;
  muted: string;
  mutedLight: string;
  border: string;
  borderStrong: string;
  surface: string;
  surfaceElevated: string;
  shadow: string;

  // Gold / Accent
  gold: string;
  goldLight: string;
  goldSoft: string;
  goldGlow: string;

  // Semantic states
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  goldBorder: string;
  maroonBorder: string;

  // Grayhawk
  grayhawk: string;
  grayhawkDark: string;

  // Overlays / Glass
  overlayLight: string;
  overlayMedium: string;
  overlayDark: string;
  glassCard: string;
  tabBar: string;

  // Gradient anchors
  maroonGradStart: string;
  maroonGradEnd: string;

  // Semantic aliases (new code should use these)
  bg: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentOn: string;
  bubbleBg: string;
  bubbleBorder: string;
}

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
}

/** Exact values the app shipped with — zero visual diff for existing screens. */
export const lightColors: ThemeColors = {
  maroon: palette.maroon,
  maroonDark: palette.maroonDark,
  maroonDeep: palette.maroonDeep,
  maroonSoft: palette.maroonSoft,
  maroonGlow: "rgba(122, 0, 25, 0.18)",

  white: palette.white,
  ink: palette.ink,
  muted: palette.muted,
  mutedLight: palette.mutedLight,
  border: palette.border,
  borderStrong: palette.borderStrong,
  surface: palette.surface,
  surfaceElevated: palette.surfaceElevated,
  shadow: palette.black,

  gold: palette.gold,
  goldLight: palette.goldLight,
  goldSoft: palette.goldSoft,
  goldGlow: "rgba(184, 155, 66, 0.22)",

  success: palette.success,
  successSoft: palette.successSoft,
  warning: palette.warning,
  warningSoft: palette.warningSoft,
  danger: palette.danger,
  dangerSoft: palette.dangerSoft,
  dangerBorder: palette.dangerBorder,
  goldBorder: palette.goldBorder,
  maroonBorder: palette.maroonBorder,

  grayhawk: palette.grayhawk,
  grayhawkDark: palette.grayhawkDark,

  overlayLight: "rgba(255, 255, 255, 0.08)",
  overlayMedium: "rgba(255, 255, 255, 0.14)",
  overlayDark: "rgba(0, 0, 0, 0.08)",
  glassCard: "rgba(255, 255, 255, 0.92)",
  tabBar: "rgba(14, 14, 18, 0.88)",

  maroonGradStart: palette.maroonGradStart,
  maroonGradEnd: palette.maroonGradEnd,

  bg: palette.surface,
  card: palette.white,
  textPrimary: palette.ink,
  textSecondary: palette.muted,
  textMuted: palette.mutedLight,
  accent: palette.maroon,
  accentSoft: palette.maroonSoft,
  accentOn: palette.white,
  bubbleBg: palette.white,
  bubbleBorder: palette.ink
};

/**
 * Maroon-tinted dark surfaces; brand maroon brightened and gold lifted so
 * text/accents keep >= 4.5:1 contrast on the dark backgrounds.
 */
export const darkColors: ThemeColors = {
  maroon: palette.maroonBright,
  // Used as emphasized brand TEXT across the app, so in dark mode it must
  // be a readable light rose, not a darker maroon.
  maroonDark: "#EDB8C4",
  maroonDeep: palette.maroonDeep,
  maroonSoft: palette.maroonSoftDark,
  maroonGlow: "rgba(163, 41, 74, 0.28)",

  white: palette.white,
  ink: palette.textOnDark,
  muted: palette.textMutedOnDark,
  mutedLight: palette.textFaintOnDark,
  border: palette.borderDark,
  borderStrong: palette.borderStrongDark,
  surface: palette.surfaceDark,
  surfaceElevated: palette.surfaceElevatedDark,
  shadow: palette.black,

  gold: palette.goldBright,
  goldLight: palette.goldLight,
  goldSoft: palette.goldSoftDark,
  goldGlow: "rgba(226, 201, 126, 0.20)",

  success: palette.successBright,
  successSoft: palette.successSoftDark,
  warning: palette.warningBright,
  warningSoft: palette.warningSoftDark,
  danger: palette.dangerBright,
  dangerSoft: palette.dangerSoftDark,
  dangerBorder: palette.dangerBright,
  goldBorder: palette.goldBright,
  maroonBorder: palette.maroonBright,

  grayhawk: palette.grayhawk,
  grayhawkDark: palette.grayhawkDark,

  overlayLight: "rgba(255, 255, 255, 0.06)",
  overlayMedium: "rgba(255, 255, 255, 0.12)",
  overlayDark: "rgba(0, 0, 0, 0.28)",
  glassCard: "rgba(37, 30, 38, 0.92)",
  tabBar: "rgba(10, 8, 11, 0.92)",

  maroonGradStart: palette.maroonGradStart,
  maroonGradEnd: palette.maroonGradEnd,

  bg: palette.surfaceDark,
  card: palette.cardDark,
  textPrimary: palette.textOnDark,
  textSecondary: palette.textMutedOnDark,
  textMuted: palette.textFaintOnDark,
  accent: palette.maroonBright,
  accentSoft: palette.maroonSoftDark,
  accentOn: palette.white,
  bubbleBg: palette.cardDark,
  bubbleBorder: palette.borderStrongDark
};

export const lightTheme: Theme = { mode: "light", colors: lightColors };
export const darkTheme: Theme = { mode: "dark", colors: darkColors };
