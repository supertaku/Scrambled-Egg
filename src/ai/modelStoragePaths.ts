import { Directory, File, Paths } from "expo-file-system";

import { canonicalModelFileName, manifestFileName, type LocalModelRole } from "./localModelMetadata";
import type { GgufDownloadConfig } from "./modelDownloadConfig";
import { logger } from "@/utils/logger";

/**
 * Stateless storage layout and filesystem helpers for the managed local-model
 * library. Everything here is a pure function of its inputs plus the fixed
 * directory layout; mutable download/operation state stays in
 * localModelManager.
 *
 * Layout:
 *   documents/models/                     embedding GGUF + manifest, legacy chat file
 *   documents/models/chat/                library.json
 *   documents/models/chat/installed/<id>/ model artifact + manifest.json
 *   documents/models/chat/staging/        in-flight downloads + staging records
 */
export const MODELS_DIR = new Directory(Paths.document, "models");
export const CHAT_DIR = new Directory(MODELS_DIR, "chat");
export const INSTALLED_DIR = new Directory(CHAT_DIR, "installed");
export const STAGING_DIR = new Directory(CHAT_DIR, "staging");
export const TEMP_DOWNLOAD_MARKER = ".partial.";
export const MAX_SAFE_INLINE_HASH_BYTES = 64 * 1024 * 1024;
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

export function libraryFile(): File {
  return new File(CHAT_DIR, "library.json");
}

export function safeArtifactFileName(fileName: string | null | undefined, fallback = "model.gguf"): string {
  const base = fileName?.trim().split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return base || fallback;
}

export function artifactFileNameForCatalogModel(model: GgufDownloadConfig | null | undefined): string {
  return safeArtifactFileName(model?.artifactFileName, model?.runtimeFormat === "litert-lm" ? "model.litertlm" : "model.gguf");
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

export function now(): string {
  return new Date().toISOString();
}

export function normalizedId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "model";
}

export function safeFileHash(file: File): string | null {
  try {
    return file.size > MAX_SAFE_INLINE_HASH_BYTES ? null : file.md5;
  } catch (error) {
    logger.ai.warn("Skipping local model MD5 metadata because the filesystem hash read failed.", {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

export function clampProgress(bytesWritten: number, totalBytes: number): number {
  if (!Number.isFinite(bytesWritten) || bytesWritten <= 0) return 0;
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return 0;
  return Math.max(0, Math.min(1, bytesWritten / totalBytes));
}
