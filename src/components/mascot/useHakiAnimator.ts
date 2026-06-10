import { useEffect, useMemo, useRef } from "react";
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

import { chooseIdleVariant, HAKI_ANIMATION_DURATIONS, resolveHakiAnimation } from "./hakiAnimationCatalog";
import type { HakiActivity, HakiAnimationEvent, HakiBondLevel, HakiDirection, HakiMood } from "./hakiMascotState";

export interface UseHakiAnimatorInput {
  active: boolean;
  activity: HakiActivity;
  bondLevel: HakiBondLevel;
  direction: HakiDirection;
  event?: HakiAnimationEvent | undefined;
  eventKey: number;
  gazeX?: SharedValue<number> | undefined;
  gazeY?: SharedValue<number> | undefined;
  mood: HakiMood;
  reducedMotion: boolean;
}

export function useHakiAnimator(input: UseHakiAnimatorInput) {
  const breath = useSharedValue(0);
  const blink = useSharedValue(input.activity === "sleepy" ? 1 : 0);
  const internalGazeX = useSharedValue(0);
  const internalGazeY = useSharedValue(0);
  const gazeX = input.gazeX ?? internalGazeX;
  const gazeY = input.gazeY ?? internalGazeY;
  const headRotation = useSharedValue(0);
  const headY = useSharedValue(0);
  const torsoScaleX = useSharedValue(1);
  const torsoScaleY = useSharedValue(1);
  const rootX = useSharedValue(0);
  const rootY = useSharedValue(0);
  const rootRotation = useSharedValue(0);
  const rootScale = useSharedValue(1);
  const leftWingRotation = useSharedValue(0);
  const rightWingRotation = useSharedValue(0);
  const leftFootRotation = useSharedValue(0);
  const rightFootRotation = useSharedValue(0);
  const tailRotation = useSharedValue(0);
  const beakOpen = useSharedValue(0);
  const effectProgress = useSharedValue(0);
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleSeed = useRef(0);
  const resolvedAnimation = useMemo(() => resolveHakiAnimation({
    activity: input.activity,
    explicitEvent: input.event,
    mood: input.mood,
    reducedMotion: input.reducedMotion
  }), [input.activity, input.event, input.mood, input.reducedMotion]);

  useEffect(() => {
    cancelAnimation(breath);
    cancelAnimation(tailRotation);
    breath.value = 0;
    tailRotation.value = 0;
    if (!input.active || input.reducedMotion) return;
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: HAKI_ANIMATION_DURATIONS.breathMs / 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: HAKI_ANIMATION_DURATIONS.breathMs / 2, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
    tailRotation.value = withRepeat(
      withSequence(withDelay(900, withTiming(0.045, { duration: 500 })), withTiming(-0.035, { duration: 650 }), withTiming(0, { duration: 450 })),
      -1
    );
  }, [breath, input.active, input.reducedMotion, tailRotation]);

  useEffect(() => {
    if (blinkTimer.current) clearTimeout(blinkTimer.current);
    cancelAnimation(blink);
    if (input.activity === "sleepy") {
      blink.value = input.reducedMotion ? 1 : withTiming(1, { duration: 260 });
      return;
    }
    blink.value = 0;
    if (!input.active || input.reducedMotion) return;
    let cancelled = false;
    const schedule = (delay: number) => {
      blinkTimer.current = setTimeout(() => {
        if (cancelled) return;
        blink.value = withSequence(
          withTiming(1, { duration: 75 }),
          withTiming(0, { duration: 115 }),
          Math.random() > 0.82 ? withSequence(withDelay(85, withTiming(1, { duration: 70 })), withTiming(0, { duration: 105 })) : withTiming(0, { duration: 1 })
        );
        schedule(2600 + Math.round(Math.random() * 2600));
      }, delay);
    };
    schedule(1500 + Math.round(Math.random() * 1400));
    return () => {
      cancelled = true;
      if (blinkTimer.current) clearTimeout(blinkTimer.current);
    };
  }, [blink, input.active, input.activity, input.reducedMotion]);

  useEffect(() => {
    const timing = { duration: 280, easing: Easing.out(Easing.cubic) };
    if (input.reducedMotion || !input.active) {
      headRotation.value = 0;
      headY.value = 0;
      leftWingRotation.value = 0;
      rightWingRotation.value = 0;
      leftFootRotation.value = 0;
      rightFootRotation.value = 0;
      beakOpen.value = 0;
      effectProgress.value = 0;
      rootRotation.value = 0;
      rootScale.value = 1;
      rootY.value = 0;
      gazeX.value = 0;
      gazeY.value = 0;
      return;
    }
    headRotation.value = withTiming(0, timing);
    headY.value = withTiming(0, timing);
    leftWingRotation.value = withTiming(0, timing);
    rightWingRotation.value = withTiming(0, timing);
    leftFootRotation.value = withTiming(0, timing);
    rightFootRotation.value = withTiming(0, timing);
    beakOpen.value = withTiming(0, timing);
    effectProgress.value = 0;
    rootRotation.value = withTiming(0, timing);
    rootScale.value = withTiming(1, timing);
    rootY.value = withTiming(0, timing);

    switch (input.activity) {
      case "listening":
        headRotation.value = withTiming(-0.045, { duration: 380 });
        headY.value = withTiming(18, { duration: 380 });
        break;
      case "thinking":
        headRotation.value = withRepeat(withSequence(withTiming(-0.06, { duration: 900 }), withTiming(-0.02, { duration: 900 })), -1, true);
        rightWingRotation.value = withTiming(-0.34, { duration: 520 });
        gazeX.value = withTiming(10, { duration: 420 });
        gazeY.value = withTiming(-8, { duration: 420 });
        break;
      case "answering":
        leftWingRotation.value = withRepeat(withSequence(withTiming(-0.38, { duration: 520 }), withTiming(-0.12, { duration: 620 })), -1, true);
        rightWingRotation.value = withRepeat(withSequence(withDelay(380, withTiming(0.34, { duration: 520 })), withTiming(0.08, { duration: 620 })), -1, true);
        beakOpen.value = withRepeat(withSequence(withTiming(1, { duration: 130 }), withTiming(0, { duration: 210 }), withDelay(300, withTiming(0, { duration: 1 }))), -1);
        break;
      case "success":
        rootY.value = withSequence(withTiming(22, { duration: 120 }), withTiming(-90, { duration: 270, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 8, stiffness: 165 }));
        rootScale.value = withSequence(withTiming(0.92, { duration: 120 }), withTiming(1.08, { duration: 210 }), withSpring(1));
        leftWingRotation.value = withSequence(withTiming(-0.55, { duration: 260 }), withSpring(0));
        rightWingRotation.value = withSequence(withTiming(0.55, { duration: 260 }), withSpring(0));
        effectProgress.value = withSequence(withDelay(180, withTiming(1, { duration: 420 })), withTiming(0, { duration: 500 }));
        break;
      case "error":
        headRotation.value = withRepeat(withSequence(withTiming(-0.09, { duration: 360 }), withTiming(0.09, { duration: 360 })), 2, true);
        leftWingRotation.value = withTiming(-0.18, { duration: 360 });
        rightWingRotation.value = withTiming(0.18, { duration: 360 });
        break;
      case "groggy":
        rootRotation.value = withRepeat(withSequence(withTiming(-0.09, { duration: 120 }), withTiming(0.09, { duration: 150 }), withTiming(0, { duration: 190 })), 4);
        effectProgress.value = withRepeat(withSequence(withTiming(1, { duration: 360 }), withTiming(0.25, { duration: 520 })), 4, true);
        break;
      case "onboarding":
        rightWingRotation.value = withRepeat(withSequence(withTiming(0.58, { duration: 420 }), withTiming(0.24, { duration: 390 })), -1, true);
        break;
      case "modelOperation":
        rightWingRotation.value = withTiming(-0.28, { duration: 420 });
        gazeX.value = withRepeat(withSequence(withTiming(-8, { duration: 800 }), withTiming(8, { duration: 900 })), -1, true);
        break;
      case "walking":
        leftFootRotation.value = withRepeat(withSequence(withTiming(-0.14, { duration: 190 }), withTiming(0.14, { duration: 190 })), -1, true);
        rightFootRotation.value = withRepeat(withSequence(withTiming(0.14, { duration: 190 }), withTiming(-0.14, { duration: 190 })), -1, true);
        rootY.value = withRepeat(withSequence(withTiming(-22, { duration: 190 }), withTiming(0, { duration: 190 })), -1, true);
        break;
      case "exploring":
      case "admin":
        headRotation.value = withRepeat(withSequence(withTiming(-0.045, { duration: 1100 }), withTiming(0.045, { duration: 1100 })), -1, true);
        rightWingRotation.value = withTiming(-0.24, { duration: 420 });
        break;
      default:
        break;
    }
  }, [beakOpen, effectProgress, gazeX, gazeY, headRotation, headY, input.active, input.activity, input.reducedMotion, leftFootRotation, leftWingRotation, rightFootRotation, rightWingRotation, rootRotation, rootScale, rootY]);

  useEffect(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (!input.active || input.reducedMotion || input.activity !== "idle") return;
    let cancelled = false;
    const schedule = () => {
      const familiarityDelay = input.bondLevel === "bonded" ? 6500 : input.bondLevel === "familiar" ? 7800 : 9400;
      idleTimer.current = setTimeout(() => {
        if (cancelled) return;
        idleSeed.current += 1;
        const variant = chooseIdleVariant(idleSeed.current, input.bondLevel);
        if (variant === "featherCheck" || variant === "preen") {
          headRotation.value = withSequence(withTiming(-0.12, { duration: 340 }), withDelay(520, withSpring(0)));
          leftWingRotation.value = withSequence(withTiming(-0.42, { duration: 380 }), withDelay(420, withSpring(0)));
        } else if (variant === "headTilt" || variant === "lookAround") {
          headRotation.value = withSequence(withTiming(0.1, { duration: 420 }), withDelay(520, withTiming(-0.06, { duration: 420 })), withSpring(0));
          gazeX.value = withSequence(withTiming(10, { duration: 360 }), withDelay(420, withTiming(-8, { duration: 360 })), withSpring(0));
        } else if (variant === "footShuffle") {
          leftFootRotation.value = withSequence(withTiming(-0.15, { duration: 180 }), withTiming(0.12, { duration: 180 }), withSpring(0));
          rightFootRotation.value = withDelay(130, withSequence(withTiming(0.15, { duration: 180 }), withTiming(-0.12, { duration: 180 }), withSpring(0)));
        } else if (variant === "wingStretch") {
          leftWingRotation.value = withSequence(withTiming(-0.62, { duration: 460 }), withDelay(440, withSpring(0)));
          rightWingRotation.value = withSequence(withTiming(0.62, { duration: 460 }), withDelay(440, withSpring(0)));
          rootScale.value = withSequence(withTiming(1.045, { duration: 420 }), withSpring(1));
        } else if (variant === "yawn") {
          blink.value = withSequence(withTiming(0.8, { duration: 380 }), withDelay(540, withTiming(0, { duration: 280 })));
          beakOpen.value = withSequence(withTiming(1, { duration: 340 }), withDelay(430, withTiming(0, { duration: 260 })));
        } else if (variant === "bondedGreeting") {
          rightWingRotation.value = withSequence(withTiming(0.62, { duration: 240 }), withRepeat(withSequence(withTiming(0.3, { duration: 180 }), withTiming(0.62, { duration: 180 })), 2), withSpring(0));
          effectProgress.value = withSequence(withTiming(1, { duration: 300 }), withDelay(500, withTiming(0, { duration: 420 })));
        }
        schedule();
      }, familiarityDelay + (idleSeed.current % 3) * 900);
    };
    schedule();
    return () => {
      cancelled = true;
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [beakOpen, blink, effectProgress, gazeX, headRotation, input.active, input.activity, input.bondLevel, input.reducedMotion, leftFootRotation, leftWingRotation, rightFootRotation, rightWingRotation, rootScale]);

  useEffect(() => {
    if (!input.event || input.reducedMotion || !input.active) return;
    effectProgress.value = 0;
    if (input.event === "attention") {
      rootScale.value = withSequence(withSpring(1.08), withSpring(1));
      headRotation.value = withSequence(withTiming(0.07, { duration: 180 }), withSpring(0));
    } else if (input.event === "pet") {
      headRotation.value = withSequence(withTiming(-0.08, { duration: 260 }), withDelay(500, withSpring(0)));
      leftWingRotation.value = withSequence(withTiming(-0.24, { duration: 300 }), withDelay(420, withSpring(0)));
      effectProgress.value = withSequence(withTiming(1, { duration: 380 }), withDelay(420, withTiming(0, { duration: 520 })));
    } else if (input.event === "swipe") {
      rootRotation.value = withSequence(withTiming(0.16, { duration: 150 }), withTiming(-0.1, { duration: 210 }), withSpring(0));
      rightWingRotation.value = withSequence(withTiming(0.55, { duration: 180 }), withSpring(0));
    } else if (input.event === "tripleTap") {
      rightWingRotation.value = withSequence(withTiming(0.62, { duration: 220 }), withRepeat(withSequence(withTiming(0.3, { duration: 180 }), withTiming(0.62, { duration: 180 })), 2), withSpring(0));
      effectProgress.value = withSequence(withTiming(1, { duration: 300 }), withDelay(600, withTiming(0, { duration: 500 })));
    } else if (input.event === "pokeBurst") {
      blink.value = withTiming(0.55, { duration: 180 });
      leftWingRotation.value = withSequence(withTiming(-0.62, { duration: 220 }), withDelay(620, withSpring(0)));
      headRotation.value = withSequence(withTiming(0.08, { duration: 200 }), withDelay(600, withSpring(0)));
    } else if (input.event === "wake") {
      blink.value = withTiming(0, { duration: 220 });
      leftWingRotation.value = withSequence(withTiming(-0.55, { duration: 300 }), withSpring(0));
      rightWingRotation.value = withSequence(withTiming(0.55, { duration: 300 }), withSpring(0));
    } else if (input.event === "groggy") {
      rootRotation.value = withRepeat(withSequence(withTiming(-0.1, { duration: 110 }), withTiming(0.1, { duration: 130 })), 4, true);
    }
  }, [blink, effectProgress, headRotation, input.active, input.event, input.eventKey, input.reducedMotion, leftWingRotation, rightWingRotation, rootRotation, rootScale]);

  const torsoTransform = useDerivedValue(() => [
    { scaleX: torsoScaleX.value * (1 + breath.value * 0.012) },
    { scaleY: torsoScaleY.value * (1 + breath.value * 0.018) }
  ]);
  const headTransform = useDerivedValue(() => [
    { translateY: headY.value - breath.value * 5 },
    { rotate: headRotation.value }
  ]);
  const rootTransform = useDerivedValue(() => [
    { translateX: rootX.value },
    { translateY: rootY.value },
    { rotate: rootRotation.value },
    { scale: rootScale.value }
  ]);

  return {
    beakOpen,
    blink,
    effectProgress,
    gazeX,
    gazeY,
    headTransform,
    leftFootRotation,
    leftWingRotation,
    resolvedAnimation,
    rightFootRotation,
    rightWingRotation,
    rootTransform,
    rootX,
    rootY,
    tailRotation,
    torsoTransform
  };
}
