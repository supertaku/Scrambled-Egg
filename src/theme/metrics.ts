import { Dimensions, Platform } from "react-native";

const { width, height } = Dimensions.get("window");

export const metrics = {
  screenWidth: width,
  screenHeight: height,
  keyboard: {
    chatVerticalOffset: Platform.OS === "ios" ? 78 : 90,
  },
  animation: {
    fadeDurationMs: 400,
    springFriction: 8,
    springTension: 30,
  },
};
