import type { SQLiteDatabase } from "expo-sqlite";

import type { DocumentSummary, ImportResult, StructuredDocument } from "@/types/document";

interface CountRow {
  count: number;
}

interface DocumentSummaryRow {
  id: number;
  document_id: string;
  document_title: string;
  document_type: string | null;
  category: string | null;
  office: string | null;
  version: string | null;
  last_updated: string | null;
  chunk_count: number;
}

interface DatabaseStatsRow {
  document_count: number;
  chunk_count: number;
  latest_update: string | null;
}

interface MetaRow {
  value: string;
}

export interface DatabaseStats {
  documentCount: number;
  chunkCount: number;
  latestUpdate: string | null;
}

export async function getDocumentCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<CountRow>("SELECT COUNT(*) AS count FROM documents");
  return row?.count ?? 0;
}

export async function getDocumentSummaries(db: SQLiteDatabase): Promise<DocumentSummary[]> {
  const rows = await db.getAllAsync<DocumentSummaryRow>(`
    SELECT
      d.id,
      d.document_id,
      d.document_title,
      d.document_type,
      d.category,
      d.office,
      d.version,
      d.last_updated,
      COUNT(c.id) AS chunk_count
    FROM documents d
    LEFT JOIN chunks c ON c.document_id = d.document_id
    GROUP BY d.id
    ORDER BY d.document_title COLLATE NOCASE ASC
  `);

  return rows.map((row) => ({
    id: row.id,
    documentId: row.document_id,
    documentTitle: row.document_title,
    documentType: row.document_type,
    category: row.category,
    office: row.office,
    version: row.version,
    lastUpdated: row.last_updated,
    chunkCount: row.chunk_count
  }));
}

export async function getDatabaseStats(db: SQLiteDatabase): Promise<DatabaseStats> {
  const row = await db.getFirstAsync<DatabaseStatsRow>(`
    SELECT
      (SELECT COUNT(*) FROM documents) AS document_count,
      (SELECT COUNT(*) FROM chunks) AS chunk_count,
      (SELECT MAX(last_updated) FROM documents) AS latest_update
  `);

  return {
    documentCount: row?.document_count ?? 0,
    chunkCount: row?.chunk_count ?? 0,
    latestUpdate: row?.latest_update ?? null
  };
}

export async function getAppMetaValue(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<MetaRow>("SELECT value FROM app_meta WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function deleteDocument(db: SQLiteDatabase, documentId: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    // Foreign key with ON DELETE CASCADE will handle chunks
    await db.runAsync("DELETE FROM documents WHERE document_id = ?", [documentId]);
  });
}

export async function replaceDocument(
  db: SQLiteDatabase,
  document: StructuredDocument
): Promise<ImportResult> {
  let result: ImportResult = {
    insertedDocuments: 0,
    skippedDocuments: 0,
    insertedChunks: 0,
    skippedChunks: 0
  };

  await db.withTransactionAsync(async () => {
    await deleteDocument(db, document.document_id);
    result = await insertDocuments(db, [document]);
  });

  return result;
}

export async function insertDocuments(
  db: SQLiteDatabase,
  documents: StructuredDocument[]
): Promise<ImportResult> {
  const result: ImportResult = {
    insertedDocuments: 0,
    skippedDocuments: 0,
    insertedChunks: 0,
    skippedChunks: 0
  };

  await db.withTransactionAsync(async () => {
    for (const document of documents) {
      const existingDocument = await db.getFirstAsync<{ id: number }>(
        "SELECT id FROM documents WHERE document_id = ?",
        [document.document_id]
      );

      if (existingDocument) {
        result.skippedDocuments += 1;
        result.skippedChunks += document.chunks.length;
        continue;
      } else {
        await db.runAsync(
          `INSERT INTO documents (
            document_id,
            document_title,
            document_type,
            category,
            office,
            version,
            last_updated,
            authored_by,
            source_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            document.document_id,
            document.document_title,
            document.document_type ?? null,
            document.category ?? null,
            document.office ?? null,
            document.version ?? null,
            document.last_updated ?? null,
            document.authored_by ?? null,
            document.source_url ?? null
          ]
        );
        result.insertedDocuments += 1;
      }

      for (const chunk of document.chunks) {
        const existingChunk = await db.getFirstAsync<{ id: number }>(
          "SELECT id FROM chunks WHERE chunk_id = ?",
          [chunk.chunk_id]
        );

        if (existingChunk) {
          result.skippedChunks += 1;
          continue;
        }

        const tags = chunk.tags?.join(" ") ?? null;
        const synonyms = chunk.synonyms?.join(" ") ?? null;
        const steps = chunk.steps ? JSON.stringify(chunk.steps) : null;
        const prerequisites = chunk.prerequisites ? JSON.stringify(chunk.prerequisites) : null;

        await db.runAsync(
          `INSERT INTO chunks (
            chunk_id,
            document_id,
            document_title,
            section_title,
            process_name,
            content,
            answer,
            citation,
            page_number,
            category,
            office,
            tags,
            synonyms,
            steps,
            prerequisites,
            office_location,
            contact_info,
            priority
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            chunk.chunk_id,
            document.document_id,
            document.document_title,
            chunk.section_title ?? null,
            chunk.process_name ?? null,
            chunk.content,
            chunk.answer ?? null,
            chunk.citation ?? null,
            chunk.page_number ?? null,
            document.category ?? null,
            document.office ?? null,
            tags,
            synonyms,
            steps,
            prerequisites,
            chunk.office_location ?? null,
            chunk.contact_info ?? null,
            chunk.priority ?? 0
          ]
        );

        // FTS insert is now handled by database triggers!
        result.insertedChunks += 1;
      }
    }
  });

  return result;
}
