import { logger } from "@/utils/logger";

export type ModelOperationPhase =
  | "queued"
  | "downloading"
  | "paused"
  | "verifying"
  | "validating"
  | "optimizing"
  | "waiting_for_chat"
  | "activating"
  | "removing"
  | "completed"
  | "failed"
  | "canceled";

export interface ModelOperationState {
  operationId: string;
  phase: ModelOperationPhase;
  modelId: string;
  modelName: string;
  catalogId: string | null;
  progress: number | null;
  bytesWritten: number;
  totalBytes: number | null;
  startedAt: string;
  updatedAt: string;
  error: string | null;
  resumable: boolean;
}

type OperationListener = (state: ModelOperationState | null) => void;

function normalizedId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "model";
}

export function createModelOperationCoordinator(now = () => new Date().toISOString()) {
  let currentOperation: ModelOperationState | null = null;
  let activeInferenceCount = 0;
  let mutationInProgress = false;
  const operationListeners = new Set<OperationListener>();
  const inferenceIdleWaiters = new Set<() => void>();
  const mutationWaiters = new Set<() => void>();

  function emit(state: ModelOperationState | null): void {
    const previousPhase = currentOperation?.phase ?? null;
    currentOperation = state;
    if (state && state.phase !== previousPhase) {
      logger.ai.log("Managed model operation phase changed.", {
        modelId: state.modelId,
        operationId: state.operationId,
        phase: state.phase
      });
    }
    operationListeners.forEach((listener) => listener(state));
  }

  function patch(update: Partial<ModelOperationState>): ModelOperationState {
    if (!currentOperation) throw new Error("No active model operation.");
    const next = { ...currentOperation, ...update, updatedAt: now() };
    emit(next);
    return next;
  }

  function isBusyPhase(phase: ModelOperationPhase): boolean {
    return !["paused", "completed", "failed", "canceled"].includes(phase);
  }

  function assertNoBusyOperation(): void {
    if (currentOperation?.phase === "paused") {
      throw new Error("Resume or discard the paused model download before starting another operation.");
    }
    if (currentOperation && isBusyPhase(currentOperation.phase)) {
      throw new Error("Haki is already preparing a model. Wait for that operation to finish first.");
    }
  }

  function operationFor(
    modelId: string,
    modelName: string,
    catalogId: string | null,
    phase: ModelOperationPhase
  ): ModelOperationState {
    const timestamp = now();
    return {
      operationId: `${normalizedId(modelId)}-${Date.now()}`,
      phase,
      modelId,
      modelName,
      catalogId,
      progress: null,
      bytesWritten: 0,
      totalBytes: null,
      startedAt: timestamp,
      updatedAt: timestamp,
      error: null,
      resumable: false
    };
  }

  function signalInferenceIdle(): void {
    if (activeInferenceCount !== 0) return;
    inferenceIdleWaiters.forEach((resolve) => resolve());
    inferenceIdleWaiters.clear();
  }

  async function startMutation(operationId: string): Promise<void> {
    mutationInProgress = true;
    if (activeInferenceCount > 0 && currentOperation?.operationId === operationId) {
      patch({ phase: "waiting_for_chat" });
    }
    if (activeInferenceCount > 0) {
      await new Promise<void>((resolve) => inferenceIdleWaiters.add(resolve));
    }
  }

  function endMutation(): void {
    mutationInProgress = false;
    mutationWaiters.forEach((resolve) => resolve());
    mutationWaiters.clear();
  }

  async function withInferenceLease<T>(task: () => Promise<T>): Promise<T> {
    while (mutationInProgress) {
      await new Promise<void>((resolve) => mutationWaiters.add(resolve));
    }
    activeInferenceCount += 1;
    try {
      return await task();
    } finally {
      activeInferenceCount -= 1;
      signalInferenceIdle();
    }
  }

  return {
    assertNoBusyOperation,
    emit,
    endMutation,
    get: () => currentOperation,
    isBusy: () => activeInferenceCount > 0 || mutationInProgress,
    isBusyPhase,
    operationFor,
    patch,
    startMutation,
    subscribe(listener: OperationListener) {
      operationListeners.add(listener);
      listener(currentOperation);
      return () => {
        operationListeners.delete(listener);
      };
    },
    withInferenceLease
  };
}

const coordinator = createModelOperationCoordinator();

export const assertNoBusyModelOperation = coordinator.assertNoBusyOperation;
export const emitModelOperation = coordinator.emit;
export const endModelMutation = coordinator.endMutation;
export const getModelOperation = coordinator.get;
export const isBusyModelOperationPhase = coordinator.isBusyPhase;
export const isLocalModelInferenceBusy = coordinator.isBusy;
export const newModelOperation = coordinator.operationFor;
export const patchModelOperation = coordinator.patch;
export const startModelMutation = coordinator.startMutation;
export const subscribeModelOperation = coordinator.subscribe;
export const withLocalModelInferenceLease = coordinator.withInferenceLease;
