import AsyncStorage from "@react-native-async-storage/async-storage";

import { getDatabase } from "@/db/database";
import { tokenizeQuery } from "@/retrieval/queryNormalizer";
import type { ChatContextTurn, SearchOptions } from "@/types/search";
import { MAX_RECENT_QUESTIONS, STORAGE_KEYS } from "@/utils/constants";
import { logger } from "@/utils/logger";
import type { StudentQuestionIntent } from "./studentChatTypes";
import { clearChatFeedback } from "./chatFeedbackService";
import { clearPendingChatRequest } from "./pendingChatRequestService";
import {
  decryptPrivateText,
  encryptPrivateText,
  needsPrivateTextMigration,
  privateFtsQueryForText,
  privateKeywordsForText
} from "./privateDataCrypto";

/** Returns the student's most recently asked questions from local storage. */
export async function getRecentQuestions(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_QUESTIONS);
  if (!raw) {
    return [];
  }

  try {
    const plaintext = await decryptPrivateText(raw);
    const parsed = JSON.parse(plaintext) as unknown;
    const questions = Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
    if (needsPrivateTextMigration(raw)) {
      await AsyncStorage.setItem(STORAGE_KEYS.RECENT_QUESTIONS, await encryptPrivateText(JSON.stringify(questions)));
    }
    return questions;
  } catch (error) {
    logger.db.warn("Recent question history could not be decrypted.", {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

export async function clearRecentQuestions(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.RECENT_QUESTIONS);
}

/**
 * Prepends a new question to the history, deduplicates (case-insensitive),
 * and trims the list to MAX_RECENT_QUESTIONS.
 */
export async function saveRecentQuestion(question: string): Promise<string[]> {
  const trimmed = question.trim();
  if (!trimmed) {
    return getRecentQuestions();
  }

  const current = await getRecentQuestions();
  const next = [trimmed, ...current.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(
    0,
    MAX_RECENT_QUESTIONS
  );
  await AsyncStorage.setItem(STORAGE_KEYS.RECENT_QUESTIONS, await encryptPrivateText(JSON.stringify(next)));
  return next;
}

interface ConversationMemoryRow {
  id: number;
  question: string;
  answer: string;
  scenario: string | null;
  route: string | null;
  source_scope_json: string | null;
  score: number;
}

const MAX_MEMORY_ROWS = 80;
const MAX_RELATED_MEMORIES = 3;
const PRIVATE_KEYWORD_PATTERN = /^(?:[a-f0-9]{64})(?: [a-f0-9]{64})*$/;
let conversationMigrationPromise: Promise<void> | null = null;

async function decryptNullablePrivateText(value: string | null): Promise<string | null> {
  return value === null ? null : decryptPrivateText(value);
}

function hasPrivateKeywordIndex(value: string | null): boolean {
  return value === "" || Boolean(value && PRIVATE_KEYWORD_PATTERN.test(value));
}

async function ensureConversationMemoryEncrypted(): Promise<void> {
  if (!conversationMigrationPromise) {
    conversationMigrationPromise = (async () => {
      const db = await getDatabase();
      const rows = await db.getAllAsync<ConversationMemoryRow & { keywords: string | null }>(
        `SELECT id, question, answer, scenario, route, source_scope_json, keywords, 0 AS score
         FROM conversation_memory
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
        [MAX_MEMORY_ROWS]
      );

      for (const row of rows) {
        const requiresMigration =
          needsPrivateTextMigration(row.question) ||
          needsPrivateTextMigration(row.answer) ||
          (row.scenario !== null && needsPrivateTextMigration(row.scenario)) ||
          (row.route !== null && needsPrivateTextMigration(row.route)) ||
          (row.source_scope_json !== null && needsPrivateTextMigration(row.source_scope_json)) ||
          !hasPrivateKeywordIndex(row.keywords);
        if (!requiresMigration) continue;

        const [question, answer, scenario, route, scope] = await Promise.all([
          decryptPrivateText(row.question),
          decryptPrivateText(row.answer),
          decryptNullablePrivateText(row.scenario),
          decryptNullablePrivateText(row.route),
          decryptNullablePrivateText(row.source_scope_json)
        ]);
        const [encryptedQuestion, encryptedAnswer, encryptedScenario, encryptedRoute, encryptedScope, keywords] =
          await Promise.all([
            encryptPrivateText(question),
            encryptPrivateText(answer),
            scenario === null ? null : encryptPrivateText(scenario),
            route === null ? null : encryptPrivateText(route),
            scope === null ? null : encryptPrivateText(scope),
            privateKeywordsForText(`${question} ${answer}`)
          ]);
        await db.runAsync(
          `UPDATE conversation_memory
           SET question = ?, answer = ?, scenario = ?, route = ?, source_scope_json = ?, keywords = ?
           WHERE id = ?`,
          [encryptedQuestion, encryptedAnswer, encryptedScenario, encryptedRoute, encryptedScope, keywords, row.id]
        );
      }
    })().catch((error) => {
      conversationMigrationPromise = null;
      throw error;
    });
  }
  return conversationMigrationPromise;
}

async function decryptConversationRow(row: ConversationMemoryRow): Promise<ConversationMemoryRow> {
  const [question, answer, scenario, route, scope] = await Promise.all([
    decryptPrivateText(row.question),
    decryptPrivateText(row.answer),
    decryptNullablePrivateText(row.scenario),
    decryptNullablePrivateText(row.route),
    decryptNullablePrivateText(row.source_scope_json)
  ]);
  return { ...row, question, answer, scenario, route, source_scope_json: scope };
}

function compactMemoryText(value: string, maxLength = 700): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function sourceScopeFromIntent(intent?: StudentQuestionIntent): SearchOptions["scope"] | undefined {
  return intent?.type === "safe_question" ? intent.sourceScope : undefined;
}

function scopeMatches(row: ConversationMemoryRow, intent?: StudentQuestionIntent): boolean {
  const currentScope = sourceScopeFromIntent(intent);
  if (!currentScope) return true;
  if (!row.source_scope_json) return false;

  try {
    const previousScope = JSON.parse(row.source_scope_json) as SearchOptions["scope"];
    return Boolean(
      (!currentScope.office || previousScope?.office === currentScope.office) &&
      (!currentScope.category || previousScope?.category === currentScope.category) &&
      (!currentScope.documentId || previousScope?.documentId === currentScope.documentId)
    );
  } catch {
    return false;
  }
}

function scenarioMatches(row: ConversationMemoryRow, intent?: StudentQuestionIntent): boolean {
  if (intent?.type !== "safe_question") return true;
  return !row.scenario || row.scenario === intent.scenario || row.route === intent.route;
}

/**
 * Stricter overlap check than the previous "ANY token appears in question OR
 * answer" heuristic.
 *
 * We now require:
 *   - At least 2 distinct query tokens to appear in the memory row, OR
 *   - 1 token if the query is itself a single-token question
 *     (otherwise a one-word match like "id" pulls in unrelated rows), AND
 *   - The matched tokens must appear in the prior QUESTION (not just buried
 *     inside the answer). Matches that only live inside the previous answer
 *     are nearly always coincidental campus vocabulary, not topical reuse.
 */
function meaningfulOverlap(row: ConversationMemoryRow, question: string): boolean {
  const tokens = tokenizeQuery(question);
  if (tokens.length === 0) return false;

  const priorQuestion = row.question.toLowerCase();
  const priorAnswer = row.answer.toLowerCase();
  const distinct = new Set(tokens);
  let questionHits = 0;
  let combinedHits = 0;

  for (const token of distinct) {
    const inQuestion = priorQuestion.includes(token);
    const inAnswer = priorAnswer.includes(token);
    if (inQuestion) questionHits += 1;
    if (inQuestion || inAnswer) combinedHits += 1;
  }

  if (tokens.length === 1) {
    // Single-word queries are inherently ambiguous; require the prior question
    // to mention the same token so we don't pull random campus chitchat.
    return questionHits >= 1;
  }

  // Multi-token queries: at least one prior-question hit AND ≥2 total hits
  // across question+answer. Catches genuine follow-ups while filtering
  // single-keyword coincidences.
  return questionHits >= 1 && combinedHits >= 2;
}

async function runMemorySearch(ftsQuery: string): Promise<ConversationMemoryRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<ConversationMemoryRow>(
    `
    SELECT
      m.id,
      m.question,
      m.answer,
      m.scenario,
      m.route,
      m.source_scope_json,
      bm25(conversation_memory_fts, 8.0, 4.0, 2.0, 3.0) AS score
    FROM conversation_memory_fts
    JOIN conversation_memory m ON m.id = conversation_memory_fts.rowid
    WHERE conversation_memory_fts MATCH ?
    ORDER BY score ASC, m.created_at DESC
    LIMIT 8
    `,
    [ftsQuery]
  );
}

export async function getRelatedConversationContext(
  question: string,
  intent?: StudentQuestionIntent
): Promise<ChatContextTurn[]> {
  await ensureConversationMemoryEncrypted();
  const ftsQuery = await privateFtsQueryForText(question);
  if (!ftsQuery) return [];

  let encryptedRows: ConversationMemoryRow[] = [];
  try {
    encryptedRows = await runMemorySearch(ftsQuery);
  } catch {
    return [];
  }

  const rows = (
    await Promise.all(
      encryptedRows.map(async (row) => {
        try {
          return await decryptConversationRow(row);
        } catch (error) {
          logger.db.warn("A conversation memory row could not be decrypted.", {
            id: row.id,
            error: error instanceof Error ? error.message : String(error)
          });
          return null;
        }
      })
    )
  ).filter((row): row is ConversationMemoryRow => row !== null);

    // Tightened gating (was: `scenarioMatches OR scopeMatches`, then
    // `scopeMatches OR singleTokenOverlap`). The old OR-chain pulled in
    // memory rows from unrelated scenarios whenever scope was empty and one
    // token coincidentally appeared in the row. AGENTS.md asks us to "fetch
    // persistent prior conversation context only when it is related; avoid
    // attaching unrelated history."
    //
    // New policy:
    //   1. The row must NOT contradict the active scope (office/category/doc).
    //   2. AND the scenario must match (or the row has no recorded scenario).
    //   3. AND the query must have meaningful lexical overlap with the prior
    //      question (not just the answer).
  const related = rows
    .filter((row) => scopeMatches(row, intent))
    .filter((row) => scenarioMatches(row, intent))
    .filter((row) => meaningfulOverlap(row, question))
    .slice(0, MAX_RELATED_MEMORIES);

  if (related.length > 0) {
    return related.flatMap((row) => [
      { sender: "user" as const, text: compactMemoryText(row.question, 240) },
      { sender: "haki" as const, text: compactMemoryText(row.answer, 420) }
    ]);
  }

  return [];
}

export async function saveConversationMemory(input: {
  question: string;
  answer: string;
  intent?: StudentQuestionIntent;
}): Promise<void> {
  const question = compactMemoryText(input.question, 500);
  const answer = compactMemoryText(input.answer, 900);
  if (!question || !answer) return;

  const db = await getDatabase();
  const intent = input.intent;
  const scenario = intent?.type === "safe_question" ? intent.scenario : null;
  const route = intent?.route ?? null;
  const scope = sourceScopeFromIntent(intent);
  const [encryptedQuestion, encryptedAnswer, encryptedScenario, encryptedRoute, encryptedScope, keywords] =
    await Promise.all([
      encryptPrivateText(question),
      encryptPrivateText(answer),
      scenario === null ? null : encryptPrivateText(scenario),
      route === null ? null : encryptPrivateText(route),
      scope ? encryptPrivateText(JSON.stringify(scope)) : null,
      privateKeywordsForText(`${question} ${answer}`)
    ]);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO conversation_memory (question, answer, scenario, route, source_scope_json, keywords)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [encryptedQuestion, encryptedAnswer, encryptedScenario, encryptedRoute, encryptedScope, keywords]
    );
    await db.runAsync(
      `DELETE FROM conversation_memory
       WHERE id NOT IN (
         SELECT id FROM conversation_memory ORDER BY created_at DESC, id DESC LIMIT ?
       )`,
      [MAX_MEMORY_ROWS]
    );
  });
}

export async function clearConversationMemory(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM conversation_memory");
  });
}

export async function clearChatMemory(): Promise<void> {
  await Promise.all([
    clearRecentQuestions(),
    clearConversationMemory(),
    clearPendingChatRequest(),
    clearChatFeedback()
  ]);
}
