import type { SQLiteDatabase } from "expo-sqlite";

interface SqliteMasterRow {
  name: string;
}

export class DatabaseInitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseInitializationError";
  }
}

export async function assertFts5Available(db: SQLiteDatabase): Promise<void> {
  const ftsTable = await db.getFirstAsync<SqliteMasterRow>(
    "SELECT name FROM sqlite_master WHERE name = 'chunks_fts'"
  );

  if (!ftsTable) {
    throw new DatabaseInitializationError("SQLite FTS5 index is unavailable. Haki cannot initialize source search.");
  }

  try {
    await db.getFirstAsync<{ rowid: number }>("SELECT rowid FROM chunks_fts LIMIT 1");
  } catch (error) {
    throw new DatabaseInitializationError(
      error instanceof Error
        ? `SQLite FTS5 health check failed: ${error.message}`
        : "SQLite FTS5 health check failed."
    );
  }
}
