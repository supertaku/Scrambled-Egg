import type { ReplyLanguage } from "./studentChatTypes";

const TAGALOG_TERMS = [
  "ako",
  "akin",
  "ang",
  "ba",
  "baka",
  "bakit",
  "dapat",
  "dito",
  "gusto",
  "hindi",
  "kailangan",
  "ka",
  "kaya",
  "ko",
  "kung",
  "lang",
  "mag",
  "magkano",
  "may",
  "meron",
  "mo",
  "naman",
  "ng",
  "pa",
  "paano",
  "pano",
  "para",
  "po",
  "pwede",
  "saan",
  "sa",
  "salamat",
  "siya",
  "sya",
  "wala"
];

const ENGLISH_TERMS = [
  "a",
  "about",
  "an",
  "and",
  "can",
  "do",
  "for",
  "help",
  "how",
  "i",
  "is",
  "me",
  "my",
  "need",
  "should",
  "the",
  "to",
  "what",
  "when",
  "where",
  "why",
  "you"
];

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}#+'-]+/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function countMatches(tokens: string[], terms: string[]): number {
  const termSet = new Set(terms);
  return tokens.filter((token) => termSet.has(token)).length;
}

export function detectReplyLanguage(value: string): ReplyLanguage {
  const tokens = tokenize(value);
  if (tokens.length === 0) return "english";

  const tagalogCount = countMatches(tokens, TAGALOG_TERMS);
  const englishCount = countMatches(tokens, ENGLISH_TERMS);

  if (tagalogCount >= 2 && englishCount >= 1) return "taglish";
  if (tagalogCount >= 2) return "tagalog";
  if (tagalogCount === 1 && englishCount >= 2) return "taglish";
  if (tagalogCount === 1 && tokens.length <= 4) return "tagalog";

  return "english";
}

export function isTagalogLike(language: ReplyLanguage): boolean {
  return language === "tagalog" || language === "taglish";
}

export function replyLanguageInstruction(language: ReplyLanguage): string {
  switch (language) {
    case "tagalog":
      return "Reply mostly in natural Tagalog. Taglish is okay for common campus or tech terms.";
    case "taglish":
      return "Reply in natural Taglish, mirroring the student's mix of English and Tagalog.";
    default:
      return "Reply in clear natural English.";
  }
}

export function speechLocaleForReplyLanguage(language: ReplyLanguage): string {
  return language === "tagalog" ? "fil-PH" : "en-PH";
}
