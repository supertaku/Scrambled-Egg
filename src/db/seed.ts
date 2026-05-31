import type { SQLiteDatabase } from "expo-sqlite";

import seedDocuments from "@/data/seed-documents.json";
import type { StructuredDocument } from "@/types/document";

import { getDocumentCount, insertDocuments, getAppMetaValue } from "./documentRepository";

const SEED_VERSION = "tup-taguig-2026-05-30-rag-chunk-qa";
const seedDocumentIds = (seedDocuments as StructuredDocument[]).map((document) => document.document_id);
const SEED_DOCUMENT_IDS_KEY = "seed_document_ids";

function parseSeedDocumentIds(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  } catch {
    return [];
  }
}

export async function seedDatabase(db: SQLiteDatabase): Promise<void> {
  const currentVersion = await getAppMetaValue(db, "seed_version");
  const count = await getDocumentCount(db);

  if (count > 0 && currentVersion === SEED_VERSION) {
    if (!(await getAppMetaValue(db, SEED_DOCUMENT_IDS_KEY))) {
      await db.runAsync(
        `INSERT OR REPLACE INTO app_meta (key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [SEED_DOCUMENT_IDS_KEY, JSON.stringify(seedDocumentIds)]
      );
    }
    return;
  }

  if (count > 0 && currentVersion !== SEED_VERSION) {
    console.log(`Re-seeding database from version ${currentVersion} to ${SEED_VERSION}`);
    const previousSeedDocumentIds = parseSeedDocumentIds(await getAppMetaValue(db, SEED_DOCUMENT_IDS_KEY));
    const documentsToReplace = Array.from(new Set([...previousSeedDocumentIds, ...seedDocumentIds]));
    for (const documentId of documentsToReplace) {
      await db.runAsync("DELETE FROM documents WHERE document_id = ?", [documentId]);
    }
  }

  await insertDocuments(db, seedDocuments as StructuredDocument[]);
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value, updated_at)
     VALUES ('seed_version', ?, CURRENT_TIMESTAMP)`,
    [SEED_VERSION]
  );
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`,
    [SEED_DOCUMENT_IDS_KEY, JSON.stringify(seedDocumentIds)]
  );
}
