import type { SQLiteDatabase } from "expo-sqlite";

import { logger } from "@/utils/logger";

const readyConnections = new WeakSet<SQLiteDatabase>();
const unavailableConnections = new WeakSet<SQLiteDatabase>();

interface ExpoSqliteRuntime {
  bundledExtensions: Record<string, { libPath: string; entryPoint: string } | undefined>;
}

interface StoredEmbeddingRow {
  chunk_id: string;
  dimension: number | null;
  embedding: unknown;
  model_name: string;
}

function safeDimension(dimension: number): number {
  if (!Number.isInteger(dimension) || dimension <= 0 || dimension > 4096) {
    throw new Error(`Unsupported embedding dimension for sqlite-vec: ${dimension}`);
  }
  return dimension;
}

export function sqliteVecTableName(dimension: number): string {
  return `chunk_embeddings_vec_${safeDimension(dimension)}`;
}

export async function loadSqliteVecExtension(db: SQLiteDatabase): Promise<boolean> {
  if (readyConnections.has(db)) return true;
  if (unavailableConnections.has(db)) return false;

  try {
    await db.getFirstAsync("SELECT vec_version() AS version");
    readyConnections.add(db);
    return true;
  } catch {
    // Extension is not loaded yet.
  }

  if (typeof (db as Partial<SQLiteDatabase>).loadExtensionAsync !== "function") {
    unavailableConnections.add(db);
    return false;
  }

  const sqlite = require("expo-sqlite") as ExpoSqliteRuntime;
  const extension = sqlite.bundledExtensions["sqlite-vec"];
  if (!extension) {
    unavailableConnections.add(db);
    return false;
  }

  try {
    await db.loadExtensionAsync(extension.libPath, extension.entryPoint);
    await db.getFirstAsync("SELECT vec_version() AS version");
    readyConnections.add(db);
    logger.db.log("sqlite-vec extension loaded.");
    return true;
  } catch (error) {
    unavailableConnections.add(db);
    logger.db.warn("sqlite-vec extension unavailable; using BLOB cosine fallback.", {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

export async function ensureSqliteVecBaseSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS chunk_embedding_index (
      chunk_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      dimension INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (chunk_id, model_name),
      FOREIGN KEY (chunk_id) REFERENCES chunks(chunk_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chunk_embedding_index_model_name
      ON chunk_embedding_index(model_name);
  `);
}

export async function ensureSqliteVecTable(db: SQLiteDatabase, dimension: number): Promise<boolean> {
  if (!(await loadSqliteVecExtension(db))) {
    return false;
  }

  const tableName = sqliteVecTableName(dimension);
  await db.execAsync(`CREATE VIRTUAL TABLE IF NOT EXISTS ${tableName} USING vec0(embedding float[${safeDimension(dimension)}]);`);
  return true;
}

export async function upsertSqliteVecEmbedding(input: {
  chunkId: string;
  db: SQLiteDatabase;
  dimension: number;
  embedding: Uint8Array;
  modelName: string;
}): Promise<boolean> {
  const { chunkId, db, dimension, embedding, modelName } = input;
  if (!(await ensureSqliteVecTable(db, dimension))) {
    return false;
  }

  const previous = await db.getFirstAsync<{ rowid: number; dimension: number }>(
    "SELECT rowid, dimension FROM chunk_embedding_index WHERE chunk_id = ? AND model_name = ?",
    [chunkId, modelName]
  );
  await db.runAsync(
    `INSERT INTO chunk_embedding_index (chunk_id, model_name, dimension, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(chunk_id, model_name) DO UPDATE SET
       dimension = excluded.dimension,
       updated_at = CURRENT_TIMESTAMP`,
    [chunkId, modelName, dimension]
  );
  const mapping = await db.getFirstAsync<{ rowid: number }>(
    "SELECT rowid FROM chunk_embedding_index WHERE chunk_id = ? AND model_name = ?",
    [chunkId, modelName]
  );
  if (!mapping) {
    return false;
  }

  if (previous && previous.dimension !== dimension) {
    const oldTableName = sqliteVecTableName(previous.dimension);
    await db.runAsync(`DELETE FROM ${oldTableName} WHERE rowid = ?`, [previous.rowid]).catch(() => undefined);
  }

  const tableName = sqliteVecTableName(dimension);
  await db.runAsync(`INSERT OR REPLACE INTO ${tableName} (rowid, embedding) VALUES (?, ?)`, [
    mapping.rowid,
    embedding
  ]);
  return true;
}

function blobToUint8Array(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

export async function syncSqliteVecFromBlobStore(db: SQLiteDatabase): Promise<void> {
  if (!(await loadSqliteVecExtension(db))) {
    return;
  }

  await ensureSqliteVecBaseSchema(db);
  const rows = await db.getAllAsync<StoredEmbeddingRow>(
    `SELECT chunk_id, model_name, embedding, dimension
     FROM chunk_embeddings
     WHERE embedding IS NOT NULL AND dimension IS NOT NULL`
  );

  for (const row of rows) {
    const embedding = blobToUint8Array(row.embedding);
    if (!embedding || !row.dimension) {
      continue;
    }

    await upsertSqliteVecEmbedding({
      chunkId: row.chunk_id,
      db,
      dimension: row.dimension,
      embedding,
      modelName: row.model_name
    }).catch((error) => {
      logger.db.warn("Existing embedding could not be copied into sqlite-vec.", {
        chunkId: row.chunk_id,
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }
}

export async function sqliteVecReadyForDimension(db: SQLiteDatabase, dimension: number): Promise<boolean> {
  if (!(await loadSqliteVecExtension(db))) {
    return false;
  }

  try {
    const tableName = sqliteVecTableName(dimension);
    const row = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      [tableName]
    );
    return Boolean(row);
  } catch {
    return false;
  }
}
