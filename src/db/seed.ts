import type { SQLiteDatabase } from "expo-sqlite";

import seedDocuments from "@/data/seed-documents.json";
import type { StructuredDocument } from "@/types/document";

import { getDocumentCount, insertDocuments } from "./documentRepository";

const SEED_VERSION = "demo-2026-04-30";

export async function seedDatabase(db: SQLiteDatabase): Promise<void> {
  const count = await getDocumentCount(db);
  if (count > 0) {
    return;
  }

  await insertDocuments(db, seedDocuments as StructuredDocument[]);
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value, updated_at)
     VALUES ('seed_version', ?, CURRENT_TIMESTAMP)`,
    [SEED_VERSION]
  );
}
