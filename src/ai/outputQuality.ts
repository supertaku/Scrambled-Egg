const WORD_PATTERN = /[\p{L}\p{N}'-]+/gu;
const NON_ALPHANUMERIC_PATTERN = /[^a-z0-9&]+/g;

export interface CampusGroundingQualityInput {
  answerText: string;
  question?: string;
  sourceEvidence?: string[];
}

export interface CampusGroundingQualityResult {
  ok: boolean;
  flags: string[];
}

interface UnsupportedClaimPattern {
  label: string;
  patterns: RegExp[];
  evidenceTerms: string[];
}

const TUPT_ENTITY_TERMS = [
  "tup",
  "tupt",
  "tup taguig",
  "tup-taguig",
  "technological university",
  "technological university of the philippines",
  "technological university of the philippines taguig"
];

const FOREIGN_OR_UNSUPPORTED_ENTITY_PATTERNS: UnsupportedClaimPattern[] = [
  {
    label: "Texas A&M University",
    patterns: [/\btexas\s+a\s*(?:&|and)?\s*m(?:\s+university)?\b/i, /\btamu\b/i],
    evidenceTerms: ["texas a&m", "texas a and m", "tamu"]
  },
  {
    label: "Tuscarawas University",
    patterns: [/\btuscarawas(?:\s+university)?\b/i],
    evidenceTerms: ["tuscarawas"]
  },
  {
    label: "United States campus context",
    patterns: [/\b(united states|u\.s\.a?\.?|usa|ohio)\b/i],
    evidenceTerms: ["united states", "u.s.", "usa", "ohio"]
  },
  {
    label: "foreign student conduct office",
    patterns: [/\boffice of student conduct and conflict resolution\b/i, /\bosccr\b/i],
    evidenceTerms: ["office of student conduct and conflict resolution", "osccr"]
  }
];

const UNSUPPORTED_CAMPUS_DETAIL_PATTERNS: UnsupportedClaimPattern[] = [
  {
    label: "residence hall or dormitory",
    patterns: [/\bresidence halls?\b/i, /\bdormitor(?:y|ies)\b/i, /\bdorms?\b/i],
    evidenceTerms: ["residence hall", "residence halls", "dormitory", "dormitories", "dorm"]
  },
  {
    label: "student union building",
    patterns: [/\bstudent union building\b/i],
    evidenceTerms: ["student union building"]
  },
  {
    label: "international student affairs",
    patterns: [/\binternational student affairs\b/i],
    evidenceTerms: ["international student affairs"]
  },
  {
    label: "home-country or passport requirement",
    patterns: [/\bhome country\b/i, /\bpassport\b/i],
    evidenceTerms: ["home country", "passport"]
  }
];

const CAMPUS_SCOPE_PATTERNS = [
  /\b(tup|tupt|tup[- ]taguig|technological university)\b/i,
  /\b(campus|school|classmate|professor|teacher|instructor)\b/i,
  /\b(registrar|osa|student affairs|guidance|clinic|library|cashier|accounting|canteen|department|office)\b/i,
  /\b(enrollment|student id|cor|grades?|clearance|complaints?|feedback|scholarship)\b/i
];

function normalizedWords(text: string): string[] {
  return (text.toLowerCase().match(WORD_PATTERN) ?? []).filter((word) => word.length > 0);
}

function normalizeGroundingText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\ba\s*&\s*m\b/g, "a&m")
    .replace(/\ba\s+and\s+m\b/g, "a&m")
    .replace(NON_ALPHANUMERIC_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasGroundedEvidence(term: string, evidenceText: string): boolean {
  return evidenceText.includes(normalizeGroundingText(term));
}

function isSupportedByEvidence(pattern: UnsupportedClaimPattern, evidenceText: string): boolean {
  return pattern.evidenceTerms.some((term) => hasGroundedEvidence(term, evidenceText));
}

function containsTuptEntity(text: string): boolean {
  return TUPT_ENTITY_TERMS.some((term) => hasGroundedEvidence(term, text));
}

function collectUnsupportedPatternFlags(
  answerText: string,
  evidenceText: string,
  patterns: UnsupportedClaimPattern[]
): string[] {
  const flags: string[] = [];

  for (const pattern of patterns) {
    if (pattern.patterns.some((item) => item.test(answerText)) && !isSupportedByEvidence(pattern, evidenceText)) {
      flags.push(pattern.label);
    }
  }

  return flags;
}

function collectUnsupportedUniversityClaims(answerText: string, evidenceText: string): string[] {
  const flags: string[] = [];
  const universityClaimPattern =
    /\b([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,8}\s+(?:University|College|Institute))(?:'s)?\b/g;

  for (const match of answerText.matchAll(universityClaimPattern)) {
    const claim = match[1];
    if (!claim) continue;

    const normalizedClaim = normalizeGroundingText(claim);
    if (containsTuptEntity(normalizedClaim) || hasGroundedEvidence(claim, evidenceText)) {
      continue;
    }

    flags.push(`unsupported institution claim: ${claim}`);
  }

  return flags;
}

export function isCampusFocusedQuestion(question: string): boolean {
  return CAMPUS_SCOPE_PATTERNS.some((pattern) => pattern.test(question));
}

export function validateCampusGroundingQuality(
  input: CampusGroundingQualityInput
): CampusGroundingQualityResult {
  const evidenceText = normalizeGroundingText([input.question, ...(input.sourceEvidence ?? [])].filter(Boolean).join("\n"));
  const flags = [
    ...collectUnsupportedPatternFlags(input.answerText, evidenceText, FOREIGN_OR_UNSUPPORTED_ENTITY_PATTERNS),
    ...collectUnsupportedPatternFlags(input.answerText, evidenceText, UNSUPPORTED_CAMPUS_DETAIL_PATTERNS),
    ...collectUnsupportedUniversityClaims(input.answerText, evidenceText)
  ];

  return {
    ok: flags.length === 0,
    flags: Array.from(new Set(flags))
  };
}

function hasRepeatedPhrase(words: string[], minLength: number, maxLength: number, maxRepeats: number): boolean {
  for (let length = minLength; length <= maxLength; length += 1) {
    const counts = new Map<string, number>();
    for (let index = 0; index <= words.length - length; index += 1) {
      const phrase = words.slice(index, index + length).join(" ");
      const nextCount = (counts.get(phrase) ?? 0) + 1;
      if (nextCount >= maxRepeats) {
        return true;
      }
      counts.set(phrase, nextCount);
    }
  }

  return false;
}

export function isDegenerateAssistantText(text: string): boolean {
  const words = normalizedWords(text);
  if (words.length >= 8 && hasRepeatedPhrase(words, 2, 5, 4)) {
    return true;
  }

  if (words.length < 24) {
    return false;
  }

  const uniqueRatio = new Set(words).size / words.length;
  if (words.length >= 45 && uniqueRatio < 0.24) {
    return true;
  }

  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  const highestWordShare = Math.max(...counts.values()) / words.length;
  return words.length >= 35 && highestWordShare > 0.28;
}
