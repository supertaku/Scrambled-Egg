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
  chunk_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  embedding BLOB,
  dimension INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chunk_id, model_name),
  FOREIGN KEY (chunk_id) REFERENCES chunks(chunk_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chunk_embedding_status (
  chunk_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_generated',
  last_error TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (chunk_id, model_name),
  FOREIGN KEY (chunk_id) REFERENCES chunks(chunk_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chunk_embedding_index (
  chunk_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  dimension INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (chunk_id, model_name),
  FOREIGN KEY (chunk_id) REFERENCES chunks(chunk_id) ON DELETE CASCADE
);

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

CREATE VIRTUAL TABLE IF NOT EXISTS conversation_memory_fts USING fts5(
  question,
  answer,
  scenario,
  keywords,
  content='conversation_memory',
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

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_office ON chunks(office);
CREATE INDEX IF NOT EXISTS idx_chunks_category ON chunks(category);
CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_model_name ON chunk_embeddings(model_name);
CREATE INDEX IF NOT EXISTS idx_chunk_embedding_status_model_name ON chunk_embedding_status(model_name);
CREATE INDEX IF NOT EXISTS idx_chunk_embedding_index_model_name ON chunk_embedding_index(model_name);
CREATE INDEX IF NOT EXISTS idx_conversation_memory_created_at ON conversation_memory(created_at);
`;
