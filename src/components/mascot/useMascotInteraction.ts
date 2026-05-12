import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { Accelerometer } from "expo-sensors";

import {
  DOUBLE_TAP_DELAY_MS,
  GROGGY_DIALOGUE,
  GROGGY_RECOVERY_MS,
  IDLE_TURN_INTERVAL_MS,
  SLEEPING_DIALOGUE,
  TURNAROUND_VISIBLE_MS,
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

const SHAKE_DELTA_THRESHOLD = 1.65;
const SHAKE_MAGNITUDE_THRESHOLD = 2.45;
const SHAKE_COOLDOWN_MS = 4500;

export function useMascotInteraction({ message, onAdminRequest, status }: UseMascotInteractionInput) {
  const [interactiveState, setInteractiveState] = useState<InteractiveMascotState>("awake");
  const [wakeDialogueVisible, setWakeDialogueVisible] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [turnaroundVisible, setTurnaroundVisible] = useState(false);
  const floatY = useRef(new Animated.Value(0)).current;
  const tapScale = useRef(new Animated.Value(1)).current;
  const groggyShake = useRef(new Animated.Value(0)).current;
  // Start at 1 if a message is already present so the dialogue shows immediately on mount.
  // Subsequent message changes still animate in via the spring effect below.
  const bubbleScale = useRef(new Animated.Value(message ? 1 : 0)).current;
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnaroundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeDialogueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groggyRecoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAccelerationRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const lastShakeAtRef = useRef(0);
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
      if (turnaroundTimer.current) {
        clearTimeout(turnaroundTimer.current);
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

  const hideTurnaroundLater = useCallback(() => {
    if (turnaroundTimer.current) {
      clearTimeout(turnaroundTimer.current);
    }

    turnaroundTimer.current = setTimeout(() => {
      setTurnaroundVisible(false);
    }, TURNAROUND_VISIBLE_MS);
  }, []);

  const runIdleTurnaround = useCallback(() => {
    if (interactiveState !== "awake") {
      return;
    }

    setWakeDialogueVisible(false);
    setTurnaroundVisible(true);
    runTapBounce();
    hideTurnaroundLater();
  }, [hideTurnaroundLater, interactiveState, runTapBounce]);

  const clearWakeDialogueLater = useCallback(() => {
    if (wakeDialogueTimer.current) {
      clearTimeout(wakeDialogueTimer.current);
    }

    wakeDialogueTimer.current = setTimeout(() => {
      setWakeDialogueVisible(false);
    }, WAKE_DIALOGUE_VISIBLE_MS);
  }, []);

  const triggerGroggy = useCallback(() => {
    setTurnaroundVisible(false);
    setWakeDialogueVisible(false);
    setInteractiveState("groggy");
    runTapBounce();

    if (groggyRecoveryTimer.current) {
      clearTimeout(groggyRecoveryTimer.current);
    }

    groggyRecoveryTimer.current = setTimeout(() => {
      setInteractiveState("awake");
    }, GROGGY_RECOVERY_MS);
  }, [runTapBounce]);

  useEffect(() => {
    if (interactiveState !== "awake") {
      return;
    }

    const intervalId = setInterval(runIdleTurnaround, IDLE_TURN_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [interactiveState, runIdleTurnaround]);

  useEffect(() => {
    let active = true;
    let subscription: ReturnType<typeof Accelerometer.addListener> | null = null;

    void Accelerometer.isAvailableAsync()
      .then((available) => {
        if (!active || !available) {
          return;
        }

        Accelerometer.setUpdateInterval(120);
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          const last = lastAccelerationRef.current;
          lastAccelerationRef.current = { x, y, z };
          if (!last) {
            return;
          }

          const delta = Math.sqrt((x - last.x) ** 2 + (y - last.y) ** 2 + (z - last.z) ** 2);
          const magnitude = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
          const now = Date.now();
          const shookHard = delta > SHAKE_DELTA_THRESHOLD || magnitude > SHAKE_MAGNITUDE_THRESHOLD;
          if (shookHard && now - lastShakeAtRef.current > SHAKE_COOLDOWN_MS) {
            lastShakeAtRef.current = now;
            triggerGroggy();
          }
        });
      })
      .catch(() => {
        // Device shake is an optional mascot gesture. If the sensor is absent,
        // Haki still works through taps and chat.
      });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [triggerGroggy]);

  const handleSingleTap = useCallback(() => {
    runIdleTurnaround();
  }, [runIdleTurnaround]);

  const handleDoubleTap = useCallback(() => {
    runTapBounce();
    setTurnaroundVisible(false);

    if (interactiveState === "sleeping") {
      setInteractiveState("awake");
      setWakeDialogueVisible(true);
      clearWakeDialogueLater();
      return;
    }

    setWakeDialogueVisible(false);
    setInteractiveState("sleeping");
  }, [clearWakeDialogueLater, interactiveState, runTapBounce]);

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
    showAdminModal,
    turnaroundVisible
  };
}
