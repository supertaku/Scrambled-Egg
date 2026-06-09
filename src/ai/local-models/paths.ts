import { Directory, File, Paths } from "expo-file-system";

import { canonicalModelFileName, manifestFileName, type LocalModelManifest, type LocalModelRole } from "../localModelMetadata";
import type { GgufDownloadConfig } from "../modelDownloadConfig";

export const MODELS_DIR = new Directory(Paths.document, "models");
export const CHAT_DIR = new Directory(MODELS_DIR, "chat");
export const INSTALLED_DIR = new Directory(CHAT_DIR, "installed");
export const STAGING_DIR = new Directory(CHAT_DIR, "staging");
export const TEMP_DOWNLOAD_MARKER = ".partial.";
export const LEGACY_CHAT_FILE = new File(MODELS_DIR, canonicalModelFileName("chat"));
export const LEGACY_CHAT_MANIFEST_FILE = new File(MODELS_DIR, manifestFileName("chat"));

export function ensureModelsDirectory(): void {
  MODELS_DIR.create({ intermediates: true, idempotent: true });
}

export function ensureLibraryDirectories(): void {
  ensureModelsDirectory();
  CHAT_DIR.create({ intermediates: true, idempotent: true });
  INSTALLED_DIR.create({ intermediates: true, idempotent: true });
  STAGING_DIR.create({ intermediates: true, idempotent: true });
}

export function embeddingFile(role: LocalModelRole): File {
  return new File(MODELS_DIR, canonicalModelFileName(role));
}

export function embeddingManifestFile(role: LocalModelRole): File {
  return new File(MODELS_DIR, manifestFileName(role));
}

export function installedModelDirectory(modelId: string): Directory {
  return new Directory(INSTALLED_DIR, modelId);
}

export function safeArtifactFileName(fileName: string | null | undefined, fallback = "model.gguf"): string {
  const base = fileName?.trim().split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return base || fallback;
}

export function artifactFileNameForCatalogModel(model: GgufDownloadConfig | null | undefined): string {
  return safeArtifactFileName(model?.artifactFileName, model?.runtimeFormat === "litert-lm" ? "model.litertlm" : "model.gguf");
}

export function artifactFileNameForManifest(manifest: LocalModelManifest | null | undefined): string {
  return safeArtifactFileName(manifest?.storedName, manifest?.runtimeFormat === "litert-lm" ? "model.litertlm" : "model.gguf");
}

export function libraryFile(): File {
  return new File(CHAT_DIR, "library.json");
}

export function installedModelFile(modelId: string, artifactFileName = "model.gguf"): File {
  return new File(installedModelDirectory(modelId), safeArtifactFileName(artifactFileName));
}

export function installedManifestFile(modelId: string): File {
  return new File(installedModelDirectory(modelId), "manifest.json");
}

export function stagingModelFile(operationId: string, artifactFileName = "model.gguf"): File {
  const extension = safeArtifactFileName(artifactFileName).split(".").pop() ?? "model";
  return new File(STAGING_DIR, `${operationId}${TEMP_DOWNLOAD_MARKER}${extension}`);
}

export function stagingRecordFile(operationId: string): File {
  return new File(STAGING_DIR, `${operationId}.json`);
}

export function safeDelete(fileOrDirectory: File | Directory): void {
  try {
    if (fileOrDirectory.exists) {
      fileOrDirectory.delete();
    }
  } catch {
    // Best-effort cleanup only.
  }
}
