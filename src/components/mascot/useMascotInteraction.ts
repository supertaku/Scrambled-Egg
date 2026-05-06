import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

import {
  DOUBLE_TAP_DELAY_MS,
  GROGGY_DIALOGUE,
  GROGGY_RECOVERY_MS,
  SLEEPING_DIALOGUE,
  WAKE_DIALOGUE,
  WAKE_DIALOGUE_VISIBLE_MS,
  type InteractiveMascotState,
  type MascotStatus
} from "./mascotConfig";

interface UseMascotInteractionInput {
  message: string | undefined;
  onAdminRequest: (() => void) | undefined;
  status: MascotStatus;
}

export function useMascotInteraction({ message, onAdminRequest, status }: UseMascotInteractionInput) {
  const [interactiveState, setInteractiveState] = useState<InteractiveMascotState>("awake");
  const [wakeDialogueVisible, setWakeDialogueVisible] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const floatY = useRef(new Animated.Value(0)).current;
  const tapScale = useRef(new Animated.Value(1)).current;
  const groggyShake = useRef(new Animated.Value(0)).current;
  // Start at 1 if a message is already present so the dialogue shows immediately on mount.
  // Subsequent message changes still animate in via the spring effect below.
  const bubbleScale = useRef(new Animated.Value(message ? 1 : 0)).current;
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeDialogueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groggyRecoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const resolvedStatus: MascotStatus =
    interactiveState === "sleeping" ? "sleepy" : interactiveState === "groggy" ? "groggy" : status;
  const resolvedMessage =
    interactiveState === "sleeping"
      ? SLEEPING_DIALOGUE
      : interactiveState === "groggy"
        ? GROGGY_DIALOGUE
        : wakeDialogueVisible
          ? WAKE_DIALOGUE
          : message;
  const isGroggy = interactiveState === "groggy";
  const mascotRotation = groggyShake.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-5deg", "5deg"]
  });

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -4,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );
    floatLoop.start();
    return () => floatLoop.stop();
  }, [floatY]);

  useEffect(() => {
    if (resolvedMessage) {
      bubbleScale.setValue(0);
      Animated.spring(bubbleScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true
      }).start();
    } else {
      Animated.timing(bubbleScale, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start();
    }
  }, [resolvedMessage, bubbleScale]);

  useEffect(() => {
    if (!isGroggy) {
      groggyShake.setValue(0);
      return;
    }

    const shakeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(groggyShake, {
          toValue: 1,
          duration: 90,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(groggyShake, {
          toValue: -1,
          duration: 90,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(groggyShake, {
          toValue: 0,
          duration: 120,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true
        }),
        Animated.delay(850)
      ])
    );
    shakeLoop.start();
    return () => shakeLoop.stop();
  }, [groggyShake, isGroggy]);

  useEffect(() => {
    return () => {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
      }
      if (wakeDialogueTimer.current) {
        clearTimeout(wakeDialogueTimer.current);
      }
      if (groggyRecoveryTimer.current) {
        clearTimeout(groggyRecoveryTimer.current);
      }
    };
  }, []);

  const runTapBounce = useCallback(() => {
    tapScale.setValue(0.96);
    Animated.spring(tapScale, {
      toValue: 1,
      friction: 4,
      tension: 180,
      useNativeDriver: true
    }).start();
  }, [tapScale]);

  const clearWakeDialogueLater = useCallback(() => {
    if (wakeDialogueTimer.current) {
      clearTimeout(wakeDialogueTimer.current);
    }

    wakeDialogueTimer.current = setTimeout(() => {
      setWakeDialogueVisible(false);
    }, WAKE_DIALOGUE_VISIBLE_MS);
  }, []);

  const handleSingleTap = useCallback(() => {
    runTapBounce();

    if (interactiveState === "sleeping") {
      setInteractiveState("awake");
      setWakeDialogueVisible(true);
      clearWakeDialogueLater();
      return;
    }

    setWakeDialogueVisible(false);
    setInteractiveState("sleeping");
  }, [clearWakeDialogueLater, interactiveState, runTapBounce]);

  const handleDoubleTap = useCallback(() => {
    runTapBounce();
    setWakeDialogueVisible(false);
    setInteractiveState("groggy");

    if (groggyRecoveryTimer.current) {
      clearTimeout(groggyRecoveryTimer.current);
    }

    groggyRecoveryTimer.current = setTimeout(() => {
      setInteractiveState("awake");
    }, GROGGY_RECOVERY_MS);
  }, [runTapBounce]);

  const handleMascotPress = useCallback(() => {
    if (isGroggy) {
      return;
    }

    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }

    if (singleTapTimer.current) {
      clearTimeout(singleTapTimer.current);
      singleTapTimer.current = null;
      handleDoubleTap();
      return;
    }

    singleTapTimer.current = setTimeout(() => {
      singleTapTimer.current = null;
      handleSingleTap();
    }, DOUBLE_TAP_DELAY_MS);
  }, [handleDoubleTap, handleSingleTap, isGroggy]);

  const handleMascotLongPress = useCallback(() => {
    if (isGroggy) {
      return;
    }

    longPressTriggered.current = true;
    if (singleTapTimer.current) {
      clearTimeout(singleTapTimer.current);
      singleTapTimer.current = null;
    }

    if (onAdminRequest) {
      onAdminRequest();
    } else {
      setShowAdminModal(true);
    }
  }, [isGroggy, onAdminRequest]);

  const closeAdminModal = useCallback(() => {
    setShowAdminModal(false);
  }, []);

  const imageTransform = useMemo(
    () => [{ translateY: floatY }, { scale: tapScale }, { rotate: mascotRotation }],
    [floatY, mascotRotation, tapScale]
  );

  return {
    bubbleScale,
    closeAdminModal,
    handleMascotLongPress,
    handleMascotPress,
    imageTransform,
    isGroggy,
    resolvedMessage,
    resolvedStatus,
    showAdminModal
  };
}
