import type { DownloadPauseState } from "expo-file-system/legacy";

import type { LocalModelTier } from "../LocalAIProvider";
import type { DeviceHardwareProfile, ImportedModelStatus } from "../localModelMetadata";
import type { GgufDownloadConfig, RuntimeAvailability } from "../modelDownloadConfig";

export interface GgufDownloadProgress {
  bytesWritten: number;
  totalBytes: number | null;
  progress: number;
}

export interface PickAndImportModelResult {
  canceled: boolean;
  status?: ImportedModelStatus;
}

export type InstalledModelSource = "downloaded" | "legacy-bundled" | "admin-imported";

export interface InstalledChatModel {
  id: string;
  catalogId: string | null;
  source: InstalledModelSource;
  fileUri: string;
  manifestUri: string;
  modelName: string;
  modelTier: LocalModelTier;
  sizeBytes: number;
  verifiedSha256: string | null;
  installedAt: string;
  rejectionReasons: string[];
}

export interface ChatModelLibrary {
  version: 2;
  activeModelId: string | null;
  installedModels: InstalledChatModel[];
}

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

export interface CompatibleModelCatalog {
  compatibleModels: GgufDownloadConfig[];
  hiddenModels: GgufDownloadConfig[];
  hardware: DeviceHardwareProfile;
  maximumTier: LocalModelTier;
  runtimeAvailability: RuntimeAvailability;
  unavailableReason: string | null;
}

export interface StagedDownloadRecord {
  version: 1;
  operation: ModelOperationState;
  model: GgufDownloadConfig;
  fileUri: string;
  pauseState?: DownloadPauseState;
  nativeTransfer?: {
    downloadId: number;
    platform: "android" | "ios";
  };
}
