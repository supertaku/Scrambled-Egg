import type { ModelOperationPhase, ModelOperationState } from "./types";
import { logger } from "@/utils/logger";

export type OperationListener = (state: ModelOperationState | null) => void;

let currentOperation: ModelOperationState | null = null;
const operationListeners = new Set<OperationListener>();

function now(): string {
  return new Date().toISOString();
}

function normalizedId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "model";
}

export function emitOperation(state: ModelOperationState | null): void {
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

export function patchOperation(patch: Partial<ModelOperationState>): ModelOperationState {
  if (!currentOperation) throw new Error("No active model operation.");
  const next = { ...currentOperation, ...patch, updatedAt: now() };
  emitOperation(next);
  return next;
}

export function isBusyPhase(phase: ModelOperationPhase): boolean {
  return !["paused", "completed", "failed", "canceled"].includes(phase);
}

export function operationFor(
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

export function getModelOperation(): ModelOperationState | null {
  return currentOperation;
}

export function subscribeModelOperation(listener: OperationListener): () => void {
  operationListeners.add(listener);
  listener(currentOperation);
  return () => operationListeners.delete(listener);
}
