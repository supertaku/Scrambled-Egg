import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, type ImageSourcePropType, type StyleProp, type ViewStyle } from "react-native";

import { useReducedMotion } from "@/hooks/useReducedMotion";

export type PixelHakiState = "idle" | "thinking" | "helping" | "success" | "sleepy" | "detective" | "aha" | "dizzy";

const FRAME_IMAGES = {
  blink: require("../../../assets/images/mascot/pixel/haki-pixel-blink.png"),
  detective: require("../../../assets/images/mascot/pixel/haki-pixel-detective.png"),
  helping: require("../../../assets/images/mascot/pixel/haki-pixel-helping.png"),
  idle: require("../../../assets/images/mascot/pixel/haki-pixel-idle.png"),
  sleepy: require("../../../assets/images/mascot/pixel/haki-pixel-sleepy.png"),
  success: require("../../../assets/images/mascot/pixel/haki-pixel-success.png"),
  thinking: require("../../../assets/images/mascot/pixel/haki-pixel-thinking.png"),
  thinkingAlt: require("../../../assets/images/mascot/pixel/haki-pixel-thinking-alt.png"),
  aha: require("../../../assets/images/mascot/pixel/haki-pixel-aha.png"),
  dizzy: require("../../../assets/images/mascot/pixel/haki-pixel-dizzy.png")
} satisfies Record<string, ImageSourcePropType>;

const PORTRAIT_IMAGE = require("../../../assets/images/mascot/pixel/haki-pixel-portrait.png");

const STATE_FRAMES: Record<PixelHakiState, ImageSourcePropType[]> = {
  idle: [FRAME_IMAGES.idle, FRAME_IMAGES.blink],
  thinking: [FRAME_IMAGES.thinking, FRAME_IMAGES.thinkingAlt],
  helping: [FRAME_IMAGES.helping],
  success: [FRAME_IMAGES.success],
  sleepy: [FRAME_IMAGES.sleepy],
  detective: [FRAME_IMAGES.detective],
  aha: [FRAME_IMAGES.aha],
  dizzy: [FRAME_IMAGES.dizzy]
};

interface PixelHakiProps {
  animated?: boolean;
  height?: number;
  reducedMotion?: boolean;
  state?: PixelHakiState;
  style?: StyleProp<ViewStyle>;
  width?: number;
}

export function PixelHaki({
  animated = true,
  height = 180,
  reducedMotion,
  state = "idle",
  style,
  width = Math.round(height * 0.62)
}: PixelHakiProps) {
  const systemReducedMotion = useReducedMotion();
  const motionDisabled = reducedMotion ?? systemReducedMotion;
  const frames = STATE_FRAMES[state];
  const [frameIndex, setFrameIndex] = useState(0);
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setFrameIndex(0);
    if (!animated || motionDisabled || frames.length < 2) {
      return undefined;
    }

    const intervalMs = state === "thinking" ? 900 : 1450;
    const timer = setInterval(() => setFrameIndex((index) => (index + 1) % frames.length), intervalMs);
    return () => clearInterval(timer);
  }, [animated, frames, motionDisabled, state]);

  useEffect(() => {
    translateY.stopAnimation();
    translateY.setValue(0);
    if (!animated || motionDisabled || state === "detective" || state === "dizzy") {
      return undefined;
    }

    const lift = state === "success" ? -6 : state === "helping" || state === "aha" ? -3 : state === "sleepy" ? 2 : -2;
    const duration = state === "success" ? 560 : state === "sleepy" ? 1900 : 1250;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          duration,
          easing: Easing.inOut(Easing.ease),
          toValue: lift,
          useNativeDriver: true
        }),
        Animated.timing(translateY, {
          duration,
          easing: Easing.inOut(Easing.ease),
          toValue: 0,
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated, motionDisabled, state, translateY]);

  const source = frames[Math.min(frameIndex, frames.length - 1)] ?? frames[0];

  return (
    <Animated.View style={[styles.frame, { height, width }, style, { transform: [{ translateY }] }]}>
      <Image accessibilityIgnoresInvertColors resizeMode="contain" source={source} style={styles.image} />
    </Animated.View>
  );
}

export function PixelHakiPortrait({
  size = 34,
  style
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View style={[styles.frame, { height: size, width: size }, style]}>
      <Image accessibilityIgnoresInvertColors resizeMode="contain" source={PORTRAIT_IMAGE} style={styles.image} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center"
  },
  image: {
    height: "100%",
    width: "100%"
  }
});
