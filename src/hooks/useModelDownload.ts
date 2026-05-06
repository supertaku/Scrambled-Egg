import { useState, useEffect, useCallback } from "react";
import { modelManager, type DownloadProgress } from "@/ai/localModelManager";
import { getDeviceCapabilityReport } from "@/services/modeSelectionService";
import type { LocalModelTier } from "@/ai/LocalAIProvider";
import { logger } from "@/utils/logger";

export function useModelDownload() {
  const [recommendedTier, setRecommendedTier] = useState<LocalModelTier>("unknown");
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const report = await getDeviceCapabilityReport();
      const tier = report.selectedMode.capabilities.recommendedModelTier || "tiny";
      setRecommendedTier(tier);
      
      const downloaded = await modelManager.isTierDownloaded(tier);
      setIsDownloaded(downloaded);
    } catch (err) {
      logger.ai.error("Failed to check model download status", { err });
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const startDownload = async (tierOverride?: LocalModelTier) => {
    const tier = tierOverride || recommendedTier;
    if (tier === "unknown") {
        setError("Cannot download an unknown model tier.");
        return;
    }

    setIsDownloading(true);
    setError(null);
    try {
      await modelManager.downloadTier(tier, (p) => {
        setProgress(p);
      });
      setIsDownloaded(true);
      setIsDownloading(false);
      setProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
      setIsDownloading(false);
    }
  };

  const deleteModel = async (tierOverride?: LocalModelTier) => {
    const tier = tierOverride || recommendedTier;
    try {
        await modelManager.deleteTier(tier);
        setIsDownloaded(false);
    } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return {
    recommendedTier,
    isDownloaded,
    isDownloading,
    progress,
    error,
    startDownload,
    deleteModel,
    refreshStatus: checkStatus
  };
}
