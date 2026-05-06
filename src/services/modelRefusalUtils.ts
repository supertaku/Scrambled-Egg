import { SAFE_LOCAL_CHAT_REFUSAL_MESSAGE } from "@/ai/prompts";

import { replyLanguageInstruction } from "./replyLanguageService";
import type { QuestionScenario, ReplyLanguage, StudentChatCapability } from "./questionIntentService";

export function looksLikeGenericSafetyRefusal(text: string): boolean {
  const normalized = text.toLowerCase();
  if (!normalized) return false;

  if (normalized.includes(SAFE_LOCAL_CHAT_REFUSAL_MESSAGE.toLowerCase())) {
    return true;
  }

  const genericSafetyTerms = [
    "harming others",
    "stalking",
    "harassment",
    "cheating",
    "privacy invasion",
    "illegal activity",
    "manipulation"
  ];
  const matchedTerms = genericSafetyTerms.filter((term) => normalized.includes(term)).length;

  return (
    matchedTerms >= 3 &&
    (normalized.includes("i can help with safe questions") ||
      normalized.includes("i can't help") ||
      normalized.includes("i cannot help") ||
      normalized.includes("not with"))
  );
}

function scenarioHintForRetry(scenario?: QuestionScenario): string {
  switch (scenario) {
    case "coding_help":
      return "This is a safe coding help request.";
    case "general_knowledge":
      return "This is a safe general knowledge request.";
    case "relationship_advice":
      return "This is a safe request for respectful relationship or boundary advice.";
    case "study_advice":
      return "This is a safe request for study or academic success advice.";
    case "wellbeing_safety":
      return "This is a safe request for general well-being, clinic, or emergency-routing guidance.";
    case "campus_office":
    case "student_admin":
    case "academic_support":
      return "This is a safe campus support question. Use source context for official details when available.";
    default:
      return "";
  }
}

export function buildSafeRetryQuestion(
  question: string,
  capability: StudentChatCapability,
  scenario?: QuestionScenario,
  language: ReplyLanguage = "english"
): string {
  const framing =
    capability === "summary"
      ? "This is a safe request for a student-friendly summary."
      : capability === "instruction"
        ? "This is a safe request for practical student instructions."
        : capability === "general_advice"
          ? "This is a safe student-life or general advice request."
          : "This is a safe student question.";
  const scenarioHint = scenarioHintForRetry(scenario);

  return [
    framing,
    scenarioHint,
    replyLanguageInstruction(language),
    "Do not refuse unless the request asks for harm, cheating, stalking, privacy invasion, illegal activity, coercion, harassment, sexual exploitation, or manipulation.",
    "Answer naturally, briefly, and helpfully. Act as a capable helper for the relevant safe field. If details are missing and truly block the answer, say the number of clarifying questions and ask 1 to 3 questions only.",
    "",
    `Student question: ${question}`
  ].filter(Boolean).join("\n");
}
