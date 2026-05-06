import * as FileSystem from "expo-file-system";
import { getExecuTorchNativeModule } from "./nativeModules";
import { MODEL_TIER_CONFIGS, getHFDownloadUrl } from "./modelDownloadConfig";
import type { LocalModelTier } from "./LocalAIProvider";
import { logger } from "@/utils/logger";

const MODELS_DIR = `${FileSystem.documentDirectory}models/`;

export interface DownloadProgress {
  tier: LocalModelTier;
  currentFile: string;
  fileProgress: number; // 0 to 1
  overallProgress: number; // 0 to 1
  totalBytesEstimate: number;
}

export class LocalModelManager {
  /**
   * Checks if all files for a specific tier are present in internal storage.
   */
  async isTierDownloaded(tier: LocalModelTier): Promise<boolean> {
    const nativeModule = getExecuTorchNativeModule();
    if (nativeModule?.isModelTierDownloaded) {
      return await nativeModule.isModelTierDownloaded(tier);
    }

    // JS Fallback check
    const config = MODEL_TIER_CONFIGS[tier];
    if (!config) return false;

    try {
      for (const file of config.files) {
        const fileUri = `${MODELS_DIR}${tier}/${file}`;
        const info = await FileSystem.getInfoAsync(fileUri);
        if (!info.exists) return false;
      }
      return true;
    } catch (error) {
      logger.ai.warn(`Error checking model tier status: ${tier}`, { error });
      return false;
    }
  }

  /**
   * Downloads all files for a specific tier.
   */
  async downloadTier(
    tier: LocalModelTier,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    const config = MODEL_TIER_CONFIGS[tier];
    if (!config) throw new Error(`No configuration found for model tier: ${tier}`);

    const tierDir = `${MODELS_DIR}${tier}/`;
    await FileSystem.makeDirectoryAsync(tierDir, { intermediates: true });

    let filesCompleted = 0;
    for (const file of config.files) {
      const fileUri = `${tierDir}${file}`;
      const downloadUrl = getHFDownloadUrl(config.repo, config.revision, file);

      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        fileUri,
        {},
        (progress) => {
          const fileProgress = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
          const overallProgress = (filesCompleted + fileProgress) / config.files.length;
          
          onProgress?.({
            tier,
            currentFile: file,
            fileProgress,
            overallProgress,
            totalBytesEstimate: progress.totalBytesExpectedToWrite * config.files.length // Very rough estimate
          });
        }
      );

      try {
        const result = await downloadResumable.downloadAsync();
        if (!result) throw new Error(`Download failed for ${file}`);
        filesCompleted++;
      } catch (error) {
        logger.ai.error(`Failed to download model file: ${file}`, { error });
        throw error;
      }
    }

    logger.ai.log(`Successfully downloaded all files for tier: ${tier}`);
  }

  /**
   * Deletes a model tier from storage to free up space.
   */
  async deleteTier(tier: LocalModelTier): Promise<void> {
    const tierDir = `${MODELS_DIR}${tier}/`;
    try {
      await FileSystem.deleteAsync(tierDir, { idempotent: true });
      logger.ai.log(`Deleted model tier: ${tier}`);
    } catch (error) {
      logger.ai.error(`Failed to delete model tier: ${tier}`, { error });
      throw error;
    }
  }

  /**
   * Gets the total size of all downloaded models.
   */
  async getTotalDownloadedSizeMB(): Promise<number> {
    try {
      const info = await FileSystem.getInfoAsync(MODELS_DIR);
      if (!info.exists) return 0;
      
      // Note: getInfoAsync on a directory doesn't always give recursive size.
      // A more accurate way would be to iterate through all files.
      let totalSize = 0;
      for (const tier of Object.keys(MODEL_TIER_CONFIGS)) {
        const tierDir = `${MODELS_DIR}${tier}/`;
        const dirInfo = await FileSystem.getInfoAsync(tierDir);
        if (dirInfo.exists) {
            // Need to check files individually for accurate size
            const config = MODEL_TIER_CONFIGS[tier];
            for (const file of config.files) {
                const fileInfo = await FileSystem.getInfoAsync(`${tierDir}${file}`);
                if (fileInfo.exists && !fileInfo.isDirectory) {
                    totalSize += fileInfo.size;
                }
            }
        }
      }
      return totalSize / (1024 * 1024);
    } catch {
      return 0;
    }
  }
}

export const modelManager = new LocalModelManager();
