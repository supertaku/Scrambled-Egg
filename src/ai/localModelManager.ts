import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import { createDownloadResumable } from "expo-file-system/legacy";
import { NativeModules } from "react-native";

import { getDeviceHardwareProfile } from "./deviceHardwareProfile";
import type { LocalModelTier } from "./LocalAIProvider";
import type {
  DeviceHardwareProfile,
  ImportedModelStatus,
  LocalModelManifest,
  LocalModelRole
} from "./localModelMetadata";
import {
  buildLocalModelManifest,
  canonicalModelFileName,
  deriveModelMetadata,
  manifestFileName
} from "./localModelMetadata";
import { loadLlamaRn } from "./llamaRnRuntime";
import { logger } from "@/utils/logger";
import { normalizeSha256Hex, sha256HexFromFileLike } from "@/utils/fileSha256";

export type {
  DeviceHardwareProfile,
  ImportedModelStatus,
  LocalModelManifest,
  LocalModelRole
} from "./localModelMetadata";

const MODELS_DIR = new Directory(Paths.document, "models");
const TEMP_DOWNLOAD_SUFFIX = ".partial.gguf";
const MAX_SAFE_INLINE_HASH_BYTES = 64 * 1024 * 1024;
const BUNDLED_DEFAULT_CHAT_MODEL_ASSET_PATH = "models/haki-default.gguf";
const BUNDLED_DEFAULT_CHAT_MODEL_FILE_NAME = "llama-3.2-1b-instruct-q4_k_m.gguf";
const BUNDLED_DEFAULT_MODEL_ID = "llama-3.2-1b";
const LEGACY_BUNDLED_TINY_CHAT_MODEL_FILE_NAME = "haki-tiny-0.5b-q4_k_m.gguf";

export interface GgufDownloadProgress {
  bytesWritten: number;
  totalBytes: number | null;
  progress: number;
}

export interface PickAndImportModelResult {
  canceled: boolean;
  status?: ImportedModelStatus;
}

interface BundledModelNativeModule {
  copyBundledAssetToFile?: (
    assetPath: string,
    targetUri: string
  ) => Promise<{
    assetPath?: string;
    uri?: string;
    sizeBytes?: number;
  }>;
}

function getBundledModelNativeModule(): BundledModelNativeModule | null {
  return (NativeModules.HakiDeviceInfo as BundledModelNativeModule | undefined) ?? null;
}

function ensureModelsDirectory(): void {
  MODELS_DIR.create({ intermediates: true, idempotent: true });
}

function modelFile(role: LocalModelRole): File {
  return new File(MODELS_DIR, canonicalModelFileName(role));
}

function manifestFile(role: LocalModelRole): File {
  return new File(MODELS_DIR, manifestFileName(role));
}

function replacementBackupFile(role: LocalModelRole, kind: "model" | "manifest"): File {
  const sourceName = kind === "model" ? canonicalModelFileName(role) : manifestFileName(role);
  return new File(MODELS_DIR, `${sourceName}.backup-${Date.now()}`);
}

function tempModelFile(role: LocalModelRole, sourceName: string): File {
  const safeName = sourceName.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "model.gguf";
  return new File(MODELS_DIR, `${role}-${Date.now()}-${safeName}${TEMP_DOWNLOAD_SUFFIX}`);
}

function statusFromManifest(manifest: LocalModelManifest): ImportedModelStatus {
  return {
    role: manifest.role,
    state: manifest.rejectionReasons.length > 0 ? "rejected" : "available",
    modelDirectory: MODELS_DIR.uri,
    manifestPath: manifest.manifestPath,
    manifest,
    rejectionReasons: manifest.rejectionReasons
  };
}

function missingStatus(role: LocalModelRole, reason = "No imported GGUF model found."): ImportedModelStatus {
  return {
    role,
    state: "missing",
    modelDirectory: MODELS_DIR.uri,
    manifestPath: manifestFile(role).uri,
    manifest: null,
    rejectionReasons: [reason]
  };
}

function rejectedStatus(role: LocalModelRole, reason: string, manifest: LocalModelManifest | null = null): ImportedModelStatus {
  return {
    role,
    state: "rejected",
    modelDirectory: MODELS_DIR.uri,
    manifestPath: manifestFile(role).uri,
    manifest,
    rejectionReasons: manifest?.rejectionReasons.length ? manifest.rejectionReasons : [reason]
  };
}

function safeDelete(fileOrDirectory: File | Directory): void {
  try {
    if (fileOrDirectory.exists) {
      fileOrDirectory.delete();
    }
  } catch {
    // Best-effort cleanup only.
  }
}

function safeFileHash(file: File): string | null {
  try {
    if (file.size > MAX_SAFE_INLINE_HASH_BYTES) {
      return null;
    }

    return file.md5;
  } catch (error) {
    logger.ai.warn("Skipping local model file hash because the filesystem hash read failed.", {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

function clampProgress(bytesWritten: number, totalBytes: number): number {
  if (!Number.isFinite(bytesWritten) || bytesWritten <= 0) return 0;
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return 0;
  return Math.max(0, Math.min(1, bytesWritten / totalBytes));
}

function parseManifest(text: string): LocalModelManifest | null {
  try {
    const parsed = JSON.parse(text) as Partial<LocalModelManifest>;
    if (
      parsed.version !== 1 ||
      !parsed.role ||
      !parsed.uri ||
      !parsed.storedName ||
      !parsed.manifestPath ||
      typeof parsed.sizeBytes !== "number" ||
      !Array.isArray(parsed.rejectionReasons)
    ) {
      return null;
    }

    return parsed as LocalModelManifest;
  } catch {
    return null;
  }
}

function readLocalModelManifest(role: LocalModelRole): LocalModelManifest | null {
  const file = manifestFile(role);
  if (!file.exists) {
    return null;
  }

  return parseManifest(file.textSync());
}

async function validateGgufFile(input: {
  file: File;
  originalName: string;
  role: LocalModelRole;
  source?: LocalModelManifest["source"];
  sourceId?: string | undefined;
  downloadId?: string | undefined;
  hardware?: DeviceHardwareProfile;
}): Promise<LocalModelManifest> {
  const llama = await loadLlamaRn();
  const modelInfo = await llama.loadLlamaModelInfo(input.file.uri);
  const metadata = deriveModelMetadata({
    originalName: input.originalName,
    modelInfo
  });
  const hardware = input.hardware ?? (await getDeviceHardwareProfile());
  const now = new Date().toISOString();

  return buildLocalModelManifest({
    role: input.role,
    source: input.source,
    sourceId: input.sourceId,
    downloadId: input.downloadId,
    originalName: input.originalName,
    storedName: canonicalModelFileName(input.role),
    uri: modelFile(input.role).uri,
    manifestPath: manifestFile(input.role).uri,
    sizeBytes: input.file.size,
    fileHash: safeFileHash(input.file),
    metadata,
    hardware,
    now
  });
}

async function activateGgufFile(input: {
  role: LocalModelRole;
  sourceFile: File;
  originalName: string;
  source?: LocalModelManifest["source"];
  sourceId?: string | undefined;
  downloadId?: string | undefined;
  cleanupSource?: boolean;
}): Promise<ImportedModelStatus> {
  ensureModelsDirectory();
  const sourceUri = input.sourceFile.uri;
  const targetUri = modelFile(input.role).uri;

  try {
    const manifest = await validateGgufFile({
      file: input.sourceFile,
      originalName: input.originalName,
      role: input.role,
      source: input.source,
      sourceId: input.sourceId,
      downloadId: input.downloadId
    });

    if (manifest.rejectionReasons.length > 0) {
      if (!modelFile(input.role).exists) {
        manifestFile(input.role).write(JSON.stringify(manifest, null, 2));
      }
      return statusFromManifest(manifest);
    }

    const target = modelFile(input.role);
    const manifestTarget = manifestFile(input.role);
    const modelBackup = replacementBackupFile(input.role, "model");
    const manifestBackup = replacementBackupFile(input.role, "manifest");

    try {
      if (target.exists) {
        target.move(modelBackup);
      }
      if (manifestTarget.exists) {
        manifestTarget.move(manifestBackup);
      }

      input.sourceFile.move(modelFile(input.role));
      manifestFile(input.role).write(JSON.stringify(manifest, null, 2));

      safeDelete(modelBackup);
      safeDelete(manifestBackup);
    } catch (error) {
      safeDelete(modelFile(input.role));
      safeDelete(manifestFile(input.role));
      if (modelBackup.exists) {
        modelBackup.move(modelFile(input.role));
      }
      if (manifestBackup.exists) {
        manifestBackup.move(manifestFile(input.role));
      }
      throw error;
    }
    return statusFromManifest(manifest);
  } finally {
    if (input.cleanupSource && input.sourceFile.uri === sourceUri && sourceUri !== targetUri) {
      safeDelete(input.sourceFile);
    }
  }
}

export function getLocalModelDirectoryUri(): string {
  return MODELS_DIR.uri;
}

export function getLocalModelManifestUri(role: LocalModelRole): string {
  return manifestFile(role).uri;
}

export function getLocalModelFileUri(role: LocalModelRole): string {
  return modelFile(role).uri;
}

export async function getImportedModelStatus(role: LocalModelRole): Promise<ImportedModelStatus> {
  try {
    const target = modelFile(role);
    const manifest = readLocalModelManifest(role);

    if (!target.exists) {
      if (manifest && manifest.rejectionReasons.length > 0) {
        return statusFromManifest(manifest);
      }

      return missingStatus(role);
    }

    if (!manifest) {
      return rejectedStatus(role, "Imported GGUF exists, but its manifest is missing or invalid. Re-import or download the model from Settings.");
    }

    if (manifest.uri !== target.uri) {
      return rejectedStatus(role, "Imported GGUF manifest points to a different model file. Re-import or download the model from Settings.", manifest);
    }

    return statusFromManifest(manifest);
  } catch (error) {
    logger.ai.error(`Failed to get status for ${role} model`, { error });
    return rejectedStatus(role, "Filesystem error checking model status.");
  }
}

function isLegacyBundledTinyManifest(manifest: LocalModelManifest | null): boolean {
  if (!manifest) return false;
  if (manifest.originalName === LEGACY_BUNDLED_TINY_CHAT_MODEL_FILE_NAME) return true;
  if (manifest.source === "bundled" && manifest.sourceId !== BUNDLED_DEFAULT_MODEL_ID) return true;
  return manifest.sourceId === "haki-tiny";
}

export async function ensureBundledDefaultChatModel(): Promise<ImportedModelStatus> {
  const currentStatus = await getImportedModelStatus("chat");
  if (currentStatus.state === "available" && !isLegacyBundledTinyManifest(currentStatus.manifest)) {
    return currentStatus;
  }

  const nativeModule = getBundledModelNativeModule();
  if (!nativeModule?.copyBundledAssetToFile) {
    if (currentStatus.state !== "missing") {
      return currentStatus;
    }

    return missingStatus(
      "chat",
      "No active chat model found. This build does not expose the bundled default GGUF installer."
    );
  }

  ensureModelsDirectory();
  const tempFile = tempModelFile("chat", BUNDLED_DEFAULT_CHAT_MODEL_FILE_NAME);
  safeDelete(tempFile);

  try {
    await nativeModule.copyBundledAssetToFile(BUNDLED_DEFAULT_CHAT_MODEL_ASSET_PATH, tempFile.uri);
    return activateGgufFile({
      role: "chat",
      sourceFile: tempFile,
      originalName: BUNDLED_DEFAULT_CHAT_MODEL_FILE_NAME,
      source: "bundled",
      sourceId: BUNDLED_DEFAULT_MODEL_ID,
      cleanupSource: true
    });
  } catch (error) {
    safeDelete(tempFile);
    logger.ai.warn("Bundled default GGUF model is not available in this build.", {
      error: error instanceof Error ? error.message : String(error)
    });

    if (currentStatus.state !== "missing") {
      return currentStatus;
    }

    return missingStatus(
      "chat",
      "Bundled default GGUF model is missing from the app package. Add android/app/src/main/assets/models/haki-default.gguf before building."
    );
  }
}

export async function ensureBundledTinyChatModel(): Promise<ImportedModelStatus> {
  return ensureBundledDefaultChatModel();
}

export async function pickAndImportGgufModel(role: LocalModelRole): Promise<PickAndImportModelResult> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: false,
      multiple: false
    });

    if (result.canceled || result.assets.length === 0) {
      return { canceled: true };
    }

    const asset = result.assets[0];
    if (!asset) {
      return { canceled: true };
    }

    ensureModelsDirectory();
    const tempFile = tempModelFile(role, asset.name ?? canonicalModelFileName(role));
    safeDelete(tempFile);
    new File(asset.uri).copy(tempFile);

    const status = await activateGgufFile({
      role,
      sourceFile: tempFile,
      originalName: asset.name ?? tempFile.name,
      source: "imported",
      cleanupSource: true
    });

    return { canceled: false, status };
  } catch (error) {
    logger.ai.error("Error importing GGUF model", { error });
    throw error;
  }
}

export async function removeImportedModel(role: LocalModelRole): Promise<ImportedModelStatus> {
  safeDelete(modelFile(role));
  safeDelete(manifestFile(role));
  return getImportedModelStatus(role);
}

let activeGgufDownload: ReturnType<typeof createDownloadResumable> | null = null;
let activeGgufTempFile: File | null = null;

export function cleanupPartialGgufDownloads(): void {
  try {
    ensureModelsDirectory();
    for (const entry of MODELS_DIR.list()) {
      if (!entry.uri.endsWith(TEMP_DOWNLOAD_SUFFIX)) {
        continue;
      }

      if (activeGgufTempFile?.uri === entry.uri) {
        continue;
      }

      safeDelete(entry);
    }
  } catch (error) {
    logger.ai.warn("Failed to clean up stale partial GGUF downloads", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function downloadGgufModel(
  role: LocalModelRole,
  url: string,
  onProgress: (progress: number, detail?: GgufDownloadProgress) => void,
  metadata?: {
    downloadId?: string | undefined;
    sourceId?: string | undefined;
    /** When set, the file is hashed after download and must match (Git LFS oid). */
    expectedSha256Hex?: string | undefined;
  }
): Promise<{ success: boolean; status?: ImportedModelStatus }> {
  if (activeGgufDownload) {
    throw new Error("A download is already in progress.");
  }

  ensureModelsDirectory();
  const sourceName = decodeURIComponent(url.split("/").pop()?.split("?")[0] || canonicalModelFileName(role));
  const tempFile = tempModelFile(role, sourceName);
  safeDelete(tempFile);
  activeGgufTempFile = tempFile;

  try {
    logger.ai.log(`Downloading GGUF file from ${url} to ${tempFile.uri}`);
    activeGgufDownload = createDownloadResumable(url, tempFile.uri, {}, (progress) => {
      const progressValue = clampProgress(progress.totalBytesWritten, progress.totalBytesExpectedToWrite);
      onProgress(progressValue, {
        bytesWritten: progress.totalBytesWritten,
        totalBytes: progress.totalBytesExpectedToWrite > 0 ? progress.totalBytesExpectedToWrite : null,
        progress: progressValue
      });
    });

    const result = await activeGgufDownload.downloadAsync();
    activeGgufDownload = null;

    if (!result) {
      throw new Error("Download canceled.");
    }

    const expectedSha = metadata?.expectedSha256Hex?.trim();
    if (expectedSha) {
      const want = normalizeSha256Hex(expectedSha);
      logger.ai.log("Verifying GGUF download SHA-256...", { role, bytes: tempFile.size });
      const got = await sha256HexFromFileLike(tempFile);
      if (got !== want) {
        safeDelete(tempFile);
        throw new Error(
          `Downloaded model failed integrity check (SHA-256 mismatch). Remove the partial file and try again, or pick a different mirror.`
        );
      }
    }

    const status = await activateGgufFile({
      role,
      sourceFile: tempFile,
      originalName: sourceName,
      source: "downloaded",
      sourceId: metadata?.sourceId ?? metadata?.downloadId,
      downloadId: metadata?.downloadId,
      cleanupSource: true
    });

    return { success: status.state === "available", status };
  } catch (error) {
    safeDelete(tempFile);
    logger.ai.error("Error downloading GGUF model", { error });
    throw error;
  } finally {
    activeGgufDownload = null;
    activeGgufTempFile = null;
  }
}

export async function cancelGgufDownload(): Promise<void> {
  if (!activeGgufDownload) return;

  try {
    await activeGgufDownload.cancelAsync();
  } catch (error) {
    logger.ai.warn("Failed to cancel active GGUF download", { error });
  } finally {
    safeDelete(activeGgufTempFile ?? new File(MODELS_DIR, `unused${TEMP_DOWNLOAD_SUFFIX}`));
    activeGgufDownload = null;
    activeGgufTempFile = null;
  }
}
