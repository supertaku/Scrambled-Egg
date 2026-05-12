const STOP_WORDS = new Set([
  // English stop words
  "a",
  "an",
  "and",
  "about",
  "are",
  "as",
  "at",
  "be",
  "can",
  "campus",
  "could",
  "do",
  "does",
  "for",
  "from",
  "get",
  "give",
  "go",
  "going",
  "got",
  "how",
  "i",
  "if",
  "in",
  "is",
  "me",
  "my",
  "need",
  "of",
  "office",
  "on",
  "or",
  "please",
  "pls",
  "school",
  "should",
  "student",
  "students",
  "the",
  "there",
  "to",
  // "tup" / "tupt" intentionally NOT stop words: removing them used to throw
  // away the school name disambiguation token, so titles like "TUP Manila
  // Enrollment 2024" lost their BM25 title-token boost. They contribute
  // signal when present and are harmless when not.
  "university",
  "what",
  "where",
  "which",
  "who",
  "would",
  "with",
  // Tagalog / Filipino stop words and question words
  // Added so Taglish queries (e.g. "Paano mag-enroll sa TUPT?") don't pollute FTS tokens.
  "ang",
  "ano",
  "at",
  "ay",
  "ba",
  "dito",
  "ito",
  "ko",
  "kung",
  "lang",
  "mga",
  "mo",
  "na",
  "ng",
  "nito",
  "pa",
  "paano",
  "po",
  "sa",
  "saan",
  "sino",
  "yan",
  "yung"
]);

export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeQuery(query: string): string[] {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return [];
  }

  const tokens = normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !STOP_WORDS.has(token));

  return Array.from(new Set(tokens)).slice(0, 10);
}

import { buildExpandedTokenQuery } from "./synonymIndex";

export function buildSafeFtsQueries(query: string): string[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) {
    return [];
  }

  const strictAnd = tokens.map((token) => `${token}*`).join(" ");
  const expandedOr = tokens.map((token) => buildExpandedTokenQuery(token)).join(" AND ");
  const broadOr = tokens.map((token) => `${token}*`).join(" OR ");

  if (tokens.length === 1) {
    const singleToken = tokens[0];
    if (!singleToken) {
      return [];
    }
    const singleExpanded = buildExpandedTokenQuery(singleToken);
    return [singleExpanded, strictAnd];
  }

  const phrase = `"${tokens.join(" ")}"`;
  
  // Strategy order: Phrase/Strict -> Expanded AND -> Broad OR
  return [
    `${phrase} OR ${strictAnd}`,
    expandedOr,
    strictAnd,
    broadOr
  ];
}
