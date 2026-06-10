import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { Accelerometer } from "expo-sensors";

import {
  GROGGY_DIALOGUE,
  GROGGY_RECOVERY_MS,
  SLEEPING_DIALOGUE,
  WAKE_DIALOGUE,
  WAKE_DIALOGUE_VISIBLE_MS,
  type InteractiveMascotState,
  type MascotStatus
} from "./mascotConfig";
import type { HakiAnimationEvent, HakiBondEvent, HakiInteractionEvent } from "./hakiMascotState";

interface UseMascotInteractionInput {
  interactionVisible: boolean;
  message: string | undefined;
  onBondEvent?: (event: HakiBondEvent) => void;
  onAdminRequest: (() => void) | undefined;
  status: MascotStatus;
}

const SHAKE_DELTA_THRESHOLD = 1.65;
const SHAKE_MAGNITUDE_THRESHOLD = 2.45;
const SHAKE_COOLDOWN_MS = 4500;

export function useMascotInteraction({ interactionVisible, message, onAdminRequest, onBondEvent, status }: UseMascotInteractionInput) {
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [interactiveState, setInteractiveState] = useState<InteractiveMascotState>("awake");
  const [mascotEvent, setMascotEvent] = useState<HakiAnimationEvent | undefined>();
  const [mascotEventKey, setMascotEventKey] = useState(0);
  const [wakeDialogueVisible, setWakeDialogueVisible] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const wakeDialogueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groggyRecoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAccelerationRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const lastShakeAtRef = useRef(0);

  const resolvedStatus: MascotStatus = interactiveState === "sleeping" ? "sleepy" : interactiveState === "groggy" ? "groggy" : status;
  const resolvedMessage = interactiveState === "sleeping"
    ? SLEEPING_DIALOGUE
    : interactiveState === "groggy"
      ? GROGGY_DIALOGUE
      : wakeDialogueVisible
        ? WAKE_DIALOGUE
        : message;

  const emitMascotEvent = useCallback((event: HakiAnimationEvent) => {
    setMascotEvent(event);
    setMascotEventKey((key) => key + 1);
  }, []);

  const clearWakeDialogueLater = useCallback(() => {
    if (wakeDialogueTimer.current) clearTimeout(wakeDialogueTimer.current);
    wakeDialogueTimer.current = setTimeout(() => setWakeDialogueVisible(false), WAKE_DIALOGUE_VISIBLE_MS);
  }, []);

  const triggerGroggy = useCallback(() => {
    setWakeDialogueVisible(false);
    setInteractiveState("groggy");
    onBondEvent?.("groggy");
    emitMascotEvent("groggy");
    if (groggyRecoveryTimer.current) clearTimeout(groggyRecoveryTimer.current);
    groggyRecoveryTimer.current = setTimeout(() => setInteractiveState("awake"), GROGGY_RECOVERY_MS);
  }, [emitMascotEvent, onBondEvent]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => setAppActive(nextState === "active"));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let mounted = true;
    let subscription: ReturnType<typeof Accelerometer.addListener> | null = null;
    if (!appActive || !interactionVisible) {
      lastAccelerationRef.current = null;
      return undefined;
    }
    void Accelerometer.isAvailableAsync().then((available) => {
      if (!mounted || !available) return;
      Accelerometer.setUpdateInterval(120);
      subscription = Accelerometer.addListener(({ x, y, z }) => {
        const last = lastAccelerationRef.current;
        lastAccelerationRef.current = { x, y, z };
        if (!last) return;
        const delta = Math.sqrt((x - last.x) ** 2 + (y - last.y) ** 2 + (z - last.z) ** 2);
        const magnitude = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
        const now = Date.now();
        if ((delta > SHAKE_DELTA_THRESHOLD || magnitude > SHAKE_MAGNITUDE_THRESHOLD) && now - lastShakeAtRef.current > SHAKE_COOLDOWN_MS) {
          lastShakeAtRef.current = now;
          triggerGroggy();
        }
      });
    }).catch(() => undefined);
    return () => {
      mounted = false;
      lastAccelerationRef.current = null;
      subscription?.remove();
    };
  }, [appActive, interactionVisible, triggerGroggy]);

  useEffect(() => () => {
    if (wakeDialogueTimer.current) clearTimeout(wakeDialogueTimer.current);
    if (groggyRecoveryTimer.current) clearTimeout(groggyRecoveryTimer.current);
  }, []);

  const handleMascotInteraction = useCallback((event: HakiInteractionEvent) => {
    if (interactiveState === "groggy") return;
    setWakeDialogueVisible(false);
    if (event === "doubleTap") {
      if (interactiveState === "sleeping") {
        setInteractiveState("awake");
        onBondEvent?.("wake");
        emitMascotEvent("wake");
        setWakeDialogueVisible(true);
        clearWakeDialogueLater();
      } else {
        setInteractiveState("sleeping");
        onBondEvent?.("sleep");
      }
      return;
    }
    const bondEvent: HakiBondEvent | undefined = event === "tap"
      ? "tap"
      : event === "pet"
        ? "pet"
        : event === "swipe" || event === "tripleTap"
          ? "play"
          : event === "pokeBurst"
            ? "pokeBurst"
            : undefined;
    if (bondEvent) onBondEvent?.(bondEvent);
    if (event !== "tap" && event !== "longPress" && event !== "drag") emitMascotEvent(event);
  }, [clearWakeDialogueLater, emitMascotEvent, interactiveState, onBondEvent]);

  const handleMascotLongPress = useCallback(() => {
    if (interactiveState === "groggy") return;
    if (onAdminRequest) onAdminRequest();
    else setShowAdminModal(true);
  }, [interactiveState, onAdminRequest]);

  return {
    closeAdminModal: () => setShowAdminModal(false),
    handleMascotInteraction,
    handleMascotLongPress,
    isGroggy: interactiveState === "groggy",
    mascotEvent,
    mascotEventKey,
    resolvedMessage,
    resolvedStatus,
    showAdminModal
  };
}
