import { File } from "expo-file-system";

import type { ImportedModelStatus, LocalModelManifest, LocalModelRole } from "../localModelMetadata";
import { CHAT_DIR, MODELS_DIR, embeddingManifestFile, libraryFile } from "./paths";

export function parseManifest(text: string): LocalModelManifest | null {
  try {
    const parsed = JSON.parse(text) as Partial<LocalModelManifest>;
    if (
      (parsed.version !== 1 && parsed.version !== 2) ||
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

export function writeManifest(manifest: LocalModelManifest): void {
  new File(manifest.manifestPath).write(JSON.stringify(manifest, null, 2));
}

export function filePathFromUri(uri: string): string {
  if (uri.startsWith("file://")) {
    return decodeURIComponent(uri.slice("file://".length));
  }
  return uri;
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

export function rejectedStatus(
  role: LocalModelRole,
  reason: string,
  manifest: LocalModelManifest | null = null
): ImportedModelStatus {
  return {
    role,
    state: "rejected",
    modelDirectory: role === "chat" ? CHAT_DIR.uri : MODELS_DIR.uri,
    manifestPath: manifest?.manifestPath ?? (role === "chat" ? libraryFile().uri : embeddingManifestFile(role).uri),
    manifest,
    rejectionReasons: manifest?.rejectionReasons.length ? manifest.rejectionReasons : [reason]
  };
}
