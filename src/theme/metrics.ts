import { Dimensions, Platform } from "react-native";

const { width, height } = Dimensions.get("window");

export const metrics = {
  screenWidth: width,
  screenHeight: height,

  keyboard: {
    chatVerticalOffset: Platform.OS === "ios" ? 78 : 90,
  },

  animation: {
    fadeDurationMs: 350,
    springFriction: 8,
    springTension: 30,
    fastDuration: 180,
    normalDuration: 320,
    slowDuration: 500,
  },

  radius: {
    sm: 10,
    md: 16,
    lg: 22,
    xl: 28,
    xxl: 36,
    full: 999,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 14,
    lg: 20,
    xl: 28,
    xxl: 40,
  },

  shadow: {
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 8,
      elevation: 3,
    },
    elevated: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 6,
    },
    floating: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 12,
    },
  },
} as const;
