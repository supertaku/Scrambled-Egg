import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Image, Platform, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { colors } from "@/theme/colors";
import { HAKI_ASSETS } from "./hakiAssets";
import { HakiCanvas } from "./HakiCanvas";
import { classifyHakiGesture } from "./hakiGestures";
import {
  bondLevelForFamiliarity,
  moodBadgeForMascotMood,
  moodForActivity,
  type HakiActivity,
  type HakiAnimationEvent,
  type HakiBondLevel,
  type HakiDirection,
  type HakiInteractionEvent,
  type HakiMood,
  type HakiPlacement
} from "./hakiMascotState";
import { placementBudgetFor } from "./hakiPlacementBudget";

export interface HakiMascotProps {
  activity: HakiActivity;
  placement: HakiPlacement;
  mood?: HakiMood | undefined;
  bondLevel?: HakiBondLevel | undefined;
  familiarity?: number | undefined;
  direction?: HakiDirection | undefined;
  event?: HakiAnimationEvent | undefined;
  eventKey?: number | undefined;
  interactionMode?: "none" | "compact" | "full" | undefined;
  active?: boolean | undefined;
  reducedMotion?: boolean | undefined;
  size: number;
  onInteraction?: ((event: HakiInteractionEvent) => void) | undefined;
  onLongPress?: (() => void) | undefined;
  showMoodBadge?: boolean | undefined;
  style?: StyleProp<ViewStyle> | undefined;
}

const DRAG_RADIUS_RATIO = 0.22;
const POKE_WINDOW_MS = 3000;

export function HakiMascot({
  activity,
  active = true,
  bondLevel,
  direction = "front",
  event,
  eventKey = 0,
  familiarity = 0,
  interactionMode = "none",
  mood = "curious",
  onInteraction,
  onLongPress,
  placement,
  reducedMotion,
  showMoodBadge,
  size,
  style
}: HakiMascotProps) {
  const systemReducedMotion = useReducedMotion();
  const motionDisabled = reducedMotion ?? systemReducedMotion;
  const budget = placementBudgetFor(placement);
  const resolvedBondLevel = bondLevel ?? bondLevelForFamiliarity(familiarity);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [localActivity, setLocalActivity] = useState<HakiActivity>(activity);
  const [localEvent, setLocalEvent] = useState<HakiAnimationEvent | undefined>(event);
  const [localEventKey, setLocalEventKey] = useState(eventKey);
  const pokeTimes = useRef<number[]>([]);
  const panStartedAt = useSharedValue(0);
  const previousPanX = useSharedValue(0);
  const previousPanDirection = useSharedValue(0);
  const panReversals = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const gazeX = useSharedValue(0);
  const gazeY = useSharedValue(0);
  const resolvedMood = moodForActivity(localActivity, mood);
  const shouldAnimate = active && appActive && budget.animate && !motionDisabled;
  const badgeVisible = (showMoodBadge ?? budget.showMoodBadge) && size >= 112;

  useEffect(() => setLocalActivity(activity), [activity]);
  useEffect(() => {
    setLocalEvent(event);
    setLocalEventKey(eventKey);
  }, [event, eventKey]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => setAppActive(nextState === "active"));
    return () => subscription.remove();
  }, []);

  const triggerEvent = useCallback((nextEvent: HakiAnimationEvent, interaction?: HakiInteractionEvent) => {
    setLocalEvent(nextEvent);
    setLocalEventKey((key) => key + 1);
    onInteraction?.(interaction ?? nextEvent);
  }, [onInteraction]);

  const handleSingleTap = useCallback(() => {
    const now = Date.now();
    pokeTimes.current = [...pokeTimes.current.filter((time) => now - time < POKE_WINDOW_MS), now];
    if (pokeTimes.current.length >= 4) {
      pokeTimes.current = [];
      triggerEvent("pokeBurst");
      return;
    }
    triggerEvent("attention", "tap");
  }, [triggerEvent]);

  const handleDoubleTap = useCallback(() => {
    if (localActivity === "sleepy") {
      setLocalActivity(activity === "sleepy" ? "idle" : activity);
      triggerEvent("wake", "doubleTap");
    } else {
      setLocalActivity("sleepy");
      onInteraction?.("doubleTap");
    }
  }, [activity, localActivity, onInteraction, triggerEvent]);

  const handlePanEnd = useCallback((distanceX: number, durationMs: number, reversals: number, velocityX: number) => {
    const classified = classifyHakiGesture({ distanceX, durationMs, reversals, velocityX });
    triggerEvent(classified === "pet" ? "pet" : classified === "swipe" ? "swipe" : "drag", classified);
  }, [triggerEvent]);

  const singleTap = useMemo(() => Gesture.Tap().numberOfTaps(1).maxDuration(240).onEnd((_event, success) => {
    if (success) runOnJS(handleSingleTap)();
  }), [handleSingleTap]);
  const doubleTap = useMemo(() => Gesture.Tap().numberOfTaps(2).maxDelay(260).onEnd((_event, success) => {
    if (success) runOnJS(handleDoubleTap)();
  }), [handleDoubleTap]);
  const tripleTap = useMemo(() => Gesture.Tap().numberOfTaps(3).maxDelay(240).onEnd((_event, success) => {
    if (success) runOnJS(triggerEvent)("tripleTap");
  }), [triggerEvent]);
  const longPress = useMemo(() => Gesture.LongPress().minDuration(450).onEnd((_event, success) => {
    if (success && onLongPress) runOnJS(onLongPress)();
  }), [onLongPress]);
  const pan = useMemo(() => Gesture.Pan()
    .minDistance(4)
    .onBegin(() => {
      panStartedAt.value = Date.now();
      previousPanX.value = 0;
      previousPanDirection.value = 0;
      panReversals.value = 0;
    })
    .onUpdate((panEvent) => {
      const radius = size * DRAG_RADIUS_RATIO;
      dragX.value = Math.max(-radius, Math.min(radius, panEvent.translationX));
      dragY.value = Math.max(-radius, Math.min(radius, panEvent.translationY));
      gazeX.value = Math.max(-14, Math.min(14, panEvent.x / size * 28 - 14));
      gazeY.value = Math.max(-10, Math.min(10, panEvent.y / size * 20 - 10));
      const delta = panEvent.translationX - previousPanX.value;
      const nextDirection = delta === 0 ? previousPanDirection.value : delta > 0 ? 1 : -1;
      if (previousPanDirection.value !== 0 && nextDirection !== previousPanDirection.value && Math.abs(delta) > 2) panReversals.value += 1;
      previousPanDirection.value = nextDirection;
      previousPanX.value = panEvent.translationX;
    })
    .onEnd((panEvent) => {
      runOnJS(handlePanEnd)(panEvent.translationX, Date.now() - panStartedAt.value, panReversals.value, panEvent.velocityX);
      dragX.value = withSpring(0, { damping: 11, stiffness: 170 });
      dragY.value = withSpring(0, { damping: 11, stiffness: 170 });
      gazeX.value = withTiming(0, { duration: 260 });
      gazeY.value = withTiming(0, { duration: 260 });
    }), [dragX, dragY, gazeX, gazeY, handlePanEnd, panReversals, panStartedAt, previousPanDirection, previousPanX, size]);

  const tapGesture = useMemo(() => Gesture.Exclusive(tripleTap, doubleTap, singleTap), [doubleTap, singleTap, tripleTap]);
  const compactGesture = useMemo(() => Gesture.Race(longPress, tapGesture), [longPress, tapGesture]);
  const fullGesture = useMemo(() => Gesture.Race(longPress, tapGesture, pan), [longPress, pan, tapGesture]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.value }, { translateY: dragY.value }] }));

  const content = budget.detail === "static" || Platform.OS === "web" ? (
    <Image accessibilityIgnoresInvertColors resizeMode="contain" source={placement === "chatAvatar" ? HAKI_ASSETS.portrait : HAKI_ASSETS.static} style={{ height: size, width: size }} />
  ) : (
    <HakiCanvas
      active={shouldAnimate}
      activity={localActivity}
      bondLevel={resolvedBondLevel}
      detail={budget.detail}
      direction={direction}
      event={localEvent}
      eventKey={localEventKey}
      gazeX={gazeX}
      gazeY={gazeY}
      mood={resolvedMood}
      reducedMotion={motionDisabled}
      size={size}
    />
  );

  const frame = (
    <Animated.View accessibilityLabel={`Haki mascot, ${resolvedMood}`} style={[styles.frame, { height: size, width: size }, animatedStyle, style]}>
      {content}
      {badgeVisible ? <MoodBadge mood={resolvedMood} /> : null}
    </Animated.View>
  );

  if (interactionMode === "none") return frame;
  return <GestureDetector gesture={interactionMode === "full" && !motionDisabled ? fullGesture : compactGesture}>{frame}</GestureDetector>;
}

export function HakiPortrait({ size = 34, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return <Image accessibilityIgnoresInvertColors resizeMode="contain" source={HAKI_ASSETS.portrait} style={[{ height: size, width: size }, style]} />;
}

function MoodBadge({ mood }: { mood: HakiMood }) {
  return (
    <View style={[styles.badge, mood === "happy" ? styles.badgeHappy : mood === "concerned" || mood === "annoyed" || mood === "dizzy" ? styles.badgeConcerned : undefined]}>
      <Text style={styles.badgeText}>{moodBadgeForMascotMood(mood)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: "center", justifyContent: "center", overflow: "visible" },
  badge: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    bottom: 0,
    elevation: 3,
    justifyContent: "center",
    minWidth: 56,
    paddingHorizontal: 9,
    paddingVertical: 4,
    position: "absolute",
    right: 0
  },
  badgeHappy: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  badgeConcerned: { backgroundColor: colors.maroonSoft, borderColor: "#E8C7D0" },
  badgeText: { color: colors.ink, fontSize: 10, fontWeight: "900", lineHeight: 13 }
});
