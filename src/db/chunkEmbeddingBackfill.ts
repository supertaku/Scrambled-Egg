import type { SQLiteDatabase } from "expo-sqlite";

import { getSelectedAIMode } from "@/services/modeSelectionService";
import { logger } from "@/utils/logger";

const MAX_CHUNK_EMBED_CHARS = 12_000;
const BATCH_SIZE = 8;
/** Yield to the UI event loop between batches. */
const BATCH_PAUSE_MS = 12;

interface ChunkRow {
  chunk_id: string;
  section_title: string | null;
  process_name: string | null;
  content: string;
  answer: string | null;
  tags: string | null;
}

function storageModelName(modelName: string | null | undefined, providerId: string): string {
  return modelName?.trim() || providerId;
}

function buildEmbedText(row: ChunkRow): string {
  const parts = [
    row.section_title,
    row.process_name,
    row.content,
    row.answer,
    row.tags
  ].filter((p): p is string => Boolean(p?.trim()));
  const text = parts.join("\n\n").trim();
  return text.length > MAX_CHUNK_EMBED_CHARS ? text.slice(0, MAX_CHUNK_EMBED_CHARS) : text;
}

function floatsToBlob(values: number[]): Uint8Array {
  const view = new Float32Array(values);
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

/**
 * Fills `chunk_embeddings` using the active embedding provider (when available).
 * Runs best-effort in the background; safe to call multiple times.
 */
export async function backfillChunkEmbeddingsIfNeeded(db: SQLiteDatabase): Promise<void> {
  try {
    const selected = await getSelectedAIMode();
    const embedProvider = selected.embeddingProvider;
    if (!embedProvider?.embedText) {
      return;
    }

    const capabilities = await embedProvider.getCapabilities();
    const modelKey = storageModelName(capabilities.modelName, embedProvider.id);

    for (;;) {
      const pending = await db.getAllAsync<ChunkRow>(
        `SELECT c.chunk_id, c.section_title, c.process_name, c.content, c.answer, c.tags
         FROM chunks c
         LEFT JOIN chunk_embeddings ce
           ON ce.chunk_id = c.chunk_id AND ce.model_name = ?
         WHERE ce.chunk_id IS NULL
           AND IFNULL(c.embedding_status, 'not_generated') NOT IN ('skipped', 'failed')
         LIMIT ?`,
        [modelKey, BATCH_SIZE]
      );

      if (!pending.length) {
        break;
      }

      for (const row of pending) {
        const text = buildEmbedText(row);
        if (!text.trim()) {
          await db.runAsync(`UPDATE chunks SET embedding_status = ? WHERE chunk_id = ?`, ["skipped", row.chunk_id]);
          continue;
        }

        try {
          const vec = await embedProvider.embedText(text);
          if (!vec.length || !vec.every((n) => Number.isFinite(n))) {
            throw new Error("Invalid embedding vector");
          }
          const blob = floatsToBlob(vec);
          await db.runAsync(
            `INSERT OR REPLACE INTO chunk_embeddings (chunk_id, model_name, embedding, dimension)
             VALUES (?, ?, ?, ?)`,
            [row.chunk_id, modelKey, blob, vec.length]
          );
          await db.runAsync(`UPDATE chunks SET embedding_status = ? WHERE chunk_id = ?`, ["generated", row.chunk_id]);
        } catch (error) {
          await db.runAsync(`UPDATE chunks SET embedding_status = ? WHERE chunk_id = ?`, ["failed", row.chunk_id]);
          logger.db.warn("Chunk embedding failed; skipping chunk and continuing backfill.", {
            chunkId: row.chunk_id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
    }

    logger.db.log("Chunk embedding backfill finished or idle.", { modelKey });
  } catch (error) {
    logger.db.warn("Chunk embedding backfill skipped.", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export function scheduleChunkEmbeddingBackfill(db: SQLiteDatabase): void {
  queueMicrotask(() => {
    void backfillChunkEmbeddingsIfNeeded(db);
  });
}
