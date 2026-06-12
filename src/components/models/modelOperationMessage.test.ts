import { describe, expect, it } from "vitest";

import type { ModelOperationState } from "@/ai/localModelManager";
import { messageForModelOperation } from "@/components/models/modelOperationMessage";

function operation(
  phase: ModelOperationState["phase"],
  error: string | null = null
): ModelOperationState {
  return {
    operationId: "operation-1",
    phase,
    modelId: "llama-3.2-1b",
    modelName: "Llama 3.2 1B",
    catalogId: "llama-3.2-1b",
    progress: null,
    bytesWritten: 0,
    totalBytes: null,
    startedAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    error,
    resumable: false
  };
}

describe("messageForModelOperation", () => {
  it("shows the actionable error for a failed model operation", () => {
    expect(messageForModelOperation(
      operation("failed", "The native runtime could not initialize this model."),
      null
    )).toBe("The native runtime could not initialize this model.");
  });

  it("shows the actionable error when a completed download could not become usable", () => {
    expect(messageForModelOperation(
      operation("completed", "This model requires more free memory."),
      null
    )).toBe("This model requires more free memory.");
  });

  it("keeps the normal success message for a completed usable model", () => {
    expect(messageForModelOperation(operation("completed"), "Llama 3.2 1B"))
      .toBe("Ready. Your local AI option is set up.");
  });
});
