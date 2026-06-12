import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { logger } from "@/utils/logger";

const HAPTICS_ENABLED_KEY = "haki.hapticsEnabled";

let hapticsEnabled = true;
let loaded = false;

async function loadPreference(): Promise<void> {
  if (loaded) {
    return;
  }
  loaded = true;
  try {
    const stored = await AsyncStorage.getItem(HAPTICS_ENABLED_KEY);
    if (stored !== null) {
      hapticsEnabled = stored === "true";
    }
  } catch (error) {
    logger.ui.warn("Could not load haptics preference; defaulting to on.", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

void loadPreference();

export function isHapticsEnabled(): boolean {
  return hapticsEnabled;
}

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
  void AsyncStorage.setItem(HAPTICS_ENABLED_KEY, String(enabled)).catch((error) => {
    logger.ui.warn("Could not persist haptics preference.", {
      error: error instanceof Error ? error.message : String(error)
    });
  });
}

function fireAndForget(promise: Promise<unknown>): void {
  void promise.catch(() => {
    // Haptics are decorative; a missing vibrator or simulator never breaks flow.
  });
}

/** Light tick for taps and small selections. */
export function hapticTap(): void {
  if (!hapticsEnabled) {
    return;
  }
  fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Positive confirmation (answer complete, model ready, celebration). */
export function hapticSuccess(): void {
  if (!hapticsEnabled) {
    return;
  }
  fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Caution feedback (errors, shake-to-dizzy). */
export function hapticWarning(): void {
  if (!hapticsEnabled) {
    return;
  }
  fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
