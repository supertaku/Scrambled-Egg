/**
 * Raw color scales. Never import these directly in screens or components —
 * consume semantic tokens from `useTheme()` (or the legacy `colors` alias)
 * so light/dark resolution stays centralized.
 */
export const palette = {
  black: "#000000",
  // Maroon (TUP brand)
  maroon: "#7A0019",
  maroonBright: "#A3294A",
  maroonDark: "#4F0012",
  maroonDeep: "#2E000A",
  maroonSoft: "#F7E8EC",
  maroonSoftDark: "#3A1620",
  maroonBorder: "#E8C7D0",
  maroonGradStart: "#8B001D",
  maroonGradEnd: "#4F0012",

  // Gold (TUP accent)
  gold: "#B89B42",
  goldLight: "#D4B96A",
  goldBright: "#E2C97E",
  goldSoft: "#F7F0D8",
  goldSoftDark: "#3B3320",
  goldBorder: "#E8D98B",

  // Neutrals — light surfaces
  white: "#FFFFFF",
  ink: "#1A2233",
  muted: "#667085",
  mutedLight: "#98A2B3",
  border: "#E4E7EC",
  borderStrong: "#C8CDD6",
  surface: "#F7F7F5",
  surfaceElevated: "#FAFAF8",

  // Neutrals — dark surfaces (maroon-tinted, OLED-friendly)
  inkDark: "#0F0D10",
  surfaceDark: "#171318",
  surfaceElevatedDark: "#201A21",
  cardDark: "#251E26",
  textOnDark: "#F2EDEE",
  textMutedOnDark: "#B3A8AC",
  textFaintOnDark: "#8A7E83",
  borderDark: "#39303A",
  borderStrongDark: "#4D4250",

  // Semantic
  success: "#147A3D",
  successBright: "#3DBA6F",
  successSoft: "#D1FADF",
  successSoftDark: "#10301E",
  warning: "#9A6700",
  warningBright: "#D8A23C",
  warningSoft: "#FEF0C7",
  warningSoftDark: "#3A2E10",
  danger: "#B42318",
  dangerBright: "#E5564A",
  dangerSoft: "#FEE4E2",
  dangerSoftDark: "#3C1714",
  dangerBorder: "#FDA29B",

  // Grayhawk (mascot feathers)
  grayhawk: "#8E99A8",
  grayhawkDark: "#586474"
} as const;
