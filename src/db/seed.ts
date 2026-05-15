import type { SQLiteDatabase } from "expo-sqlite";

import seedDocuments from "@/data/seed-documents.json";
import type { StructuredDocument } from "@/types/document";

import { getDocumentCount, insertDocuments, getAppMetaValue } from "./documentRepository";

const SEED_VERSION = "tup-taguig-2026-05-10";
const seedDocumentIds = (seedDocuments as StructuredDocument[]).map((document) => document.document_id);

export async function seedDatabase(db: SQLiteDatabase): Promise<void> {
  const currentVersion = await getAppMetaValue(db, "seed_version");
  const count = await getDocumentCount(db);

  if (count > 0 && currentVersion === SEED_VERSION) {
    return;
  }

  if (count > 0 && currentVersion !== SEED_VERSION) {
    console.log(`Re-seeding database from version ${currentVersion} to ${SEED_VERSION}`);
    for (const documentId of seedDocumentIds) {
      await db.runAsync("DELETE FROM documents WHERE document_id = ?", [documentId]);
    }
  }

  await insertDocuments(db, seedDocuments as StructuredDocument[]);
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value, updated_at)
     VALUES ('seed_version', ?, CURRENT_TIMESTAMP)`,
    [SEED_VERSION]
  );
}
