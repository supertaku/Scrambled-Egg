import { useEffect } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { HD_PORTRAIT_IMAGE } from "./hdAssets";

interface HakiHdAvatarProps {
  /** Only the most recent chat bubble should animate; older rows stay still. */
  animated?: boolean | undefined;
  size?: number | undefined;
  style?: StyleProp<ViewStyle> | undefined;
}

/** HD Haki portrait for chat bubbles — gentle breathing when animated. */
export function HakiHdAvatar({ animated = false, size = 34, style }: HakiHdAvatarProps) {
  const reducedMotion = useReducedMotion();
  const breath = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(breath);
    breath.value = 1;
    if (animated && !reducedMotion) {
      breath.value = withRepeat(
        withTiming(1.04, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }
    return () => cancelAnimation(breath);
  }, [animated, breath, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }]
  }));

  return (
    <View style={[styles.frame, { height: size, width: size }, style]}>
      <Animated.View style={animatedStyle}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={HD_PORTRAIT_IMAGE}
          style={{ height: size, width: size }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center"
  }
});
