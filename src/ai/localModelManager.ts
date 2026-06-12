import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import { createDownloadResumable, type DownloadPauseState } from "expo-file-system/legacy";
import { NativeModules, Platform } from "react-native";

import { getDeviceHardwareProfile } from "./deviceHardwareProfile";
import type { LocalModelTier } from "./LocalAIProvider";
import { ANDROID_LOCAL_MODEL_TIERS, ANDROID_MODEL_TIER_ORDER } from "./localModelRequirements";
import {
  buildLocalModelManifest,
  canonicalModelFileName,
  deriveModelMetadata,
  getLlamaContextSettingsForTier,
  isGgufFileName,
  manifestFileName,
  recommendedDeviceModelTier,
  validateImportedModel,
  type DeviceHardwareProfile,
  type ImportedModelStatus,
  type LocalModelManifest,
  type LocalModelMetadata,
  type LocalModelRole
} from "./localModelMetadata";
import {
  buildLiteRtActivationProbeInput, cleanupLiteRtActivationProbe, evaluatedManifest,
  localFilePathFromUri, nativeSafeChatText, withActivationTimeout
} from "./modelActivationProbe";
import { catalogDownloadFitsHardwareForDownload } from "./modelCatalog";
import { GGUF_MODELS, type GgufDownloadConfig, type ModelRuntimeFormat, type RuntimeAvailability } from "./modelDownloadConfig";
import { getLiteRtLmNativeModule } from "./nativeModules";
import {
  chooseExecutionProfile,
  executionCandidatesForHardware,
  LOCAL_MODEL_PROFILE_VERSION,
  modelPerformanceKey,
  type ExecutionCandidate
} from "./localModelPerformance";
import { loadLlamaRn } from "./llamaRnRuntime";
import {
  assertNoBusyModelOperation,
  emitModelOperation,
  endModelMutation,
  getModelOperation,
  isBusyModelOperationPhase,
  newModelOperation,
  patchModelOperation,
  startModelMutation,
  subscribeModelOperation,
  type ModelOperationPhase,
  type ModelOperationState
} from "./modelOperationCoordinator";
import { normalizeSha256Hex, sha256HexFromFileLike } from "@/utils/fileSha256";
import { logger } from "@/utils/logger";

export type {
  DeviceHardwareProfile,
  ImportedModelStatus,
  LocalModelManifest,
  LocalModelRole
} from "./localModelMetadata";

const MODELS_DIR = new Directory(Paths.document, "models");
const CHAT_DIR = new Directory(MODELS_DIR, "chat");
const INSTALLED_DIR = new Directory(CHAT_DIR, "installed");
const STAGING_DIR = new Directory(CHAT_DIR, "staging");
const LIBRARY_VERSION = 2;
const TEMP_DOWNLOAD_MARKER = ".partial.";
const LITERT_ACTIVATION_PROBE_TIMEOUT_MS = 90_000;
const MAX_SAFE_INLINE_HASH_BYTES = 64 * 1024 * 1024;
const MAX_IMPORTED_CHAT_MODEL_BYTES = 10 * 1024 * 1024 * 1024;
const MAX_IMPORTED_EMBEDDING_MODEL_BYTES = 2 * 1024 * 1024 * 1024;
const LEGACY_CHAT_FILE = new File(MODELS_DIR, canonicalModelFileName("chat"));
const LEGACY_CHAT_MANIFEST_FILE = new File(MODELS_DIR, manifestFileName("chat"));

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
  runtimeFormat?: ModelRuntimeFormat;
  filePresent?: boolean;
  manifestPresent?: boolean;
  runtimeAvailable?: boolean;
  evaluationStatus?: "not_required" | "pending" | "passed" | "failed";
  activationFailureReason?: string | null;
}

export interface ChatModelLibrary {
  version: 2;
  activeModelId: string | null;
  installedModels: InstalledChatModel[];
}

export interface CompatibleModelCatalog {
  compatibleModels: GgufDownloadConfig[];
  hiddenModels: GgufDownloadConfig[];
  hardware: DeviceHardwareProfile;
  maximumTier: LocalModelTier;
  runtimeAvailability: RuntimeAvailability;
  unavailableReason: string | null;
}

interface StagedDownloadRecord {
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

interface DeviceInfoNativeModule {
  sha256File?: (targetUri: string, operationId: string) => Promise<string>;
  cancelSha256File?: (operationId: string) => void;
  startBackgroundDownload?: (url: string, operationId: string, artifactFileName?: string) => Promise<{ downloadId: number; fileUri: string }>;
  getBackgroundDownloadStatus?: (operationId: string) => Promise<{
    phase: "queued" | "downloading" | "completed" | "failed" | "missing";
    bytesWritten: number;
    totalBytes: number | null;
    error: string | null;
  }>;
  cancelBackgroundDownload?: (operationId: string) => Promise<void>;
  clearBackgroundDownloadRecord?: (operationId: string) => Promise<void>;
}

let activeDownload: ReturnType<typeof createDownloadResumable> | null = null;
let activeStagingRecord: StagedDownloadRecord | null = null;
let activeNativeDownloadTimer: ReturnType<typeof setTimeout> | null = null;
let activeHashOperationId: string | null = null;

function getDeviceInfoNativeModule(): DeviceInfoNativeModule | null {
  try {
    const { requireNativeModule } = require("expo-modules-core");
    return requireNativeModule("HakiDeviceInfo") as DeviceInfoNativeModule;
  } catch {
    return (NativeModules.HakiDeviceInfo as DeviceInfoNativeModule | undefined) ?? null;
  }
}

function ensureModelsDirectory(): void {
  MODELS_DIR.create({ intermediates: true, idempotent: true });
}

function ensureLibraryDirectories(): void {
  ensureModelsDirectory();
  CHAT_DIR.create({ intermediates: true, idempotent: true });
  INSTALLED_DIR.create({ intermediates: true, idempotent: true });
  STAGING_DIR.create({ intermediates: true, idempotent: true });
}

function embeddingFile(role: LocalModelRole): File {
  return new File(MODELS_DIR, canonicalModelFileName(role));
}

function embeddingManifestFile(role: LocalModelRole): File {
  return new File(MODELS_DIR, manifestFileName(role));
}

function installedModelDirectory(modelId: string): Directory {
  return new Directory(INSTALLED_DIR, modelId);
}

function libraryFile(): File {
  return new File(CHAT_DIR, "library.json");
}

function safeArtifactFileName(fileName: string | null | undefined, fallback = "model.gguf"): string {
  const base = fileName?.trim().split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return base || fallback;
}

function artifactFileNameForCatalogModel(model: GgufDownloadConfig | null | undefined): string {
  return safeArtifactFileName(model?.artifactFileName, model?.runtimeFormat === "litert-lm" ? "model.litertlm" : "model.gguf");
}

function installedModelFile(modelId: string, artifactFileName = "model.gguf"): File {
  return new File(installedModelDirectory(modelId), safeArtifactFileName(artifactFileName));
}

function installedManifestFile(modelId: string): File {
  return new File(installedModelDirectory(modelId), "manifest.json");
}

function stagingModelFile(operationId: string, artifactFileName = "model.gguf"): File {
  const extension = safeArtifactFileName(artifactFileName).split(".").pop() ?? "model";
  return new File(STAGING_DIR, `${operationId}${TEMP_DOWNLOAD_MARKER}${extension}`);
}

function stagingRecordFile(operationId: string): File {
  return new File(STAGING_DIR, `${operationId}.json`);
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

function now(): string {
  return new Date().toISOString();
}

function normalizedId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "model";
}

function safeFileHash(file: File): string | null {
  try {
    return file.size > MAX_SAFE_INLINE_HASH_BYTES ? null : file.md5;
  } catch (error) {
    logger.ai.warn("Skipping local model MD5 metadata because the filesystem hash read failed.", {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

function maxImportedModelBytes(role: LocalModelRole): number {
  return role === "embedding" ? MAX_IMPORTED_EMBEDDING_MODEL_BYTES : MAX_IMPORTED_CHAT_MODEL_BYTES;
}

function formatModelSizeLimit(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024 / 1024)}GB`;
}

function assertSafeImportPreflight(input: {
  assetName: string | null | undefined;
  file: File;
  role: LocalModelRole;
  reportedSize?: number | null | undefined;
}): void {
  const displayName = input.assetName?.trim() || "";
  if (!isGgufFileName(displayName)) {
    throw new Error("Imported local models must use the .gguf file extension.");
  }

  const sizeBytes = typeof input.reportedSize === "number" && Number.isFinite(input.reportedSize)
    ? input.reportedSize
    : input.file.size;
  const maxBytes = maxImportedModelBytes(input.role);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error("Imported model file is empty or unreadable.");
  }
  if (sizeBytes > maxBytes) {
    throw new Error(`Imported ${input.role} model is too large for this app. Choose a file up to ${formatModelSizeLimit(maxBytes)}.`);
  }
}

async function probeEmbeddingModel(file: File, manifest: LocalModelManifest): Promise<number> {
  const llama = await loadLlamaRn();
  const settings = getLlamaContextSettingsForTier(manifest.modelTier, true);
  const context = await llama.initLlama({
    model: file.uri,
    embedding: true,
    n_ctx: settings.nCtx,
    n_batch: settings.nBatch,
    n_threads: settings.nThreads,
    use_mlock: false,
    use_mmap: true
  });

  try {
    const result = await context.embedding("Haki embedding import validation", { embd_normalize: 1 });
    const vector = result.embedding;
    if (!Array.isArray(vector) || vector.length === 0 || !vector.every((value) => Number.isFinite(value))) {
      throw new Error("The selected GGUF did not produce a valid embedding vector.");
    }
    return vector.length;
  } finally {
    await context.release().catch((error: unknown) => {
      logger.ai.warn("Embedding import probe context release failed.", {
        error: error instanceof Error ? error.message : String(error)
      });
    });
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

function readManifest(file: File): LocalModelManifest | null {
  if (!file.exists) return null;
  try {
    return parseManifest(file.textSync());
  } catch {
    return null;
  }
}

function statusFromManifest(manifest: LocalModelManifest): ImportedModelStatus {
  return {
    role: manifest.role,
    state: manifest.rejectionReasons.length > 0 ? "rejected" : "available",
    modelDirectory: manifest.role === "chat" ? CHAT_DIR.uri : MODELS_DIR.uri,
    manifestPath: manifest.manifestPath,
    manifest,
    rejectionReasons: manifest.rejectionReasons
  };
}

function missingStatus(role: LocalModelRole, reason = "No active GGUF model selected."): ImportedModelStatus {
  return {
    role,
    state: "missing",
    modelDirectory: role === "chat" ? CHAT_DIR.uri : MODELS_DIR.uri,
    manifestPath: role === "chat" ? libraryFile().uri : embeddingManifestFile(role).uri,
    manifest: null,
    rejectionReasons: [reason]
  };
}

function rejectedStatus(role: LocalModelRole, reason: string, manifest: LocalModelManifest | null = null): ImportedModelStatus {
  return {
    role,
    state: "rejected",
    modelDirectory: role === "chat" ? CHAT_DIR.uri : MODELS_DIR.uri,
    manifestPath: manifest?.manifestPath ?? (role === "chat" ? libraryFile().uri : embeddingManifestFile(role).uri),
    manifest,
    rejectionReasons: manifest?.rejectionReasons.length ? manifest.rejectionReasons : [reason]
  };
}

function parseLibrary(text: string): ChatModelLibrary | null {
  try {
    const parsed = JSON.parse(text) as Partial<ChatModelLibrary>;
    if (parsed.version !== LIBRARY_VERSION || !Array.isArray(parsed.installedModels)) return null;
    return {
      version: LIBRARY_VERSION,
      activeModelId: typeof parsed.activeModelId === "string" ? parsed.activeModelId : null,
      installedModels: parsed.installedModels.filter((entry): entry is InstalledChatModel => {
        return Boolean(entry && typeof entry.id === "string" && typeof entry.fileUri === "string" && typeof entry.manifestUri === "string");
      })
    };
  } catch {
    return null;
  }
}

function writeLibrary(library: ChatModelLibrary): void {
  ensureLibraryDirectories();
  const target = libraryFile();
  const temporary = new File(CHAT_DIR, `library-${Date.now()}.json.tmp`);
  const backup = new File(CHAT_DIR, `library-${Date.now()}.json.backup`);
  safeDelete(temporary);
  safeDelete(backup);
  temporary.write(JSON.stringify(library, null, 2));
  try {
    if (target.exists) target.move(backup);
    temporary.move(libraryFile());
    safeDelete(backup);
  } catch (error) {
    safeDelete(libraryFile());
    if (backup.exists) backup.move(libraryFile());
    safeDelete(temporary);
    throw error;
  }
}

function installedEntryFromManifest(
  id: string,
  manifest: LocalModelManifest,
  source: InstalledModelSource = "downloaded",
  verifiedSha256: string | null = null
): InstalledChatModel {
  return {
    id,
    catalogId: manifest.downloadId ?? manifest.sourceId ?? null,
    source,
    fileUri: manifest.uri,
    manifestUri: manifest.manifestPath,
    modelName: manifest.modelName,
    modelTier: manifest.modelTier,
    sizeBytes: manifest.sizeBytes,
    verifiedSha256,
    installedAt: manifest.importedAt,
    rejectionReasons: manifest.rejectionReasons,
    runtimeFormat: manifest.runtimeFormat ?? "gguf"
  };
}

function reconstructLibrary(): ChatModelLibrary {
  ensureLibraryDirectories();
  const installedModels: InstalledChatModel[] = [];
  for (const entry of INSTALLED_DIR.list()) {
    if (!(entry instanceof Directory)) continue;
    const manifest = readManifest(new File(entry, "manifest.json"));
    const model = new File(entry, safeArtifactFileName(manifest?.storedName, manifest?.runtimeFormat === "litert-lm" ? "model.litertlm" : "model.gguf"));
    if (!manifest || !model.exists || manifest.uri !== model.uri) continue;
    const source: InstalledModelSource =
      manifest.source === "legacy-bundled"
        ? "legacy-bundled"
        : manifest.source === "admin-imported" || manifest.source === "imported"
          ? "admin-imported"
          : "downloaded";
    installedModels.push(installedEntryFromManifest(entry.name, manifest, source));
  }
  return { version: LIBRARY_VERSION, activeModelId: null, installedModels };
}

function migrateLegacyChatModel(library: ChatModelLibrary): ChatModelLibrary {
  if (!LEGACY_CHAT_FILE.exists || library.installedModels.some((item) => item.source === "legacy-bundled")) {
    return library;
  }
  const legacyManifest = readManifest(LEGACY_CHAT_MANIFEST_FILE);
  if (!legacyManifest) {
    logger.ai.warn("A legacy chat model file exists without a readable manifest and was not activated.");
    return library;
  }

  const catalogId = legacyManifest.downloadId ?? legacyManifest.sourceId ?? "legacy-model";
  const modelId = `legacy-${normalizedId(catalogId)}`;
  const directory = installedModelDirectory(modelId);
  directory.create({ intermediates: true, idempotent: true });
  const targetModel = installedModelFile(modelId);
  const targetManifest = installedManifestFile(modelId);
  if (!targetModel.exists) LEGACY_CHAT_FILE.move(targetModel);
  const migratedManifest: LocalModelManifest = {
    ...legacyManifest,
    source: "legacy-bundled",
    sourceId: catalogId,
    storedName: "model.gguf",
    uri: targetModel.uri,
    manifestPath: targetManifest.uri
  };
  targetManifest.write(JSON.stringify(migratedManifest, null, 2));
  safeDelete(LEGACY_CHAT_MANIFEST_FILE);
  const installed = installedEntryFromManifest(modelId, migratedManifest, "legacy-bundled");
  logger.ai.log("Migrated previously installed bundled chat model into the managed library.", { modelId });
  return {
    version: LIBRARY_VERSION,
    activeModelId: migratedManifest.rejectionReasons.length === 0 ? modelId : library.activeModelId,
    installedModels: [...library.installedModels.filter((entry) => entry.id !== modelId), installed]
  };
}

function readLibrary(): ChatModelLibrary {
  ensureLibraryDirectories();
  const target = libraryFile();
  const parsed = target.exists ? parseLibrary(target.textSync()) : null;
  let library = parsed ?? reconstructLibrary();
  const migrated = migrateLegacyChatModel(library);
  if (!parsed || migrated !== library) {
    library = migrated;
    writeLibrary(library);
  }
  if (library.activeModelId && !library.installedModels.some((item) => item.id === library.activeModelId)) {
    library = { ...library, activeModelId: null };
    writeLibrary(library);
  }
  return library;
}

function updateInstalledEntry(library: ChatModelLibrary, entry: InstalledChatModel): ChatModelLibrary {
  return {
    ...library,
    installedModels: [...library.installedModels.filter((item) => item.id !== entry.id), entry]
  };
}

function clearNativeDownloadTimer(): void {
  if (activeNativeDownloadTimer) {
    clearTimeout(activeNativeDownloadTimer);
    activeNativeDownloadTimer = null;
  }
}

function writeStagingRecord(record: StagedDownloadRecord): void {
  ensureLibraryDirectories();
  stagingRecordFile(record.operation.operationId).write(JSON.stringify(record, null, 2));
}

function removeStagingRecord(record: StagedDownloadRecord | null): void {
  if (!record) return;
  safeDelete(new File(record.fileUri));
  safeDelete(stagingRecordFile(record.operation.operationId));
}

async function verifySha256(file: File, operationId: string): Promise<string> {
  const nativeModule = getDeviceInfoNativeModule();
  if (Platform.OS === "android" || Platform.OS === "ios") {
    if (!nativeModule?.sha256File) {
      throw new Error("This app build cannot safely verify downloaded models. Install an updated build and try again.");
    }
    activeHashOperationId = operationId;
    try {
      return normalizeSha256Hex(await nativeModule.sha256File(file.uri, operationId));
    } finally {
      activeHashOperationId = null;
    }
  }
  return sha256HexFromFileLike(file);
}

function modelMetadataFromManifest(manifest: LocalModelManifest): LocalModelMetadata {
  return {
    modelName: manifest.modelName,
    modelParameterCountB: manifest.modelParameterCountB,
    modelQuantization: manifest.modelQuantization,
    modelTier: manifest.modelTier,
    chatTemplate: manifest.chatTemplate ?? {
      status: "unknown",
      modelFamily: "unknown",
      templateFamily: "unknown",
      reason: "No saved chat template metadata.",
      modelFamilySource: "unknown",
      templateFamilySource: "unknown"
    },
    rawInfo: manifest.rawInfo ?? null
  };
}

function hasOnlyTemporarySafetyRejections(reasons: string[]): boolean {
  return reasons.length > 0 && reasons.every((reason) =>
    /requires at least .*GB (RAM|free storage)|RAM could not be detected|Free storage could not be detected|low-memory state/i.test(reason)
  );
}

function modelMetadataFromCatalog(model: GgufDownloadConfig): LocalModelMetadata {
  const modelFamily = /gemma/i.test(model.name) ? "gemma" as const : "unknown" as const;
  return {
    modelName: model.name,
    modelParameterCountB: model.parameterCountB,
    modelQuantization: model.runtimeFormat,
    modelTier: model.tier,
    chatTemplate: {
      status: "supported",
      modelFamily,
      templateFamily: model.chatTemplateFamily ?? modelFamily,
      reason: `${model.name} uses its catalog-declared chat format.`,
      modelFamilySource: "model-name",
      templateFamilySource: "unknown"
    },
    rawInfo: {
      catalogId: model.id,
      runtimeFormat: model.runtimeFormat,
      artifactFileName: model.artifactFileName,
      lifecycleChannel: model.lifecycleChannel
    }
  };
}

async function buildManifestForFile(input: {
  file: File;
  originalName: string;
  modelId: string;
  role?: LocalModelRole;
  source: LocalModelManifest["source"];
  sourceId?: string;
  downloadId?: string;
}): Promise<LocalModelManifest> {
  const catalogModel = GGUF_MODELS.find((model) => model.id === input.downloadId || model.id === input.sourceId);
  const runtimeFormat = catalogModel?.runtimeFormat ?? "gguf";
  const metadata = runtimeFormat === "gguf"
    ? {
        ...deriveModelMetadata({
          originalName: input.originalName,
          modelInfo: await (await loadLlamaRn()).loadLlamaModelInfo(input.file.uri)
        }),
        ...(catalogModel ? { modelTier: catalogModel.tier } : {})
      }
    : modelMetadataFromCatalog(catalogModel!);
  const hardware = await getDeviceHardwareProfile();
  const role = input.role ?? "chat";
  const storedName = role === "chat" ? artifactFileNameForCatalogModel(catalogModel) : canonicalModelFileName(role);
  const modelTarget = role === "chat" ? installedModelFile(input.modelId, storedName) : embeddingFile(role);
  const manifestTarget = role === "chat" ? installedManifestFile(input.modelId) : embeddingManifestFile(role);
  return buildLocalModelManifest({
    role,
    source: input.source,
    sourceId: input.sourceId,
    downloadId: input.downloadId,
    originalName: input.originalName,
    storedName,
    uri: modelTarget.uri,
    manifestPath: manifestTarget.uri,
    sizeBytes: input.file.size,
    fileHash: safeFileHash(input.file),
    metadata,
    hardware,
    now: now(),
    runtimeFormat,
    generationPolicy: catalogModel?.generationPolicy,
    evaluationStatus: runtimeFormat === "litert-lm" ? "pending" : "not_required",
    activationPolicy: catalogModel?.activationPolicy ?? "auto-after-smoke-test",
    artifactSource: catalogModel?.artifactSource,
    artifactLicense: catalogModel?.artifactLicense,
    artifactRevision: catalogModel?.artifactRevision,
    artifactSha256: catalogModel?.sha256Hex,
    minimumRamGB: catalogModel?.minimumRamGB,
    recommendedRamGB: catalogModel?.recommendedRamGB,
    minimumFreeStorageGB: catalogModel?.minimumFreeStorageGB,
    requiredArchitecture: catalogModel?.requiredArchitecture,
    fallbackModelIds: catalogModel?.fallbackModelIds,
    defaultContextTokens: catalogModel?.defaultContextTokens,
    maxContextTokens: catalogModel?.maxContextTokens
  });
}

async function refreshInstalledManifest(entry: InstalledChatModel): Promise<LocalModelManifest> {
  const manifestFile = new File(entry.manifestUri);
  const manifest = readManifest(manifestFile);
  if (!manifest) throw new Error("Installed model manifest is missing or invalid.");
  const hardware = await getDeviceHardwareProfile();
  const catalogModel = entry.catalogId ? GGUF_MODELS.find((model) => model.id === entry.catalogId) : undefined;
  const runtimeFormat = catalogModel?.runtimeFormat ?? manifest.runtimeFormat ?? "gguf";
  const rejectionReasons = validateImportedModel({
    fileName: manifest.originalName,
    role: "chat",
    metadata: modelMetadataFromManifest(manifest),
    sizeBytes: manifest.sizeBytes,
    hardware,
    runtimeFormat,
    ...(catalogModel?.minimumRamGB !== undefined ? { minimumRamGB: catalogModel.minimumRamGB } : {}),
    ...(catalogModel?.minimumFreeStorageGB !== undefined ? { minimumFreeStorageGB: catalogModel.minimumFreeStorageGB } : {})
  });
  const requiresNonThinking = /qwen\s*3|qwen3/i.test(`${manifest.modelName} ${manifest.originalName}`);
  const updated: LocalModelManifest = {
    ...manifest,
    validatedAt: now(),
    recommendedModelTier: recommendedDeviceModelTier(hardware),
    rejectionReasons,
    runtimeFormat,
    artifactEntrypointUri: manifest.artifactEntrypointUri ?? manifest.uri,
    artifactFiles: manifest.artifactFiles ?? [manifest.uri],
    evaluationStatus: manifest.evaluationStatus ?? (runtimeFormat === "litert-lm" ? "pending" : "not_required"),
    activationPolicy: catalogModel?.activationPolicy ?? manifest.activationPolicy ?? "auto-after-smoke-test",
    ...((catalogModel?.artifactRevision ?? manifest.artifactRevision)
      ? { artifactRevision: catalogModel?.artifactRevision ?? manifest.artifactRevision! }
      : {}),
    ...((catalogModel?.sha256Hex ?? manifest.artifactSha256)
      ? { artifactSha256: catalogModel?.sha256Hex ?? manifest.artifactSha256! }
      : {}),
    ...((catalogModel?.minimumRamGB ?? manifest.minimumRamGB) !== undefined
      ? { minimumRamGB: catalogModel?.minimumRamGB ?? manifest.minimumRamGB! }
      : {}),
    ...((catalogModel?.recommendedRamGB ?? manifest.recommendedRamGB) !== undefined
      ? { recommendedRamGB: catalogModel?.recommendedRamGB ?? manifest.recommendedRamGB! }
      : {}),
    ...((catalogModel?.minimumFreeStorageGB ?? manifest.minimumFreeStorageGB) !== undefined
      ? { minimumFreeStorageGB: catalogModel?.minimumFreeStorageGB ?? manifest.minimumFreeStorageGB! }
      : {}),
    ...((catalogModel?.requiredArchitecture ?? manifest.requiredArchitecture)
      ? { requiredArchitecture: catalogModel?.requiredArchitecture ?? manifest.requiredArchitecture! }
      : {}),
    ...((catalogModel?.fallbackModelIds ?? manifest.fallbackModelIds)
      ? { fallbackModelIds: catalogModel?.fallbackModelIds ?? manifest.fallbackModelIds! }
      : {}),
    ...((catalogModel?.defaultContextTokens ?? manifest.defaultContextTokens) !== undefined
      ? { defaultContextTokens: catalogModel?.defaultContextTokens ?? manifest.defaultContextTokens! }
      : {}),
    ...((catalogModel?.maxContextTokens ?? manifest.maxContextTokens) !== undefined
      ? { maxContextTokens: catalogModel?.maxContextTokens ?? manifest.maxContextTokens! }
      : {}),
    ...(catalogModel?.generationPolicy || requiresNonThinking
      ? { generationPolicy: catalogModel?.generationPolicy ?? { thinkingMode: "disabled" } }
      : {}),
    ...(catalogModel?.artifactSource ? { artifactSource: catalogModel.artifactSource } : {}),
    ...(catalogModel?.artifactLicense ? { artifactLicense: catalogModel.artifactLicense } : {})
  };
  manifestFile.write(JSON.stringify(updated, null, 2));
  const library = updateInstalledEntry(readLibrary(), {
    ...entry,
    rejectionReasons,
    modelTier: updated.modelTier,
    modelName: updated.modelName
  });
  writeLibrary(library);
  return updated;
}

async function benchmarkCandidate(
  manifest: LocalModelManifest,
  candidate: ExecutionCandidate,
  availableBackends: string[]
): Promise<NonNullable<LocalModelManifest["executionProfile"]>> {
  const llama = await loadLlamaRn();
  const hardwareBefore = await getDeviceHardwareProfile(availableBackends);
  const settings = getLlamaContextSettingsForTier(manifest.modelTier, false, hardwareBefore.cpuCoreCount);
  const loadStartedAt = Date.now();
  const context = await llama.initLlama({
    model: manifest.uri,
    embedding: false,
    n_ctx: settings.nCtx,
    n_batch: settings.nBatch,
    n_threads: settings.nThreads,
    use_mlock: false,
    use_mmap: true,
    cache_type_k: "q8_0",
    cache_type_v: "q8_0",
    flash_attn_type: "auto",
    ...candidate.initOptions
  });
  const loadTimeMs = Date.now() - loadStartedAt;
  let firstTokenTimeMs: number | null = null;
  let tokenCount = 0;
  const completionStartedAt = Date.now();
  try {
    await context.completion(
      {
        messages: [
          { role: "system", content: "Reply in English using only the requested text." },
          { role: "user", content: "Reply with exactly: OK" }
        ],
        n_predict: 12,
        temperature: 0,
        stop: ["</s>", "<|end|>", "<|eot_id|>", "<|im_end|>"]
      },
      (data) => {
        if (!data.token) return;
        tokenCount += 1;
        firstTokenTimeMs ??= Date.now() - completionStartedAt;
      }
    );
  } finally {
    await context.release();
  }
  const generationTimeMs = Math.max(1, Date.now() - completionStartedAt);
  const hardwareAfter = await getDeviceHardwareProfile(availableBackends);
  return {
    version: LOCAL_MODEL_PROFILE_VERSION,
    modelKey: modelPerformanceKey(manifest),
    executionBackend: candidate.backend,
    accelerationStatus: candidate.backend === "cpu" ? "unavailable" : "benchmarking",
    availableBackends,
    loadTimeMs,
    firstTokenTimeMs,
    decodeTokensPerSecond: tokenCount > 0 ? Number(((tokenCount * 1000) / generationTimeMs).toFixed(2)) : null,
    thermalStateBefore: hardwareBefore.thermalState ?? "unknown",
    thermalStateAfter: hardwareAfter.thermalState ?? "unknown",
    benchmarkedAt: now(),
    failureReason: null
  };
}

async function probeModelLoad(manifest: LocalModelManifest): Promise<LocalModelManifest> {
  if (
    manifest.executionProfile?.version === LOCAL_MODEL_PROFILE_VERSION &&
    manifest.executionProfile.modelKey === modelPerformanceKey(manifest)
  ) {
    return manifest;
  }

  if (getModelOperation()) {
    patchModelOperation({ phase: "optimizing" });
  }
  const llama = await loadLlamaRn();
  const backendInfo = await llama.getBackendDevicesInfo();
  const availableBackends = backendInfo.map((device) => `${device.backend}:${device.deviceName}`);
  const hardware = await getDeviceHardwareProfile(availableBackends);
  const candidates = executionCandidatesForHardware(hardware);
  const baseline = await benchmarkCandidate(manifest, candidates[0]!, availableBackends);
  let accelerated: NonNullable<LocalModelManifest["executionProfile"]> | null = null;
  const acceleratedCandidate = candidates.find((candidate) => candidate.backend !== "cpu");

  if (acceleratedCandidate && hardware.lowMemory !== true && hardware.thermalState !== "serious" && hardware.thermalState !== "critical") {
    try {
      accelerated = await benchmarkCandidate(manifest, acceleratedCandidate, availableBackends);
    } catch (error) {
      accelerated = {
        ...baseline,
        executionBackend: acceleratedCandidate.backend,
        accelerationStatus: "fallback",
        failureReason: error instanceof Error ? error.message : "Accelerated backend benchmark failed."
      };
    }
  }

  const updated = {
    ...manifest,
    executionProfile: chooseExecutionProfile(baseline, accelerated)
  };
  new File(manifest.manifestPath).write(JSON.stringify(updated, null, 2));
  return updated;
}

function writeEvaluation(
  manifest: LocalModelManifest,
  passed: boolean,
  failureReason: string | null,
  startedAt: number
): LocalModelManifest {
  const updated = evaluatedManifest(manifest, passed, failureReason, startedAt, now());
  new File(manifest.manifestPath).write(JSON.stringify(updated, null, 2));
  return updated;
}

async function probeLiteRtLmActivation(manifest: LocalModelManifest): Promise<LocalModelManifest> {
  const startedAt = Date.now();
  const nativeModule = getLiteRtLmNativeModule();
  const missingRuntime = "LiteRT-LM native runtime is unavailable. Install an updated Android build before using Gemma.";
  let requestId: string | null = null;
  try {
    if (!nativeModule?.answerSafeChat) throw new Error(missingRuntime);
    if (nativeModule.isRuntimeAvailable && (await nativeModule.isRuntimeAvailable()) !== true) {
      throw new Error(missingRuntime);
    }
    requestId = `litert-activation-${Date.now()}`;
    const result = await withActivationTimeout(
      nativeModule.answerSafeChat(buildLiteRtActivationProbeInput(
        localFilePathFromUri(manifest.uri),
        requestId
      )),
      LITERT_ACTIVATION_PROBE_TIMEOUT_MS,
      "LiteRT-LM activation probe timed out."
    );
    if (!nativeSafeChatText(result)) throw new Error("LiteRT-LM activation probe returned an empty response.");
    return writeEvaluation(manifest, true, null, startedAt);
  } catch (error) {
    await cleanupLiteRtActivationProbe(nativeModule, requestId);
    const raw = error instanceof Error ? error.message : "LiteRT-LM activation probe failed.";
    const reason = /e4b|4b/i.test(`${manifest.modelName} ${manifest.originalName}`)
      ? `${raw} Try Gemma 4 E2B or a smaller GGUF model.`
      : raw;
    writeEvaluation(manifest, false, reason, startedAt);
    const library = readLibrary();
    const entry = library.installedModels.find((item) => item.manifestUri === manifest.manifestPath);
    if (entry) writeLibrary(updateInstalledEntry(library, { ...entry, rejectionReasons: [reason] }));
    throw new Error(reason);
  }
}

async function probeGgufActivation(manifest: LocalModelManifest): Promise<LocalModelManifest> {
  const startedAt = Date.now();
  try {
    return writeEvaluation(await probeModelLoad(manifest), true, null, startedAt);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "GGUF activation probe failed.";
    writeEvaluation(manifest, false, reason, startedAt);
    throw error;
  }
}

async function activateInstalledModelInternal(modelId: string, operationId: string, ownsMutation = true): Promise<ImportedModelStatus> {
  if (ownsMutation) await startModelMutation(operationId);
  try {
    if (getModelOperation()?.operationId === operationId) patchModelOperation({ phase: "activating" });
    const library = readLibrary();
    const entry = library.installedModels.find((item) => item.id === modelId);
    if (!entry) throw new Error("The selected model is no longer installed.");
    let manifest = await refreshInstalledManifest(entry);
    if (manifest.rejectionReasons.length > 0) {
      throw new Error(manifest.rejectionReasons[0] ?? "This phone cannot safely activate that model right now.");
    }
    if ((manifest.runtimeFormat ?? "gguf") === "litert-lm") {
      manifest = await probeLiteRtLmActivation(manifest);
    } else {
      manifest = await probeGgufActivation(manifest);
    }
    writeLibrary({ ...readLibrary(), activeModelId: modelId });
    return statusFromManifest(manifest);
  } finally {
    if (ownsMutation) endModelMutation();
  }
}

async function installStagedModel(record: StagedDownloadRecord, verifiedSha256: string | null): Promise<ImportedModelStatus> {
  const stagedFile = new File(record.fileUri);
  patchModelOperation({ phase: "validating", progress: null });
  const manifest = await buildManifestForFile({
    file: stagedFile,
    originalName: record.model.artifactFileName,
    modelId: record.operation.modelId,
    source: "downloaded",
    sourceId: record.model.id,
    downloadId: record.model.id
  });
  if (getModelOperation()?.operationId === record.operation.operationId && getModelOperation()!.phase === "canceled") {
    throw new Error("Model operation canceled.");
  }
  if (manifest.rejectionReasons.length > 0 && !hasOnlyTemporarySafetyRejections(manifest.rejectionReasons)) {
    throw new Error(manifest.rejectionReasons[0] ?? "The downloaded model failed validation.");
  }
  const directory = installedModelDirectory(record.operation.modelId);
  directory.create({ intermediates: true, idempotent: true });
  const target = installedModelFile(record.operation.modelId, manifest.storedName);
  const manifestTarget = installedManifestFile(record.operation.modelId);
  safeDelete(target);
  stagedFile.move(target);
  manifestTarget.write(JSON.stringify(manifest, null, 2));
  const entry = installedEntryFromManifest(record.operation.modelId, manifest, "downloaded", verifiedSha256);
  writeLibrary(updateInstalledEntry(readLibrary(), entry));
  safeDelete(stagingRecordFile(record.operation.operationId));

  if (manifest.rejectionReasons.length === 0 && manifest.activationPolicy !== "manual") {
    return activateInstalledModelInternal(entry.id, record.operation.operationId);
  }
  return statusFromManifest(manifest);
}

async function finishDownload(record: StagedDownloadRecord): Promise<{ success: boolean; status?: ImportedModelStatus }> {
  clearNativeDownloadTimer();
  const stagedFile = new File(record.fileUri);
  patchModelOperation({ phase: "verifying", progress: null, bytesWritten: stagedFile.size, totalBytes: stagedFile.size });
  const got = await verifySha256(stagedFile, record.operation.operationId);
  if (getModelOperation()?.operationId === record.operation.operationId && getModelOperation()!.phase === "canceled") {
    throw new Error("Model operation canceled.");
  }
  const expected = record.model.sha256Hex ? normalizeSha256Hex(record.model.sha256Hex) : null;
  if (expected && got !== expected) throw new Error("Downloaded model failed its integrity check. Remove it and try downloading again.");
  const status = await installStagedModel(record, got);
  if (record.nativeTransfer) {
    await getDeviceInfoNativeModule()?.clearBackgroundDownloadRecord?.(record.operation.operationId).catch(() => undefined);
  }
  patchModelOperation({
    phase: "completed",
    progress: 1,
    resumable: false,
    error: status.state === "available" ? null : status.rejectionReasons[0] ?? "The model is installed but cannot be active right now."
  });
  activeStagingRecord = null;
  return { success: status.state === "available", status };
}

function supportsNativeBackgroundDownload(module: DeviceInfoNativeModule | null): module is Required<
  Pick<DeviceInfoNativeModule, "startBackgroundDownload" | "getBackgroundDownloadStatus" | "cancelBackgroundDownload">
> & DeviceInfoNativeModule {
  return Boolean(
    (Platform.OS === "android" || Platform.OS === "ios") &&
    module?.startBackgroundDownload &&
    module.getBackgroundDownloadStatus &&
    module.cancelBackgroundDownload
  );
}

async function monitorNativeDownload(record: StagedDownloadRecord): Promise<{ success: boolean; status?: ImportedModelStatus }> {
  const nativeModule = getDeviceInfoNativeModule();
  if (!supportsNativeBackgroundDownload(nativeModule)) {
    throw new Error("This app build cannot restore the background download. Install an updated build and try again.");
  }

  activeStagingRecord = record;
  clearNativeDownloadTimer();

  return new Promise((resolve, reject) => {
    const checkStatus = async () => {
      if (getModelOperation()?.operationId !== record.operation.operationId || getModelOperation()!.phase === "canceled") {
        resolve({ success: false });
        return;
      }

      try {
        const status = await nativeModule.getBackgroundDownloadStatus(record.operation.operationId);
        if (status.phase === "queued" || status.phase === "downloading") {
          const progress = status.totalBytes ? clampProgress(status.bytesWritten, status.totalBytes) : null;
          record.operation = patchModelOperation({
            phase: status.phase,
            bytesWritten: status.bytesWritten,
            totalBytes: status.totalBytes,
            progress,
            resumable: true
          });
          writeStagingRecord(record);
          activeNativeDownloadTimer = setTimeout(() => void checkStatus(), 850);
          return;
        }

        if (status.phase === "completed") {
          record.operation = patchModelOperation({
            phase: "downloading",
            bytesWritten: status.bytesWritten,
            totalBytes: status.totalBytes,
            progress: 1,
            resumable: true
          });
          writeStagingRecord(record);
          resolve(await finishDownload(record));
          return;
        }

        throw new Error(status.error ?? "The system background download could not be restored.");
      } catch (error) {
        clearNativeDownloadTimer();
        if (getModelOperation()?.phase === "canceled") {
          resolve({ success: false });
          return;
        }
        const message = error instanceof Error ? error.message : "Failed to complete the background model download.";
        removeStagingRecord(record);
        patchModelOperation({ phase: "failed", error: message, resumable: false });
        activeStagingRecord = null;
        reject(error);
      }
    };

    void checkStatus();
  });
}

async function runNativeBackgroundDownload(record: StagedDownloadRecord): Promise<{ success: boolean; status?: ImportedModelStatus }> {
  const nativeModule = getDeviceInfoNativeModule();
  if (!supportsNativeBackgroundDownload(nativeModule)) {
    return runDownload(record, false, true);
  }

  const started = await nativeModule.startBackgroundDownload(
    record.model.url,
    record.operation.operationId,
    record.model.artifactFileName
  );
  record.fileUri = started.fileUri;
  record.nativeTransfer = { downloadId: started.downloadId, platform: Platform.OS as "android" | "ios" };
  record.operation = patchModelOperation({ phase: "queued", resumable: true });
  writeStagingRecord(record);
  return monitorNativeDownload(record);
}

async function runDownload(
  record: StagedDownloadRecord,
  resume: boolean,
  skipNativeBackgroundTransfer = false
): Promise<{ success: boolean; status?: ImportedModelStatus }> {
  if (!skipNativeBackgroundTransfer && !resume && (Platform.OS === "android" || Platform.OS === "ios")) {
    return runNativeBackgroundDownload(record);
  }
  activeStagingRecord = record;
  const file = new File(record.fileUri);
  activeDownload = createDownloadResumable(
    record.model.url,
    file.uri,
    {},
    (progress) => {
      if (getModelOperation()?.operationId !== record.operation.operationId) return;
      const progressValue = clampProgress(progress.totalBytesWritten, progress.totalBytesExpectedToWrite);
      const next = patchModelOperation({
        phase: "downloading",
        progress: progressValue,
        bytesWritten: progress.totalBytesWritten,
        totalBytes: progress.totalBytesExpectedToWrite > 0 ? progress.totalBytesExpectedToWrite : null
      });
      record.operation = next;
      writeStagingRecord(record);
    },
    record.pauseState?.resumeData
  );
  try {
    const result = resume ? await activeDownload.resumeAsync() : await activeDownload.downloadAsync();
    activeDownload = null;
    if (getModelOperation()?.phase === "paused") return { success: false };
    if (!result) throw new Error("Download canceled.");
    return finishDownload(record);
  } catch (error) {
    activeDownload = null;
    if (getModelOperation()?.phase === "paused" || getModelOperation()?.phase === "canceled") return { success: false };
    const message = error instanceof Error ? error.message : "Failed to prepare the downloaded model.";
    removeStagingRecord(record);
    patchModelOperation({ phase: "failed", error: message, resumable: false });
    activeStagingRecord = null;
    logger.ai.error("Managed GGUF download failed.", { error: message, modelId: record.model.id });
    throw error;
  }
}

export async function getCompatibleModelCatalog(): Promise<CompatibleModelCatalog> {
  const hardware = await getDeviceHardwareProfile();
  const runtimeAvailability = await getManagedRuntimeAvailability();
  const library = readLibrary();
  const installedCatalogIds = new Set(library.installedModels.map((item) => item.catalogId).filter(Boolean));
  const availableCatalog = GGUF_MODELS.filter((model) => !installedCatalogIds.has(model.id));
  const compatibleModels = availableCatalog.filter((model) => catalogDownloadFitsHardwareForDownload(model, hardware));
  const hiddenModels = availableCatalog.filter((model) => !compatibleModels.includes(model));
  const maximumTier = compatibleModels.at(-1)?.tier ?? recommendedDeviceModelTier(hardware);
  let unavailableReason: string | null = null;
  if (hardware.memoryGB === null || hardware.freeStorageGB === null) {
    unavailableReason = "Haki could not read this phone's RAM or free storage. Re-check device capability before downloading a model.";
  } else if (!hardware.supportedAbis.some((abi) => abi.toLowerCase().includes("arm64"))) {
    unavailableReason = "This phone does not report the arm64 support required for downloaded local AI models.";
  } else if (hardware.platform === "android" && hardware.lowMemory === true) {
    unavailableReason = "Android reports low memory right now. Close other apps, then re-check before downloading a model.";
  } else if (hardware.memoryGB < ANDROID_LOCAL_MODEL_TIERS.tiny.minimumRamGB) {
    unavailableReason = "This phone does not report enough RAM for an on-device chat model. Source search remains available.";
  } else if (availableCatalog.length > 0 && compatibleModels.length === 0) {
    unavailableReason = "There is not enough free storage for an additional compatible model right now. Free storage, then re-check.";
  }
  return { compatibleModels, hiddenModels, hardware, maximumTier, runtimeAvailability, unavailableReason };
}

async function getManagedRuntimeAvailability(): Promise<RuntimeAvailability> {
  const liteRtModule = getLiteRtLmNativeModule();
  const liteRtAvailable = Platform.OS === "android" && Boolean(liteRtModule) && (
    liteRtModule?.isRuntimeAvailable ? (await Promise.resolve(liteRtModule.isRuntimeAvailable()).catch(() => false)) === true : true
  );
  return { gguf: true, "litert-lm": liteRtAvailable };
}

export async function getChatModelLibrary(): Promise<ChatModelLibrary> {
  const library = readLibrary();
  const runtimeAvailability = await getManagedRuntimeAvailability();
  return {
    ...library,
    installedModels: library.installedModels.map((entry) => {
      const manifest = readManifest(new File(entry.manifestUri));
      const runtimeFormat = manifest?.runtimeFormat ?? entry.runtimeFormat ?? "gguf";
      return {
        ...entry,
        runtimeFormat,
        filePresent: new File(entry.fileUri).exists,
        manifestPresent: Boolean(manifest),
        runtimeAvailable: runtimeAvailability[runtimeFormat] === true,
        evaluationStatus: manifest?.evaluationStatus ?? (runtimeFormat === "gguf" ? "not_required" : "pending"),
        activationFailureReason: manifest?.lastEvaluation?.failureReason ?? entry.rejectionReasons[0] ?? null
      };
    })
  };
}

export async function getActiveChatModelStatus(): Promise<ImportedModelStatus> {
  const library = readLibrary();
  const active = library.activeModelId
    ? library.installedModels.find((entry) => entry.id === library.activeModelId)
    : null;
  if (!active) return missingStatus("chat");
  const manifest = readManifest(new File(active.manifestUri));
  if (!manifest || !new File(active.fileUri).exists) {
    writeLibrary({ ...library, activeModelId: null });
    return rejectedStatus("chat", "The active model file is missing or invalid. Choose another installed model.");
  }
  if (manifest.runtimeFormat === "litert-lm") {
    if (manifest.evaluationStatus !== "passed") {
      writeLibrary({ ...library, activeModelId: null });
      return rejectedStatus(
        "chat",
        manifest.lastEvaluation?.failureReason ?? "The Gemma model is installed but has not passed its activation smoke test."
      );
    }
    const nativeModule = getLiteRtLmNativeModule();
    const runtimeAvailable = Boolean(nativeModule) && (
      nativeModule?.isRuntimeAvailable
        ? (await Promise.resolve(nativeModule.isRuntimeAvailable()).catch(() => false)) === true
        : Boolean(nativeModule?.answerSafeChat)
    );
    if (!runtimeAvailable) {
      writeLibrary({ ...library, activeModelId: null });
      return rejectedStatus("chat", "The Gemma model is installed, but this Android build does not include the LiteRT-LM runtime.");
    }
  }
  return statusFromManifest(manifest);
}

export function getLocalModelDirectoryUri(): string {
  return MODELS_DIR.uri;
}

export function getLocalModelManifestUri(role: LocalModelRole): string {
  if (role === "chat") {
    const library = readLibrary();
    return library.installedModels.find((item) => item.id === library.activeModelId)?.manifestUri ?? libraryFile().uri;
  }
  return embeddingManifestFile(role).uri;
}

export function getLocalModelFileUri(role: LocalModelRole): string {
  if (role === "chat") {
    const library = readLibrary();
    return library.installedModels.find((item) => item.id === library.activeModelId)?.fileUri ?? CHAT_DIR.uri;
  }
  return embeddingFile(role).uri;
}

export async function getImportedModelStatus(role: LocalModelRole): Promise<ImportedModelStatus> {
  if (role === "chat") return getActiveChatModelStatus();
  try {
    const target = embeddingFile(role);
    const manifest = readManifest(embeddingManifestFile(role));
    if (!target.exists) return missingStatus(role, "No imported GGUF model found.");
    if (!manifest) return rejectedStatus(role, "Imported GGUF exists, but its manifest is missing or invalid.");
    return statusFromManifest(manifest);
  } catch (error) {
    logger.ai.error(`Failed to get status for ${role} model`, { error });
    return rejectedStatus(role, "Filesystem error checking model status.");
  }
}

export async function downloadCatalogModel(
  model: GgufDownloadConfig,
  onProgress?: (progress: number, detail?: GgufDownloadProgress) => void
): Promise<{ success: boolean; status?: ImportedModelStatus }> {
  assertNoBusyModelOperation();
  const catalog = await getCompatibleModelCatalog();
  if (!catalog.compatibleModels.some((entry) => entry.id === model.id)) {
    throw new Error(catalog.unavailableReason ?? "This model is not compatible with the device or available storage.");
  }
  if (model.runtimeFormat === "litert-lm" && catalog.runtimeAvailability["litert-lm"] !== true) {
    throw new Error("Install an updated Android build with the LiteRT-LM bridge before downloading Gemma 4.");
  }
  const modelId = normalizedId(model.id);
  if (readLibrary().installedModels.some((entry) => entry.id === modelId || entry.catalogId === model.id)) {
    throw new Error("This model is already installed.");
  }
  const operation = newModelOperation(modelId, model.name, model.id, "downloading");
  emitModelOperation(operation);
  const staged = stagingModelFile(operation.operationId, model.artifactFileName);
  safeDelete(staged);
  const record: StagedDownloadRecord = { version: 1, operation, model, fileUri: staged.uri };
  writeStagingRecord(record);
  const unsubscribe = onProgress
    ? subscribeModelOperation((state) => {
        if (state?.operationId === operation.operationId && state.progress !== null) {
          onProgress(state.progress, {
            bytesWritten: state.bytesWritten,
            totalBytes: state.totalBytes,
            progress: state.progress
          });
        }
      })
    : () => undefined;
  try {
    return await runDownload(record, false);
  } finally {
    unsubscribe();
  }
}

export async function downloadGgufModel(
  _role: LocalModelRole,
  url: string,
  onProgress: (progress: number, detail?: GgufDownloadProgress) => void,
  metadata?: { downloadId?: string | undefined; sourceId?: string | undefined; expectedSha256Hex?: string | undefined }
): Promise<{ success: boolean; status?: ImportedModelStatus }> {
  const selectedId = metadata?.downloadId ?? metadata?.sourceId;
  const model = GGUF_MODELS.find((entry) => entry.id === selectedId || entry.url === url);
  if (!model) throw new Error("Only curated downloadable models can be installed from this screen.");
  return downloadCatalogModel(model, onProgress);
}

export async function pauseActiveModelDownload(): Promise<void> {
  if (activeStagingRecord?.nativeTransfer) return;
  if (!activeDownload || !activeStagingRecord || getModelOperation()?.phase !== "downloading") return;
  const pauseState = await activeDownload.pauseAsync();
  activeStagingRecord.pauseState = pauseState;
  activeStagingRecord.operation = patchModelOperation({ phase: "paused", resumable: true });
  writeStagingRecord(activeStagingRecord);
  activeDownload = null;
}

export async function recoverInterruptedModelOperation(): Promise<ModelOperationState | null> {
  ensureLibraryDirectories();
  if (getModelOperation() && isBusyModelOperationPhase(getModelOperation()!.phase)) return getModelOperation();
  const records = STAGING_DIR.list()
    .filter((entry): entry is File => entry instanceof File && entry.uri.endsWith(".json"))
    .map((file) => {
      try {
        return JSON.parse(file.textSync()) as StagedDownloadRecord;
      } catch {
        return null;
      }
    })
    .filter((record): record is StagedDownloadRecord => Boolean(
      record?.fileUri && (record.nativeTransfer || new File(record.fileUri).exists)
    ));
  const record = records[0];
  if (!record) return null;
  activeStagingRecord = record;
  if (record.nativeTransfer) {
    emitModelOperation({
      ...record.operation,
      phase: "queued",
      resumable: true,
      error: null,
      updatedAt: now()
    });
    void monitorNativeDownload(record).catch((error) => {
      logger.ai.error("Recovered background model download failed.", {
        error: error instanceof Error ? error.message : String(error)
      });
    });
    return getModelOperation();
  }
  if (record.pauseState) {
    // Auto-resume across app restarts when the remaining bytes still fit on
    // the device; otherwise fall back to the manual paused chip.
    let stagedBytes = 0;
    try {
      const stagedFile = new File(record.fileUri);
      stagedBytes = stagedFile.exists ? stagedFile.size ?? 0 : 0;
    } catch {
      stagedBytes = 0;
    }
    const remainingBytes = Math.max(0, record.model.sizeMB * 1024 * 1024 - stagedBytes);
    const hardware = await getDeviceHardwareProfile();
    const headroomGB = 0.5;
    const fitsStorage =
      hardware.freeStorageGB !== null && hardware.freeStorageGB > remainingBytes / 1024 ** 3 + headroomGB;
    if (fitsStorage) {
      logger.ai.log("Auto-resuming interrupted model download.", {
        modelName: record.model.name,
        remainingMB: Math.round(remainingBytes / 1024 ** 2)
      });
      emitModelOperation({
        ...record.operation,
        phase: "downloading",
        resumable: true,
        error: null,
        updatedAt: now()
      });
      void runDownload(record, true).catch((error) => {
        logger.ai.warn("Auto-resume failed; download stays paused for manual retry.", {
          error: error instanceof Error ? error.message : String(error)
        });
        if (getModelOperation() && isBusyModelOperationPhase(getModelOperation()!.phase)) {
          patchModelOperation({ phase: "paused", resumable: true, error: null });
        }
      });
      return getModelOperation();
    }
  }
  emitModelOperation({
    ...record.operation,
    phase: "paused",
    resumable: Boolean(record.pauseState),
    error: record.pauseState ? null : "This interrupted download cannot be resumed. Discard it and download again.",
    updatedAt: now()
  });
  return getModelOperation();
}

export async function resumePausedModelDownload(): Promise<{ success: boolean; status?: ImportedModelStatus }> {
  if (!activeStagingRecord || getModelOperation()?.phase !== "paused" || !activeStagingRecord.pauseState) {
    throw new Error("This interrupted download cannot be resumed. Discard it and download again.");
  }
  patchModelOperation({ phase: "downloading", error: null });
  return runDownload(activeStagingRecord, true);
}

export async function discardPausedModelDownload(): Promise<void> {
  if (!activeStagingRecord || getModelOperation()?.phase !== "paused") return;
  removeStagingRecord(activeStagingRecord);
  patchModelOperation({ phase: "canceled", resumable: false });
  activeStagingRecord = null;
}

export async function cancelGgufDownload(): Promise<void> {
  if (activeDownload) {
    await activeDownload.cancelAsync().catch(() => undefined);
  }
  if (activeHashOperationId) {
    getDeviceInfoNativeModule()?.cancelSha256File?.(activeHashOperationId);
  }
  if (activeStagingRecord?.nativeTransfer) {
    await getDeviceInfoNativeModule()?.cancelBackgroundDownload?.(activeStagingRecord.operation.operationId).catch(() => undefined);
  }
  clearNativeDownloadTimer();
  removeStagingRecord(activeStagingRecord);
  activeDownload = null;
  activeStagingRecord = null;
  if (getModelOperation() && isBusyModelOperationPhase(getModelOperation()!.phase)) patchModelOperation({ phase: "canceled", resumable: false });
}

export function cleanupPartialGgufDownloads(): void {
  ensureLibraryDirectories();
  const protectedUris = new Set<string>();
  for (const entry of STAGING_DIR.list()) {
    if (!(entry instanceof File) || !entry.uri.endsWith(".json")) continue;
    try {
      const record = JSON.parse(entry.textSync()) as StagedDownloadRecord;
      if (record.fileUri && (record.nativeTransfer || new File(record.fileUri).exists)) {
        if (new File(record.fileUri).exists) {
          protectedUris.add(record.fileUri);
        }
      } else {
        safeDelete(entry);
        emitModelOperation({
          ...record.operation,
          phase: "failed",
          error: "The interrupted download did not have a usable saved file. Please download the model again.",
          resumable: false,
          updatedAt: now()
        });
      }
    } catch {
      safeDelete(entry);
    }
  }
  for (const entry of STAGING_DIR.list()) {
    if (entry instanceof File && entry.name.includes(TEMP_DOWNLOAD_MARKER) && !protectedUris.has(entry.uri)) safeDelete(entry);
  }
}

export async function activateChatModel(modelId: string): Promise<ImportedModelStatus> {
  assertNoBusyModelOperation();
  const library = readLibrary();
  const entry = library.installedModels.find((item) => item.id === modelId);
  if (!entry) throw new Error("The selected model is not installed.");
  const operation = newModelOperation(modelId, entry.modelName, entry.catalogId, "activating");
  emitModelOperation(operation);
  try {
    const status = await activateInstalledModelInternal(modelId, operation.operationId);
    patchModelOperation({
      phase: "completed",
      progress: 1,
      error: status.state === "available" ? null : status.rejectionReasons[0] ?? "The model is installed but cannot be active right now."
    });
    return status;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not activate the selected model.";
    patchModelOperation({ phase: "failed", error: message });
    throw error;
  }
}

export async function removeChatModel(modelId: string): Promise<ImportedModelStatus> {
  assertNoBusyModelOperation();
  const library = readLibrary();
  const target = library.installedModels.find((item) => item.id === modelId);
  if (!target) throw new Error("The selected model is no longer installed.");
  const operation = newModelOperation(modelId, target.modelName, target.catalogId, "removing");
  emitModelOperation(operation);
  await startModelMutation(operation.operationId);
  try {
    let nextLibrary = readLibrary();
    if (nextLibrary.activeModelId === modelId) {
      const replacements = nextLibrary.installedModels
        .filter((entry) => entry.id !== modelId)
        .sort((a, b) => ANDROID_MODEL_TIER_ORDER.indexOf(b.modelTier as never) - ANDROID_MODEL_TIER_ORDER.indexOf(a.modelTier as never));
      let replacementActivated = false;
      for (const replacement of replacements) {
        try {
          patchModelOperation({ phase: "activating", modelName: replacement.modelName });
          await activateInstalledModelInternal(replacement.id, operation.operationId, false);
          replacementActivated = true;
          nextLibrary = readLibrary();
          break;
        } catch (error) {
          logger.ai.warn("Replacement chat model could not be activated during removal.", {
            modelId: replacement.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      if (!replacementActivated) {
        nextLibrary = { ...readLibrary(), activeModelId: null };
        writeLibrary(nextLibrary);
      }
    }
    patchModelOperation({ phase: "removing", modelName: target.modelName });
    safeDelete(installedModelDirectory(modelId));
    nextLibrary = readLibrary();
    writeLibrary({
      ...nextLibrary,
      installedModels: nextLibrary.installedModels.filter((entry) => entry.id !== modelId),
      activeModelId: nextLibrary.activeModelId === modelId ? null : nextLibrary.activeModelId
    });
    patchModelOperation({ phase: "completed", progress: 1, modelName: target.modelName });
    return getActiveChatModelStatus();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove the selected model.";
    patchModelOperation({ phase: "failed", error: message });
    throw error;
  } finally {
    endModelMutation();
  }
}

export async function removeImportedModel(role: LocalModelRole): Promise<ImportedModelStatus> {
  if (role === "chat") {
    const library = readLibrary();
    return library.activeModelId ? removeChatModel(library.activeModelId) : missingStatus("chat");
  }
  safeDelete(embeddingFile(role));
  safeDelete(embeddingManifestFile(role));
  return getImportedModelStatus(role);
}

export async function pickAndImportGgufModel(role: LocalModelRole): Promise<PickAndImportModelResult> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false, multiple: false });
  if (result.canceled || result.assets.length === 0 || !result.assets[0]) return { canceled: true };
  assertNoBusyModelOperation();
  const asset = result.assets[0];
  const modelId = role === "chat" ? `admin-${Date.now()}` : "embedding";
  const operation = newModelOperation(modelId, asset.name ?? "Imported GGUF", null, "validating");
  emitModelOperation(operation);
  ensureLibraryDirectories();
  const source = new File(asset.uri);
  assertSafeImportPreflight({
    assetName: asset.name,
    file: source,
    role,
    reportedSize: asset.size
  });
  const staged = stagingModelFile(operation.operationId);
  source.copy(staged);
  assertSafeImportPreflight({
    assetName: asset.name,
    file: staged,
    role
  });
  try {
    let manifest = await buildManifestForFile({
      file: staged,
      originalName: asset.name ?? "imported-model.gguf",
      modelId,
      role,
      source: "admin-imported"
    });
    if (manifest.rejectionReasons.length > 0 && !hasOnlyTemporarySafetyRejections(manifest.rejectionReasons)) {
      throw new Error(manifest.rejectionReasons[0] ?? "Imported GGUF failed validation.");
    }

    if (role === "embedding") {
      patchModelOperation({ phase: "validating", progress: null, modelName: manifest.modelName });
      const embeddingDimension = await probeEmbeddingModel(staged, manifest);
      manifest = {
        ...manifest,
        embeddingDimension,
        validatedAt: now()
      };
      safeDelete(embeddingFile(role));
      safeDelete(embeddingManifestFile(role));
      staged.move(embeddingFile(role));
      embeddingManifestFile(role).write(JSON.stringify(manifest, null, 2));
      const status = statusFromManifest(manifest);
      patchModelOperation({
        phase: "completed",
        progress: 1,
        error: status.state === "available" ? null : status.rejectionReasons[0] ?? "The embedding model is installed but cannot be used right now."
      });
      return { canceled: false, status };
    }

    const directory = installedModelDirectory(modelId);
    directory.create({ intermediates: true, idempotent: true });
    staged.move(installedModelFile(modelId));
    installedManifestFile(modelId).write(JSON.stringify(manifest, null, 2));
    writeLibrary(updateInstalledEntry(readLibrary(), installedEntryFromManifest(modelId, manifest, "admin-imported")));
    const status = manifest.rejectionReasons.length === 0
      ? await activateInstalledModelInternal(modelId, operation.operationId)
      : statusFromManifest(manifest);
    patchModelOperation({
      phase: "completed",
      progress: 1,
      error: status.state === "available" ? null : status.rejectionReasons[0] ?? "The model is installed but cannot be active right now."
    });
    return { canceled: false, status };
  } catch (error) {
    safeDelete(staged);
    patchModelOperation({ phase: "failed", error: error instanceof Error ? error.message : "Import failed." });
    throw error;
  }
}
export {
  getModelOperation,
  isLocalModelInferenceBusy,
  subscribeModelOperation,
  withLocalModelInferenceLease,
  type ModelOperationPhase,
  type ModelOperationState
} from "./modelOperationCoordinator";
