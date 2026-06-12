import type { SQLiteDatabase } from "expo-sqlite";

import { createSchemaSql } from "./schema";

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await db.execAsync(createSchemaSql);
  await db.execAsync("DROP INDEX IF EXISTS idx_bookmarks_unique_content;");
}
