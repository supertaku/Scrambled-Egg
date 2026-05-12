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

// English phrases that look like Tagalog because they contain "may" (English
// modal verb) or "ka" (e.g. "okay"). When the original text starts with one
// of these patterns we discount one Tagalog match so single ambiguous tokens
// don't flip the classifier.
const ENGLISH_MODAL_PHRASE_RE =
  /^\s*(may i\b|may we\b|may the\b|i may\b|we may\b|how may\b|when may\b|may be\b|maybe\b)/i;

// Words that LOOK Tagalog (token-wise) but are unambiguously English when
// they appear with these neighbors. Each entry: a Tagalog seed token plus a
// regex; if the regex matches, we don't count that token as Tagalog.
const ENGLISH_DISAMBIGUATORS: Array<{ token: string; re: RegExp }> = [
  // "may" in English: "may I", "may be", "maybe", "I may", possessive "May"
  { token: "may", re: /\b(may i|may we|may the|may be|maybe|i may|we may|how may|when may)\b/i },
  // "para" appears in English Spanish-loan words rarely; not adding here.
  // "ka" in "okay", "kayak" (already tokenized to single "ka" only if standalone),
  //   "ka-pow" — when "ka" appears as a standalone token it's nearly always Tagalog.
];

function adjustedTagalogCount(value: string, tokens: string[], rawCount: number): number {
  if (rawCount === 0) return 0;
  let adjusted = rawCount;
  const tokenSet = new Set(tokens);

  if (ENGLISH_MODAL_PHRASE_RE.test(value) && tokenSet.has("may")) {
    adjusted -= 1;
  }

  for (const { token, re } of ENGLISH_DISAMBIGUATORS) {
    if (!tokenSet.has(token)) continue;
    if (re.test(value)) {
      // Only discount when we haven't already discounted "may" via the
      // English-modal-phrase check above.
      if (token === "may" && ENGLISH_MODAL_PHRASE_RE.test(value)) continue;
      adjusted -= 1;
    }
  }

  return Math.max(0, adjusted);
}

export function detectReplyLanguage(value: string): ReplyLanguage {
  const tokens = tokenize(value);
  if (tokens.length === 0) return "english";

  const rawTagalogCount = countMatches(tokens, TAGALOG_TERMS);
  const tagalogCount = adjustedTagalogCount(value, tokens, rawTagalogCount);
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

// Haki replies in English only (AGENTS.md). The `language` parameter is kept
// in the signature so callers don't have to thread special-cases, but the
// returned instruction is intentionally constant.
export function replyLanguageInstruction(_language: ReplyLanguage): string {
  return "Reply in clear natural English only.";
}

export function speechLocaleForReplyLanguage(language: ReplyLanguage): string {
  return language === "tagalog" ? "fil-PH" : "en-PH";
}
