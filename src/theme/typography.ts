export const typography = {
  // Font sizes
  display: 30,
  title: 24,
  heading: 20,
  subheading: 17,
  body: 15,
  small: 13,
  tiny: 11,

  // Font weights (as string literals for RN)
  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    extrabold: "800" as const,
    black: "900" as const,
  },

  // Letter spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 1.5,
  },
} as const;
