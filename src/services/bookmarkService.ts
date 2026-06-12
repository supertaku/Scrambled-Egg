import { getAppDatabase } from "@/data/appRepository";
import { logger } from "@/utils/logger";
import { decryptPrivateText, encryptPrivateText, needsPrivateTextMigration } from "./privateDataCrypto";

export interface BookmarkCitation {
  citationId: string;
  citation?: string | undefined;
  documentTitle?: string | undefined;
}

export interface SavedBookmark {
  id: number;
  question: string | null;
  answerText: string;
  citations: BookmarkCitation[];
  createdAt: string;
}

interface BookmarkRow {
  id: number;
  question: string | null;
  answer_text: string;
  citations_json: string | null;
  created_at: string;
}

function parseCitations(json: string | null): BookmarkCitation[] {
  if (!json) {
    return [];
  }
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (entry): entry is BookmarkCitation =>
        typeof entry === "object" && entry !== null && typeof (entry as BookmarkCitation).citationId === "string"
    );
  } catch {
    return [];
  }
}

const MAX_BOOKMARK_SCAN = 500;

async function rowToBookmark(row: BookmarkRow): Promise<SavedBookmark> {
  const [question, answerText, citationsJson] = await Promise.all([
    row.question === null ? null : decryptPrivateText(row.question),
    decryptPrivateText(row.answer_text),
    row.citations_json === null ? null : decryptPrivateText(row.citations_json)
  ]);
  return {
    id: row.id,
    question,
    answerText,
    citations: parseCitations(citationsJson),
    createdAt: row.created_at
  };
}

function bookmarkNeedsMigration(row: BookmarkRow): boolean {
  return (
    (row.question !== null && needsPrivateTextMigration(row.question)) ||
    needsPrivateTextMigration(row.answer_text) ||
    (row.citations_json !== null && needsPrivateTextMigration(row.citations_json))
  );
}

async function migrateBookmarkRow(row: BookmarkRow, bookmark: SavedBookmark): Promise<void> {
  if (!bookmarkNeedsMigration(row)) return;
  const db = await getAppDatabase();
  const [question, answerText, citationsJson] = await Promise.all([
    bookmark.question === null ? null : encryptPrivateText(bookmark.question),
    encryptPrivateText(bookmark.answerText),
    bookmark.citations.length ? encryptPrivateText(JSON.stringify(bookmark.citations)) : null
  ]);
  await db.runAsync(
    `UPDATE bookmarks SET question = ?, answer_text = ?, citations_json = ? WHERE id = ?`,
    [question, answerText, citationsJson, row.id]
  );
}

async function readBookmarks(maxRows?: number): Promise<SavedBookmark[]> {
  const db = await getAppDatabase();
  const limitClause = maxRows === undefined ? "" : "LIMIT ?";
  const rows = await db.getAllAsync<BookmarkRow>(
    `SELECT id, question, answer_text, citations_json, created_at
     FROM bookmarks ORDER BY created_at DESC, id DESC ${limitClause}`,
    maxRows === undefined ? [] : [maxRows]
  );
  const bookmarks: SavedBookmark[] = [];
  for (const row of rows) {
    try {
      const bookmark = await rowToBookmark(row);
      await migrateBookmarkRow(row, bookmark);
      bookmarks.push(bookmark);
    } catch (error) {
      logger.db.warn("A saved bookmark could not be decrypted.", {
        id: row.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return bookmarks;
}

/**
 * Save an answer for offline reference. Duplicate question+answer pairs are
 * collapsed onto the existing bookmark (returns its id).
 */
export async function addBookmark(input: {
  answerText: string;
  citations?: BookmarkCitation[];
  question?: string | null;
}): Promise<number> {
  const existing = await findBookmarkId(input.question ?? null, input.answerText);
  if (existing !== null) return existing;

  const db = await getAppDatabase();
  const [question, answerText, citationsJson] = await Promise.all([
    input.question == null ? null : encryptPrivateText(input.question),
    encryptPrivateText(input.answerText),
    input.citations?.length ? encryptPrivateText(JSON.stringify(input.citations)) : null
  ]);
  const result = await db.runAsync(
    `INSERT INTO bookmarks (question, answer_text, citations_json) VALUES (?, ?, ?)`,
    [question, answerText, citationsJson]
  );
  if (!result.lastInsertRowId) throw new Error("Bookmark could not be saved.");
  return result.lastInsertRowId;
}

export async function removeBookmark(id: number): Promise<void> {
  const db = await getAppDatabase();
  await db.runAsync(`DELETE FROM bookmarks WHERE id = ?`, [id]);
}

/** Newest first. */
export async function listBookmarks(): Promise<SavedBookmark[]> {
  return readBookmarks();
}

/** Returns the bookmark id when this exact answer is already saved. */
export async function findBookmarkId(question: string | null, answerText: string): Promise<number | null> {
  try {
    const bookmarks = await readBookmarks(MAX_BOOKMARK_SCAN);
    const row = bookmarks.find(
      (bookmark) => bookmark.question === question && bookmark.answerText === answerText
    );
    return row?.id ?? null;
  } catch (error) {
    logger.db.warn("Bookmark lookup failed.", {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}
