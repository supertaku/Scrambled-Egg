// Concrete entity / noun keywords that signal a *new* question, not a follow-up.
const STANDALONE_ENTITY_TOKENS = [
  "tuition",
  "fee",
  "fees",
  "enrollment",
  "registrar",
  "library",
  "clinic",
  "guidance",
  "osa",
  "csso",
  "rgso",
  "scholarship",
  "schedule",
  "syllabus",
  "professor",
  "instructor",
  "course",
  "subject",
  "cor",
  "id",
  "nstp",
  "pe",
  "deadline",
  "requirement",
  "requirements",
  "office",
  "canteen"
];

function hasEntityToken(q: string): boolean {
  return STANDALONE_ENTITY_TOKENS.some((token) => new RegExp(`\\b${token}\\b`).test(q));
}

export function isFollowUpQuestion(question: string, hasPriorTurns: boolean): boolean {
  if (!hasPriorTurns) return false;

  const q = question.toLowerCase().trim();
  if (q.length === 0) return false;

  if (/\b(it|that|this|they|them|those|these)\b/.test(q) && !hasEntityToken(q)) {
    return true;
  }

  if (/^(continue|go on|please continue|tell me more|and\??|then\??|so\??)\b/.test(q)) {
    return true;
  }

  if (/^(why|what do you mean|can you explain|explain|earlier|previously)\b/.test(q) && !hasEntityToken(q)) {
    return true;
  }

  if (/^how (much|many)\b/.test(q) && !hasEntityToken(q)) {
    return true;
  }
  if (/^about\b/.test(q) && !hasEntityToken(q)) {
    return true;
  }

  const wordCount = q.split(/\s+/).length;
  const hasQuestionWord = /^(what|where|when|why|how|who|can|does|is|are|do|will)\b/.test(q);
  if (wordCount <= 2 && !hasEntityToken(q) && !hasQuestionWord) {
    return true;
  }

  return false;
}
