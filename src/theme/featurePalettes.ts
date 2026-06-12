import type { ThemeColors, ThemeMode } from "./themes";

/** Fixed colors belonging to the pixel-art campus-map presentation. */
export const campusMapPalette = {
  backdrop: "#17151C",
  backdropBorder: "#2B2625",
  controlGold: "#FFDA77",
  controlHighlight: "#F8EDB5",
  controlShadow: "#4B2825",
  cyan: "#50C8FF",
  cyanOutline: "#0D2337",
  deepMaroon: "#6D1930",
  dialogOutline: "#C89E47",
  gold: "#F6D26F",
  goldGlow: "#FFD85E",
  goldOutline: "#533234",
  goldPressed: "#D7AE47",
  ink: "#35252A",
  inkStrong: "#3B2022",
  maroon: "#6B292B",
  mapPanel: "#2C2830",
  mutedBorder: "#735050",
  mutedText: "#654E48",
  paper: "#FFF3BF",
  paperBright: "#FFFBE4",
  paleGold: "#FCE9A5",
  paleGoldBright: "#FEF1B5",
  paleGoldText: "#FFF3C7",
  placeholder: "#766D60",
  promptBackdrop: "#4B3538",
  sand: "#F7DF91",
  sandOutline: "#7B3937",
  shadow: "#000000",
  text: "#493E39",
  tupMaroon: "#7A0019"
} as const;

export const mapPreviewPalette = {
  frame: "#281B23",
  frameHighlight: "#F0D786",
  launchBorder: "#F6D777",
  launchFill: "#FFDE82",
  launchInk: "#3B2022",
  shadow: "#000000"
} as const;

export const tipCategoryPalette: Record<string, string> = {
  Printing: "#2E7DB2",
  Documents: "#D4860A",
  Enrollment: "#147A3D",
  Routine: "#6B5FB5",
  Study: "#0C7BB3",
  Food: "#C45A1B",
  Files: "#9A6700",
  Time: "#586474",
  Review: "#147A3D",
  Teamwork: "#2E7DB2"
};

export const chatListeningPalette = {
  branch: "#7B4E2D",
  leaf: "#3E8A4B"
} as const;

export function bulletinPaperPalette(mode: ThemeMode) {
  return mode === "dark"
    ? {
        board: "#221C16",
        border: "#4A3E30",
        featured: "#332B1C",
        featuredBorder: "#5A4C2C",
        note: "#2B241C",
        noteSoft: "#2E2720",
        submitBorder: "#4D4250",
        tape: "#3A2F22"
      }
    : {
        board: "#F5EFE6",
        border: "#E7D8C5",
        featured: "#FFF7D9",
        featuredBorder: "#E6D697",
        note: "#FFFCF6",
        noteSoft: "#FFF9F0",
        submitBorder: "#E8C7D0",
        tape: "#FFF4E3"
      };
}

export function serviceDeskPalette(colors: ThemeColors) {
  return {
    campusGuidelines: {
      accent: colors.maroon,
      background: colors.maroonSoft,
      border: "#E8C7D0"
    },
    mapDirectory: {
      accent: "#1565C0",
      background: "#E3F2FD",
      border: "#90CAF9",
      tint: colors.accentSoft
    },
    offices: {
      accent: "#2E7D32",
      background: "#E8F5E9",
      border: "#A5D6A7",
      tint: colors.successSoft
    },
    safety: {
      accent: "#E65100",
      background: "#FFF3E0",
      border: "#FFCC80",
      tint: colors.warningSoft
    },
    welfare: {
      accent: "#1565C0",
      background: "#E3F2FD",
      border: "#90CAF9"
    },
    otherOffice: {
      accent: "#6B5FB5",
      background: "#EFEAFB",
      border: "#CEBDF3"
    },
    detail: {
      safetyText: "#E65100",
      shadow: "#000000",
      warmBorder: "#E8D98B"
    }
  } as const;
}
