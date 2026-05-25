import AsyncStorage from "@react-native-async-storage/async-storage";

import { getStudentProfile, hasStudentProfileDetails } from "./studentProfileService";
import { STORAGE_KEYS } from "@/utils/constants";
import { clampOnboardingStep, requiresFirstRunOnboarding } from "@/utils/onboardingState";

export const ONBOARDING_STEP_COUNT = 6;
const completionListeners = new Set<() => void>();

export async function shouldPresentFirstRunOnboarding(): Promise<boolean> {
  const [completeValue, startedValue, profile] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE),
    AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_STARTED),
    getStudentProfile()
  ]);

  const complete = completeValue === "true";
  const started = startedValue === "true";
  const hasProfileDetails = hasStudentProfileDetails(profile);
  const shouldPresent = requiresFirstRunOnboarding({ complete, started, hasProfileDetails });

  if (!shouldPresent && !complete && hasProfileDetails && !started) {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, "true");
  }

  return shouldPresent;
}

export async function markOnboardingStarted(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_STARTED, "true");
}

export async function getOnboardingStep(): Promise<number> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_STEP);
  return clampOnboardingStep(Number(raw ?? 0), ONBOARDING_STEP_COUNT);
}

export async function saveOnboardingStep(step: number): Promise<void> {
  const normalized = clampOnboardingStep(step, ONBOARDING_STEP_COUNT);
  await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_STEP, String(normalized));
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.ONBOARDING_COMPLETE, "true"],
    [STORAGE_KEYS.ONBOARDING_STARTED, "false"]
  ]);
  await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_STEP);
  completionListeners.forEach((listener) => listener());
}

export function subscribeOnboardingCompleted(listener: () => void): () => void {
  completionListeners.add(listener);
  return () => {
    completionListeners.delete(listener);
  };
}
