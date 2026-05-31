import * as SQLite from "expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";

import { scheduleChunkEmbeddingBackfill } from "./chunkEmbeddingBackfill";
import { runMigrations } from "./migrationRunner";
import { seedDatabase } from "./seed";
import { assertFts5Available } from "./ftsHealth";
import { ensureSqliteVecBaseSchema, loadSqliteVecExtension, syncSqliteVecFromBlobStore } from "./sqliteVec";
import { DATABASE_NAME } from "@/utils/constants";

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function openDatabase(): Promise<SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await loadSqliteVecExtension(db);
  await runMigrations(db);
  await ensureSqliteVecBaseSchema(db);
  await seedDatabase(db);
  await syncSqliteVecFromBlobStore(db);
  await assertFts5Available(db);
  scheduleChunkEmbeddingBackfill(db);
  return db;
}

export function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabase();
  }
  return databasePromise;
}
