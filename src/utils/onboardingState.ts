export interface OnboardingGateInput {
  complete: boolean;
  started: boolean;
  hasProfileDetails: boolean;
}

export function requiresFirstRunOnboarding({
  complete,
  started,
  hasProfileDetails
}: OnboardingGateInput): boolean {
  if (complete) {
    return false;
  }

  if (started) {
    return true;
  }

  return !hasProfileDetails;
}

export function clampOnboardingStep(value: number, stepCount: number): number {
  if (!Number.isFinite(value) || stepCount <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(stepCount - 1, Math.floor(value)));
}
