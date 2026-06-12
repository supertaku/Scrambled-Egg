import { InteractionManager } from "react-native";
import type { SQLiteDatabase } from "expo-sqlite";

import { getDeviceHardwareProfile } from "@/ai/deviceHardwareProfile";
import type { LocalAICapabilities } from "@/ai/LocalAIProvider";
import { isLocalModelInferenceBusy } from "@/ai/localModelManager";
import { getSelectedAIMode } from "@/services/modeSelectionService";
import { logger } from "@/utils/logger";
import { upsertSqliteVecEmbedding } from "./sqliteVec";

const MAX_CHUNK_EMBED_CHARS = 12_000;
const BATCH_SIZE = 8;
/** Yield to the UI event loop between batches. */
const BATCH_PAUSE_MS = 80;
/** Extra cooldown between batches when the device is already warm. */
const THERMAL_PAUSE_MS = 4_000;
/** Re-check delay while a user-facing inference holds the model. */
const INFERENCE_BUSY_PAUSE_MS = 2_000;
/**
 * Backfill is an optimization, never startup work: wait until the user has
 * had the app open and idle for a while before touching the embed model.
 */
const SCHEDULE_DELAY_MS = 30_000;
/** Re-check thermal state once per this many batches (native call). */
const THERMAL_CHECK_EVERY_BATCHES = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ChunkRow {
  chunk_id: string;
  section_title: string | null;
  process_name: string | null;
  content: string;
  answer: string | null;
  tags: string | null;
}

function storageModelName(capabilities: LocalAICapabilities, providerId: string): string {
  const identity = [
    capabilities.embeddingModelName?.trim() || capabilities.modelName?.trim() || providerId,
    capabilities.embeddingModelFileHash?.trim() || null,
    capabilities.embeddingDimension ? `${capabilities.embeddingDimension}d` : null
  ].filter(Boolean);

  return identity.join(":");
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
    const modelKey = storageModelName(capabilities, embedProvider.id);

    let batchIndex = 0;
    let thermalPause = false;
    for (;;) {
      // User-facing chat/embedding requests always win: back off instead of
      // queueing behind the inference lease.
      if (isLocalModelInferenceBusy()) {
        await sleep(INFERENCE_BUSY_PAUSE_MS);
        continue;
      }

      if (batchIndex % THERMAL_CHECK_EVERY_BATCHES === 0) {
        const profile = await getDeviceHardwareProfile();
        if (profile.thermalState === "critical") {
          logger.db.warn("Chunk embedding backfill paused: device thermal state is critical.");
          return;
        }
        thermalPause = profile.thermalState === "serious" || profile.thermalState === "fair";
      }
      batchIndex += 1;

      // Wait out any running animations/gestures before doing native work.
      await InteractionManager.runAfterInteractions(() => undefined);

      const pending = await db.getAllAsync<ChunkRow>(
        `SELECT c.chunk_id, c.section_title, c.process_name, c.content, c.answer, c.tags
         FROM chunks c
         LEFT JOIN chunk_embeddings ce
           ON ce.chunk_id = c.chunk_id AND ce.model_name = ?
         LEFT JOIN chunk_embedding_status ces
           ON ces.chunk_id = c.chunk_id AND ces.model_name = ?
         WHERE ce.chunk_id IS NULL
           AND IFNULL(ces.status, 'not_generated') NOT IN ('skipped', 'failed')
         LIMIT ?`,
        [modelKey, modelKey, BATCH_SIZE]
      );

      if (!pending.length) {
        break;
      }

      for (const row of pending) {
        const text = buildEmbedText(row);
        if (!text.trim()) {
          await db.runAsync(
            `INSERT INTO chunk_embedding_status (chunk_id, model_name, status, updated_at)
             VALUES (?, ?, 'skipped', CURRENT_TIMESTAMP)
             ON CONFLICT(chunk_id, model_name) DO UPDATE SET status = 'skipped', last_error = NULL, updated_at = CURRENT_TIMESTAMP`,
            [row.chunk_id, modelKey]
          );
          continue;
        }

        try {
          const vec = await embedProvider.embedText(text);
          if (!vec.length || !vec.every((n) => Number.isFinite(n))) {
            throw new Error("Invalid embedding vector");
          }
          const blob = floatsToBlob(vec);
          await db.runAsync(
            `INSERT INTO chunk_embeddings (chunk_id, model_name, embedding, dimension)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(chunk_id, model_name) DO UPDATE SET embedding = excluded.embedding, dimension = excluded.dimension`,
            [row.chunk_id, modelKey, blob, vec.length]
          );
          await upsertSqliteVecEmbedding({
            chunkId: row.chunk_id,
            db,
            dimension: vec.length,
            embedding: blob,
            modelName: modelKey
          }).catch((error) => {
            logger.db.warn("sqlite-vec embedding index update skipped.", {
              chunkId: row.chunk_id,
              error: error instanceof Error ? error.message : String(error)
            });
          });
          await db.runAsync(
            `INSERT INTO chunk_embedding_status (chunk_id, model_name, status, updated_at)
             VALUES (?, ?, 'generated', CURRENT_TIMESTAMP)
             ON CONFLICT(chunk_id, model_name) DO UPDATE SET status = 'generated', last_error = NULL, updated_at = CURRENT_TIMESTAMP`,
            [row.chunk_id, modelKey]
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await db.runAsync(
            `INSERT INTO chunk_embedding_status (chunk_id, model_name, status, last_error, updated_at)
             VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
             ON CONFLICT(chunk_id, model_name) DO UPDATE SET status = 'failed', last_error = excluded.last_error, updated_at = CURRENT_TIMESTAMP`,
            [row.chunk_id, modelKey, message]
          );
          logger.db.warn("Chunk embedding failed; skipping chunk and continuing backfill.", {
            chunkId: row.chunk_id,
            error: message
          });
        }
      }

      await sleep(thermalPause ? THERMAL_PAUSE_MS : BATCH_PAUSE_MS);
    }

    logger.db.log("Chunk embedding backfill finished or idle.", { modelKey });
  } catch (error) {
    logger.db.warn("Chunk embedding backfill skipped.", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

let backfillTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Queue the backfill well off the startup critical path: it starts only
 * after the app has been open for a while and the UI is idle. Re-calling
 * resets the delay instead of stacking runs.
 */
export function scheduleChunkEmbeddingBackfill(db: SQLiteDatabase): void {
  if (backfillTimer) {
    clearTimeout(backfillTimer);
  }
  backfillTimer = setTimeout(() => {
    backfillTimer = null;
    void InteractionManager.runAfterInteractions(() => {
      void backfillChunkEmbeddingsIfNeeded(db);
    });
  }, SCHEDULE_DELAY_MS);
}
