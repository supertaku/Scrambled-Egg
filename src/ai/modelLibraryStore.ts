import { Directory, File } from "expo-file-system";

import type { LocalModelTier } from "./LocalAIProvider";
import type { ImportedModelStatus, LocalModelManifest, LocalModelRole } from "./localModelMetadata";
import type { ModelRuntimeFormat } from "./modelDownloadConfig";
import {
  CHAT_DIR,
  INSTALLED_DIR,
  LEGACY_CHAT_FILE,
  LEGACY_CHAT_MANIFEST_FILE,
  MODELS_DIR,
  embeddingManifestFile,
  ensureLibraryDirectories,
  installedManifestFile,
  installedModelDirectory,
  installedModelFile,
  libraryFile,
  normalizedId,
  safeArtifactFileName,
  safeDelete
} from "./modelStoragePaths";
import { logger } from "@/utils/logger";

/**
 * Persistence for the installed chat-model library (library.json) and the
 * per-model manifest files, plus the ImportedModelStatus builders derived
 * from them. Reads reconstruct from disk when library.json is missing or
 * corrupt; writes are atomic (temp + backup + move). No download or
 * operation state lives here.
 */
export const LIBRARY_VERSION = 2;

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

export function readManifest(file: File): LocalModelManifest | null {
  if (!file.exists) return null;
  try {
    return parseManifest(file.textSync());
  } catch {
    return null;
  }
}

export function statusFromManifest(manifest: LocalModelManifest): ImportedModelStatus {
  return {
    role: manifest.role,
    state: manifest.rejectionReasons.length > 0 ? "rejected" : "available",
    modelDirectory: manifest.role === "chat" ? CHAT_DIR.uri : MODELS_DIR.uri,
    manifestPath: manifest.manifestPath,
    manifest,
    rejectionReasons: manifest.rejectionReasons
  };
}

export function missingStatus(role: LocalModelRole, reason = "No active GGUF model selected."): ImportedModelStatus {
  return {
    role,
    state: "missing",
    modelDirectory: role === "chat" ? CHAT_DIR.uri : MODELS_DIR.uri,
    manifestPath: role === "chat" ? libraryFile().uri : embeddingManifestFile(role).uri,
    manifest: null,
    rejectionReasons: [reason]
  };
}

export function rejectedStatus(role: LocalModelRole, reason: string, manifest: LocalModelManifest | null = null): ImportedModelStatus {
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

export function writeLibrary(library: ChatModelLibrary): void {
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

export function installedEntryFromManifest(
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

export function readLibrary(): ChatModelLibrary {
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

export function updateInstalledEntry(library: ChatModelLibrary, entry: InstalledChatModel): ChatModelLibrary {
  return {
    ...library,
    installedModels: [...library.installedModels.filter((item) => item.id !== entry.id), entry]
  };
}
