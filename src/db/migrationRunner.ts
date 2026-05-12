import type { SQLiteDatabase } from "expo-sqlite";
import { createSchemaSql } from "./schema";
import { logger } from "@/utils/logger";

interface Migration {
  version: number;
  description: string;
  up: (db: SQLiteDatabase) => Promise<void>;
}

interface SqliteMasterRow {
  name: string;
}

interface TableInfoRow {
  name: string;
}

function quoteIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQLite identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

async function tableExists(db: SQLiteDatabase, tableName: string): Promise<boolean> {
  const row = await db.getFirstAsync<SqliteMasterRow>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [tableName]
  );
  return Boolean(row);
}

async function getColumnNames(db: SQLiteDatabase, tableName: string): Promise<Set<string>> {
  const rows = await db.getAllAsync<TableInfoRow>(`PRAGMA table_info(${quoteIdentifier(tableName)})`);
  return new Set(rows.map((row) => row.name));
}

async function addColumnIfMissing(
  db: SQLiteDatabase,
  tableName: string,
  columnName: string,
  definition: string
): Promise<void> {
  const columns = await getColumnNames(db, tableName);
  if (!columns.has(columnName)) {
    await db.execAsync(`ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${quoteIdentifier(columnName)} ${definition};`);
  }
}

async function rebuildFtsIndex(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    DROP TRIGGER IF EXISTS chunks_ai;
    DROP TRIGGER IF EXISTS chunks_ad;
    DROP TRIGGER IF EXISTS chunks_au;
    DROP TABLE IF EXISTS chunks_fts;

    CREATE VIRTUAL TABLE chunks_fts USING fts5(
      section_title,
      process_name,
      content,
      answer,
      citation,
      category,
      office,
      tags,
      synonyms,
      content='chunks',
      content_rowid='id',
      tokenize='unicode61 remove_diacritics 2'
    );

    CREATE TRIGGER chunks_ai AFTER INSERT ON chunks BEGIN
      INSERT INTO chunks_fts(rowid, section_title, process_name, content, answer, citation, category, office, tags, synonyms)
      VALUES (new.id, new.section_title, new.process_name, new.content, new.answer, new.citation, new.category, new.office, new.tags, new.synonyms);
    END;

    CREATE TRIGGER chunks_ad AFTER DELETE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, section_title, process_name, content, answer, citation, category, office, tags, synonyms)
      VALUES ('delete', old.id, old.section_title, old.process_name, old.content, old.answer, old.citation, old.category, old.office, old.tags, old.synonyms);
    END;

    CREATE TRIGGER chunks_au AFTER UPDATE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, section_title, process_name, content, answer, citation, category, office, tags, synonyms)
      VALUES ('delete', old.id, old.section_title, old.process_name, old.content, old.answer, old.citation, old.category, old.office, old.tags, old.synonyms);
      INSERT INTO chunks_fts(rowid, section_title, process_name, content, answer, citation, category, office, tags, synonyms)
      VALUES (new.id, new.section_title, new.process_name, new.content, new.answer, new.citation, new.category, new.office, new.tags, new.synonyms);
    END;

    INSERT INTO chunks_fts(chunks_fts) VALUES ('rebuild');
  `);
}

async function upgradeToV1(db: SQLiteDatabase): Promise<void> {
  const hasDocuments = await tableExists(db, "documents");
  const hasChunks = await tableExists(db, "chunks");

  if (!hasDocuments && !hasChunks) {
    await db.execAsync(createSchemaSql);
    return;
  }

  if (!hasDocuments || !hasChunks) {
    await db.execAsync(createSchemaSql);
  }

  if (await tableExists(db, "documents")) {
    await addColumnIfMissing(db, "documents", "authored_by", "TEXT");
    await addColumnIfMissing(db, "documents", "source_url", "TEXT");
  }

  if (await tableExists(db, "chunks")) {
    await addColumnIfMissing(db, "chunks", "synonyms", "TEXT");
    await addColumnIfMissing(db, "chunks", "steps", "TEXT");
    await addColumnIfMissing(db, "chunks", "prerequisites", "TEXT");
    await addColumnIfMissing(db, "chunks", "office_location", "TEXT");
    await addColumnIfMissing(db, "chunks", "contact_info", "TEXT");
    await addColumnIfMissing(db, "chunks", "priority", "INTEGER DEFAULT 0");
    await addColumnIfMissing(db, "chunks", "embedding_status", "TEXT DEFAULT 'not_generated'");
  }

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_office ON chunks(office);
    CREATE INDEX IF NOT EXISTS idx_chunks_category ON chunks(category);
  `);
  await rebuildFtsIndex(db);
}

async function upgradeToV2(db: SQLiteDatabase): Promise<void> {
  if (await tableExists(db, "chunks")) {
    await addColumnIfMissing(db, "chunks", "embedding_status", "TEXT DEFAULT 'not_generated'");
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS chunk_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chunk_id TEXT UNIQUE NOT NULL,
      model_name TEXT NOT NULL,
      embedding BLOB,
      dimension INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chunk_id) REFERENCES chunks(chunk_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_model_name ON chunk_embeddings(model_name);
  `);
}

async function upgradeToV3(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS conversation_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      scenario TEXT,
      route TEXT,
      source_scope_json TEXT,
      keywords TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS conversation_memory_fts USING fts5(
      question,
      answer,
      scenario,
      keywords,
      content='conversation_memory',
      content_rowid='id',
      tokenize='unicode61 remove_diacritics 2'
    );

    CREATE TRIGGER IF NOT EXISTS conversation_memory_ai AFTER INSERT ON conversation_memory BEGIN
      INSERT INTO conversation_memory_fts(rowid, question, answer, scenario, keywords)
      VALUES (new.id, new.question, new.answer, new.scenario, new.keywords);
    END;

    CREATE TRIGGER IF NOT EXISTS conversation_memory_ad AFTER DELETE ON conversation_memory BEGIN
      INSERT INTO conversation_memory_fts(conversation_memory_fts, rowid, question, answer, scenario, keywords)
      VALUES ('delete', old.id, old.question, old.answer, old.scenario, old.keywords);
    END;

    CREATE TRIGGER IF NOT EXISTS conversation_memory_au AFTER UPDATE ON conversation_memory BEGIN
      INSERT INTO conversation_memory_fts(conversation_memory_fts, rowid, question, answer, scenario, keywords)
      VALUES ('delete', old.id, old.question, old.answer, old.scenario, old.keywords);
      INSERT INTO conversation_memory_fts(rowid, question, answer, scenario, keywords)
      VALUES (new.id, new.question, new.answer, new.scenario, new.keywords);
    END;

    CREATE INDEX IF NOT EXISTS idx_conversation_memory_created_at ON conversation_memory(created_at);
    INSERT INTO conversation_memory_fts(conversation_memory_fts) VALUES ('rebuild');
  `);
}

/**
 * List of all database migrations.
 * When adding a new migration, increment the version and add a new entry.
 */
const migrations: Migration[] = [
  {
    version: 1,
    description: "Initial schema with content-synced FTS5 and auto-sync triggers",
    up: async (db) => {
      await upgradeToV1(db);
    }
  },
  {
    version: 2,
    description: "Add vector-ready chunk embedding storage",
    up: async (db) => {
      await upgradeToV2(db);
    }
  },
  {
    version: 3,
    description: "Add compact conversation memory for related prior-chat context",
    up: async (db) => {
      await upgradeToV3(db);
    }
  }
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // 0. Enable core SQLite features
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");

  // 1. Ensure app_meta exists so we can track version
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Get current version
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_meta WHERE key = 'schema_version'"
  );
  const currentVersion = row ? parseInt(row.value, 10) : 0;

  // 3. Filter and run pending migrations
  const pending = migrations.filter((m) => m.version > currentVersion);
  if (pending.length === 0) {
    return;
  }

  // Sort by version just in case
  pending.sort((a, b) => a.version - b.version);

  await db.withTransactionAsync(async () => {
    for (const migration of pending) {
      logger.db.log(`Applying migration v${migration.version}: ${migration.description}`);
      await migration.up(db);
      await db.runAsync(
        "INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES ('schema_version', ?, CURRENT_TIMESTAMP)",
        [migration.version.toString()]
      );
    }
  });
}
