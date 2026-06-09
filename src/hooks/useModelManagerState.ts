import { useCallback, useEffect, useRef, useState } from "react";

import {
  activateChatModel,
  cancelGgufDownload,
  discardPausedModelDownload,
  downloadCatalogModel,
  getChatModelLibrary,
  getCompatibleModelCatalog,
  getImportedModelStatus,
  pickAndImportGgufModel,
  recoverInterruptedModelOperation,
  removeChatModel,
  removeImportedModel,
  resumePausedModelDownload,
  subscribeModelOperation,
  type ChatModelLibrary,
  type CompatibleModelCatalog,
  type InstalledChatModel,
  type ImportedModelStatus,
  type ModelOperationState
} from "@/ai/localModelManager";
import { refreshDeviceCapabilities } from "@/services/modeSelectionService";

export type ModelManagerCatalogModel = CompatibleModelCatalog["compatibleModels"][number];
export type ModelManagerInstalledChatModel = InstalledChatModel;

function operationBusy(operation: ModelOperationState | null): boolean {
  return Boolean(operation && !["paused", "completed", "failed", "canceled"].includes(operation.phase));
}

export function useModelManagerState() {
  const [library, setLibrary] = useState<ChatModelLibrary | null>(null);
  const [embeddingStatus, setEmbeddingStatus] = useState<ImportedModelStatus | null>(null);
  const [catalog, setCatalog] = useState<CompatibleModelCatalog | null>(null);
  const [operation, setOperation] = useState<ModelOperationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const terminalOperationRef = useRef<string | null>(null);

  const load = useCallback(async (refreshMode = false) => {
    setError(null);
    try {
      if (refreshMode) await refreshDeviceCapabilities();
      const [nextLibrary, nextCatalog, nextEmbeddingStatus] = await Promise.all([
        getChatModelLibrary(),
        getCompatibleModelCatalog(),
        getImportedModelStatus("embedding")
      ]);
      setLibrary(nextLibrary);
      setCatalog(nextCatalog);
      setEmbeddingStatus(nextEmbeddingStatus);
    } catch {
      setError("Could not load chat options. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void recoverInterruptedModelOperation().then(setOperation);
    void load();
    return subscribeModelOperation((next) => {
      setOperation(next);
      if (next && ["completed", "failed", "canceled"].includes(next.phase) && terminalOperationRef.current !== next.operationId) {
        terminalOperationRef.current = next.operationId;
        void load(next.phase === "completed");
      }
    });
  }, [load]);

  const runAction = useCallback(async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await load(true);
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : "That change did not finish. Please try again.";
      await load();
      setError(message);
    }
  }, [load]);

  const activateModel = useCallback((modelId: string) => {
    return runAction(() => activateChatModel(modelId));
  }, [runAction]);

  const cancelDownload = useCallback(() => {
    return cancelGgufDownload();
  }, []);

  const discardPausedDownload = useCallback(() => {
    return runAction(discardPausedModelDownload);
  }, [runAction]);

  const downloadModel = useCallback((model: ModelManagerCatalogModel) => {
    return runAction(() => downloadCatalogModel(model));
  }, [runAction]);

  const importEmbeddingModel = useCallback(() => {
    return runAction(() => pickAndImportGgufModel("embedding"));
  }, [runAction]);

  const removeEmbeddingModel = useCallback(() => {
    return runAction(() => removeImportedModel("embedding"));
  }, [runAction]);

  const removeModel = useCallback((modelId: string) => {
    return runAction(() => removeChatModel(modelId));
  }, [runAction]);

  const resumePausedDownload = useCallback(() => {
    return runAction(resumePausedModelDownload);
  }, [runAction]);

  const activeModel = library?.installedModels.find((model) => model.id === library.activeModelId) ?? null;

  return {
    activateModel,
    activeModel,
    busy: operationBusy(operation),
    cancelDownload,
    catalog,
    discardPausedDownload,
    downloadModel,
    embeddingStatus,
    error,
    importEmbeddingModel,
    library,
    load,
    loading,
    operation,
    removeEmbeddingModel,
    removeModel,
    resumePausedDownload,
    runAction
  };
}
