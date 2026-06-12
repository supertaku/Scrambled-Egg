import type { LocalModelManifest } from "./localModelMetadata";

/**
 * Manifest versions this build can read. Writers emit version 2 (see
 * buildLocalModelManifest); version 1 manifests from earlier app builds
 * share every field this parser requires and are upgraded in place the
 * next time the manifest is rewritten (refreshInstalledManifest).
 */
const READABLE_MANIFEST_VERSIONS: readonly number[] = [1, 2];

export function parseLocalModelManifest(text: string): LocalModelManifest | null {
  try {
    const parsed = JSON.parse(text) as Partial<LocalModelManifest>;
    if (
      !READABLE_MANIFEST_VERSIONS.includes(parsed.version as number) ||
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
