export const createSchemaSql = `
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT UNIQUE NOT NULL,
  document_title TEXT NOT NULL,
  document_type TEXT,
  category TEXT,
  office TEXT,
  version TEXT,
  last_updated TEXT,
  authored_by TEXT,
  source_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chunk_id TEXT UNIQUE NOT NULL,
  document_id TEXT NOT NULL,
  document_title TEXT NOT NULL,
  section_title TEXT,
  process_name TEXT,
  content TEXT NOT NULL,
  answer TEXT,
  citation TEXT,
  page_number INTEGER,
  category TEXT,
  office TEXT,
  tags TEXT,
  synonyms TEXT,
  steps TEXT,
  prerequisites TEXT,
  office_location TEXT,
  contact_info TEXT,
  priority INTEGER DEFAULT 0,
  embedding_status TEXT DEFAULT 'not_generated',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chunk_embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chunk_id TEXT UNIQUE NOT NULL,
  model_name TEXT NOT NULL,
  embedding BLOB,
  dimension INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chunk_id) REFERENCES chunks(chunk_id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
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

-- Auto-sync triggers for FTS
CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, section_title, process_name, content, answer, citation, category, office, tags, synonyms)
  VALUES (new.id, new.section_title, new.process_name, new.content, new.answer, new.citation, new.category, new.office, new.tags, new.synonyms);
END;

CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, section_title, process_name, content, answer, citation, category, office, tags, synonyms)
  VALUES ('delete', old.id, old.section_title, old.process_name, old.content, old.answer, old.citation, old.category, old.office, old.tags, old.synonyms);
END;

CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, section_title, process_name, content, answer, citation, category, office, tags, synonyms)
  VALUES ('delete', old.id, old.section_title, old.process_name, old.content, old.answer, old.citation, old.category, old.office, old.tags, old.synonyms);
  INSERT INTO chunks_fts(rowid, section_title, process_name, content, answer, citation, category, office, tags, synonyms)
  VALUES (new.id, new.section_title, new.process_name, new.content, new.answer, new.citation, new.category, new.office, new.tags, new.synonyms);
END;

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_office ON chunks(office);
CREATE INDEX IF NOT EXISTS idx_chunks_category ON chunks(category);
CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_model_name ON chunk_embeddings(model_name);
`;
