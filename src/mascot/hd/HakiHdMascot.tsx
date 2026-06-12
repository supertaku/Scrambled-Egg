import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { MascotStatus } from "@/components/mascot/mascotConfig";
import { HD_STATUS_IMAGES } from "./hdAssets";

const EASE = Easing.inOut(Easing.ease);
/** Native grayhawk render aspect ratio (portrait). */
const HD_ASPECT_RATIO = 420 / 592;

interface HakiHdMascotProps {
  /** Pause loops when the hosting screen loses focus. */
  animated?: boolean | undefined;
  height?: number | undefined;
  reducedMotion?: boolean | undefined;
  /** Override the status-mapped art (onboarding/model poses). */
  source?: ImageSourcePropType | undefined;
  status?: MascotStatus | undefined;
  style?: StyleProp<ViewStyle> | undefined;
  /** Skip the internal float when an outer transform already bobs the mascot. */
  externalFloat?: boolean | undefined;
  width?: number | undefined;
}

/**
 * The HD cartoon Haki. One PNG per expression with procedural cartoon
 * motion layered on top — ambient float, soft breathing, a squash-and-
 * stretch pop with a quick crossfade whenever the expression changes, and
 * state-specific loops (thinking sway, celebration hops, groggy wobble,
 * sleeping breathing).
 */
export function HakiHdMascot({
  animated = true,
  externalFloat = false,
  height = 180,
  reducedMotion,
  source,
  status = "idle",
  style,
  width
}: HakiHdMascotProps) {
  const systemReducedMotion = useReducedMotion();
  const motionDisabled = reducedMotion ?? systemReducedMotion;
  const resolvedWidth = width ?? Math.round(height * HD_ASPECT_RATIO);

  const activeSource = source ?? HD_STATUS_IMAGES[status];
  const [shownSource, setShownSource] = useState(activeSource);
  const previousSourceRef = useRef(activeSource);

  const bobY = useSharedValue(0);
  const breath = useSharedValue(1);
  const sway = useSharedValue(0);
  const pop = useSharedValue(1);
  const crossfade = useSharedValue(1);

  // Expression change: quick dip-fade with a squash-and-stretch pop.
  useEffect(() => {
    if (activeSource === previousSourceRef.current) {
      return;
    }
    previousSourceRef.current = activeSource;

    if (motionDisabled || !animated) {
      setShownSource(activeSource);
      return;
    }

    cancelAnimation(crossfade);
    cancelAnimation(pop);
    crossfade.value = withSequence(
      withTiming(0, { duration: 110, easing: Easing.in(Easing.quad) }),
      withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) })
    );
    pop.value = withSequence(
      withTiming(0.93, { duration: 110, easing: Easing.in(Easing.quad) }),
      withSpring(1, { damping: 9, mass: 0.7, stiffness: 240 })
    );
    const swapTimer = setTimeout(() => setShownSource(activeSource), 115);
    return () => clearTimeout(swapTimer);
  }, [activeSource, animated, crossfade, motionDisabled, pop]);

  // State-specific ambient loops.
  useEffect(() => {
    cancelAnimation(bobY);
    cancelAnimation(breath);
    cancelAnimation(sway);
    bobY.value = 0;
    breath.value = 1;
    sway.value = 0;

    if (motionDisabled || !animated) {
      return;
    }

    const float = (amplitude: number, durationMs: number) => {
      if (!externalFloat) {
        bobY.value = withRepeat(withTiming(-amplitude, { duration: durationMs, easing: EASE }), -1, true);
      }
    };

    switch (status) {
      case "thinking":
      case "typing":
        float(3, 1500);
        sway.value = withRepeat(withTiming(0.035, { duration: 1300, easing: EASE }), -1, true);
        break;
      case "success":
        bobY.value = externalFloat
          ? 0
          : withRepeat(
              withSequence(
                withTiming(-10, { duration: 340, easing: Easing.out(Easing.quad) }),
                withTiming(0, { duration: 340, easing: Easing.in(Easing.quad) }),
                withDelay(420, withTiming(0, { duration: 1 }))
              ),
              -1,
              false
            );
        breath.value = withRepeat(withTiming(1.03, { duration: 340, easing: EASE }), -1, true);
        break;
      case "groggy":
        sway.value = withRepeat(
          withSequence(
            withTiming(0.06, { duration: 140, easing: EASE }),
            withTiming(-0.06, { duration: 140, easing: EASE }),
            withTiming(0, { duration: 180, easing: EASE }),
            withDelay(650, withTiming(0, { duration: 1 }))
          ),
          -1,
          false
        );
        break;
      case "sleepy":
      case "error":
        float(2, 2300);
        breath.value = withRepeat(withTiming(1.025, { duration: 1900, easing: EASE }), -1, true);
        break;
      case "idea":
        float(5, 900);
        break;
      case "teaching":
      case "interrogating":
        float(3, 1600);
        breath.value = withRepeat(withTiming(1.015, { duration: 1700, easing: EASE }), -1, true);
        break;
      case "idle":
      default:
        float(4, 1800);
        breath.value = withRepeat(withTiming(1.015, { duration: 2200, easing: EASE }), -1, true);
        break;
    }
  }, [animated, bobY, breath, externalFloat, motionDisabled, status, sway]);

  useEffect(() => {
    return () => {
      cancelAnimation(bobY);
      cancelAnimation(breath);
      cancelAnimation(sway);
      cancelAnimation(pop);
      cancelAnimation(crossfade);
    };
  }, [bobY, breath, crossfade, pop, sway]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: crossfade.value,
    transform: [
      { translateY: bobY.value },
      { rotate: `${sway.value}rad` },
      // Volume-preserving squash & stretch around the feet.
      { scaleX: (2 - breath.value) * (2 - pop.value) },
      { scaleY: breath.value * pop.value }
    ]
  }));

  return (
    <View style={[styles.frame, { height, width: resolvedWidth }, style]}>
      <Animated.View style={[styles.imageWrap, animatedStyle]}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={shownSource}
          style={styles.image}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "flex-end"
  },
  imageWrap: {
    height: "100%",
    transformOrigin: "50% 100%",
    width: "100%"
  },
  image: {
    height: "100%",
    width: "100%"
  }
});
