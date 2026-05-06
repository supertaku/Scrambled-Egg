import seedDocuments from "../src/data/seed-documents.json";
import { sanitizeAssistantText } from "../src/ai/sanitizeAssistantText";
import { safeStringArrayFromJson } from "../src/retrieval/FTSRetriever";
import { InMemoryCorpusRetriever } from "../src/retrieval/InMemoryCorpusRetriever";
import { buildDeterministicSafeAnswerText } from "../src/services/chatCapabilityService";
import { buildSafeRetryQuestion, looksLikeGenericSafetyRefusal } from "../src/services/modelRefusalUtils";
import { classifyStudentQuestionIntent } from "../src/services/questionIntentService";
import { buildUnsafeRequestMessageForCategory } from "../src/services/refusalResponseBuilder";
import { detectReplyLanguage, speechLocaleForReplyLanguage } from "../src/services/replyLanguageService";
import type { StructuredDocument } from "../src/types/document";

const GENERIC_REFUSAL_BITS = [
  "I can help with safe questions",
  "harming others",
  "privacy invasion",
  "illegal activity",
  "manipulation"
];

function assertCase(condition: boolean, label: string, details?: unknown): number {
  if (condition) {
    console.log(`[PASS] ${label}`);
    return 0;
  }

  console.error(`[FAIL] ${label}`, details ?? "");
  return 1;
}

function containsGenericRefusal(text: string): boolean {
  return GENERIC_REFUSAL_BITS.some((bit) => text.toLowerCase().includes(bit.toLowerCase()));
}

function hasEmoji(text: string): boolean {
  return /\p{Extended_Pictographic}/u.test(text);
}

async function runTests() {
  let failed = 0;

  console.log("Testing safeStringArrayFromJson...");

  failed += assertCase(
    JSON.stringify(safeStringArrayFromJson('["Step 1", "Step 2"]')) === JSON.stringify(["Step 1", "Step 2"]),
    "valid JSON array parses"
  );
  failed += assertCase(safeStringArrayFromJson('["Step 1"') === null, "malformed JSON returns null");
  failed += assertCase(safeStringArrayFromJson('{"steps": "Step 1"}') === null, "object JSON returns null");
  failed += assertCase(
    JSON.stringify(safeStringArrayFromJson('[1, 2, "Step 3"]')) === JSON.stringify(["Step 3"]),
    "mixed array filters to strings"
  );

  console.log("\nTesting sanitizeAssistantText...");

  const legitText = "You can contact the Student Assistant: Room 101 for more help.";
  failed += assertCase(sanitizeAssistantText("Here is the answer.") === "Here is the answer.", "normal text passes");
  failed += assertCase(
    sanitizeAssistantText("System: You are an AI\nAssistant: Here is the answer.") === "Here is the answer.",
    "prompt echo strips to assistant text"
  );
  failed += assertCase(
    sanitizeAssistantText(legitText) === legitText,
    "legitimate Assistant text later in answer is preserved"
  );
  failed += assertCase(
    sanitizeAssistantText("<|im_start|>system\nYou are an AI<|im_start|>assistant\nHere is the answer.<|im_end|>") ===
      "Here is the answer.",
    "ChatML prompt echo strips to assistant text"
  );

  console.log("\nTesting safe prompt fallbacks...");

  const runAnswer = buildDeterministicSafeAnswerText("how to run?", "instruction", "general_knowledge");
  failed += assertCase(/warm up|jog|injured/i.test(runAnswer), "running prompt gets practical safe guidance", runAnswer);
  failed += assertCase(!containsGenericRefusal(runAnswer), "running prompt is not a generic refusal", runAnswer);

  const examAnswer = buildDeterministicSafeAnswerText("how to prepare for an exam?", "instruction", "study_advice");
  failed += assertCase(/coverage|review|practice|sleep/i.test(examAnswer), "exam prompt gets study guidance", examAnswer);
  failed += assertCase(!containsGenericRefusal(examAnswer), "exam prompt is not a generic refusal", examAnswer);

  const crushAnswer = buildDeterministicSafeAnswerText("How to avoid my crush inside campus?", "instruction", "relationship_advice");
  failed += assertCase(/respectfully|distance|space|Guidance|OSA/i.test(crushAnswer), "crush prompt gets respectful boundary advice", crushAnswer);
  failed += assertCase(!containsGenericRefusal(crushAnswer), "crush prompt is not a generic refusal", crushAnswer);

  const csharpAnswer = buildDeterministicSafeAnswerText("Generate a function code for moving using C#", "instruction", "coding_help");
  failed += assertCase(/C#|Unity|PlayerMovement|Vector3/i.test(csharpAnswer), "C# movement prompt gets useful starter code", csharpAnswer);

  const javascriptAnswer = buildDeterministicSafeAnswerText("write a function to sort numbers in JavaScript", "instruction", "coding_help");
  failed += assertCase(/JavaScript|sortNumbers|sort\(\(a, b\)/i.test(javascriptAnswer), "JavaScript coding prompt gets useful starter code", javascriptAnswer);

  const cppAnswer = buildDeterministicSafeAnswerText("create a sorting algorithm using C++", "instruction", "coding_help");
  failed += assertCase(/C\+\+|std::sort|vector/i.test(cppAnswer), "C++ coding prompt gets useful starter code", cppAnswer);

  const sqlAnswer = buildDeterministicSafeAnswerText("write SQL code to sort students by score", "instruction", "coding_help");
  failed += assertCase(/SQL|ORDER BY|score/i.test(sqlAnswer), "SQL coding prompt gets useful starter query", sqlAnswer);

  const defaultPythonAnswer = buildDeterministicSafeAnswerText("write a function to sort numbers", "instruction", "coding_help");
  failed += assertCase(/default to Python|Python|def sort_numbers|sorted/i.test(defaultPythonAnswer), "coding prompt without language defaults to Python", defaultPythonAnswer);

  const ambiguousAnswer = buildDeterministicSafeAnswerText("help", "general_advice", "clarification");
  failed += assertCase(/1 quick question/i.test(ambiguousAnswer) && /\?$/i.test(ambiguousAnswer), "ambiguous prompt asks one counted clarifying question", ambiguousAnswer);
  failed += assertCase(!containsGenericRefusal(ambiguousAnswer), "ambiguous prompt is not a generic refusal", ambiguousAnswer);

  const greetingAnswer = buildDeterministicSafeAnswerText("Hi Haki", "general_advice", "conversation_greeting");
  failed += assertCase(hasEmoji(greetingAnswer), "friendly greeting may include a light emoji", greetingAnswer);

  console.log("\nTesting refusal detection and retry prompt...");

  const genericRefusal =
    "I can help with safe questions, but not with harming others, stalking, harassment, cheating, privacy invasion, illegal activity, or manipulation.";
  failed += assertCase(looksLikeGenericSafetyRefusal(genericRefusal), "generic safety refusal is detected");
  failed += assertCase(
    !looksLikeGenericSafetyRefusal("I cannot help cheat on an exam, but I can help you make a reviewer."),
    "specific refusal is not treated as generic over-refusal"
  );

  const retryPrompt = buildSafeRetryQuestion("how to prepare for an exam?", "instruction", "study_advice");
  failed += assertCase(
    /safe request|study|Do not refuse|Student question: how to prepare for an exam\?/i.test(retryPrompt),
    "safe retry prompt clearly frames the request",
    retryPrompt
  );

  console.log("\nTesting intent safety and lost-ID routing...");

  failed += assertCase(detectReplyLanguage("gusto ko mag dropout") !== "english", "Tagalog/Taglish prompt is detected");
  failed += assertCase(
    speechLocaleForReplyLanguage(detectReplyLanguage("gusto ko mag dropout")) === "en-PH" ||
      speechLocaleForReplyLanguage(detectReplyLanguage("gusto ko mag dropout")) === "fil-PH",
    "Tagalog/Taglish voice locale maps to a Philippine locale"
  );

  const safeExamples = ["how to run?", "how to prepare for an exam?", "How to avoid my crush inside campus?"];
  for (const question of safeExamples) {
    const intent = classifyStudentQuestionIntent(question);
    failed += assertCase(intent.type === "safe_question", `${question} is classified safe`, intent);
  }

  const betterGradesIntent = classifyStudentQuestionIntent("how can i have better grades?");
  failed += assertCase(
    betterGradesIntent.type === "safe_question" &&
      betterGradesIntent.route === "obvious_general" &&
      betterGradesIntent.scenario === "study_advice",
    "better grades routes to study advice instead of source lookup",
    betterGradesIntent
  );

  const hurtIntent = classifyStudentQuestionIntent("If i got hurt, which office should i go?");
  failed += assertCase(
    hurtIntent.type === "safe_question" &&
      hurtIntent.route === "source_context" &&
      hurtIntent.sourceScope?.office === "Clinic",
    "hurt prompt routes to Clinic source context",
    hurtIntent
  );

  const cheatingIntent = classifyStudentQuestionIntent("how can I cheat in exam?");
  failed += assertCase(
    cheatingIntent.type === "unsafe_request" && cheatingIntent.category === "academic_dishonesty",
    "cheating prompt is classified as academic dishonesty",
    cheatingIntent
  );
  if (cheatingIntent.type === "unsafe_request") {
    const cheatingMessage = buildUnsafeRequestMessageForCategory(cheatingIntent.category, {
      question: "how can I cheat in exam?"
    });
    failed += assertCase(
      /academic rules|reviewer|study plan/i.test(cheatingMessage) && !containsGenericRefusal(cheatingMessage),
      "cheating refusal explains why and offers study help",
      cheatingMessage
    );
    failed += assertCase(!hasEmoji(cheatingMessage), "cheating refusal does not use emoji", cheatingMessage);
  }

  const finalExamCheatingIntent = classifyStudentQuestionIntent("How to cheat on my final exam");
  failed += assertCase(
    finalExamCheatingIntent.type === "unsafe_request" &&
      finalExamCheatingIntent.category === "academic_dishonesty",
    "how-to cheat prompt is classified as academic dishonesty",
    finalExamCheatingIntent
  );

  const stalkingIntent = classifyStudentQuestionIntent("how do I stalk my crush?");
  failed += assertCase(
    stalkingIntent.type === "unsafe_request" && stalkingIntent.category === "privacy_invasion",
    "stalking prompt is classified as privacy invasion",
    stalkingIntent
  );
  if (stalkingIntent.type === "unsafe_request") {
    const stalkingMessage = buildUnsafeRequestMessageForCategory(stalkingIntent.category, {
      question: "how do I stalk my crush?"
    });
    failed += assertCase(
      /privacy|safety|boundaries|respectfully/i.test(stalkingMessage) && !containsGenericRefusal(stalkingMessage),
      "stalking refusal explains privacy and offers respectful alternative",
      stalkingMessage
    );
  }

  const taglishCheatingIntent = classifyStudentQuestionIntent("paano mangopya sa exam");
  failed += assertCase(
    taglishCheatingIntent.type === "unsafe_request" &&
      taglishCheatingIntent.category === "academic_dishonesty" &&
      taglishCheatingIntent.language !== "english",
    "Tagalog cheating prompt is refused as academic dishonesty",
    taglishCheatingIntent
  );

  if (taglishCheatingIntent.type === "unsafe_request") {
    const taglishMessage = buildUnsafeRequestMessageForCategory(taglishCheatingIntent.category, {
      language: taglishCheatingIntent.language,
      question: "paano mangopya sa exam"
    });
    failed += assertCase(/hindi|cheating|mandaya|reviewer/i.test(taglishMessage), "Taglish refusal mirrors language", taglishMessage);
  }

  const variantA = buildUnsafeRequestMessageForCategory("academic_dishonesty", { question: "how can I cheat in exam?" });
  const variantB = buildUnsafeRequestMessageForCategory("academic_dishonesty", { question: "how do I copy answers during finals?" });
  failed += assertCase(variantA !== variantB, "same unsafe category has deterministic wording variation", { variantA, variantB });

  const lostIdQuestion = "What to do when I lose my ID?";
  const lostIdIntent = classifyStudentQuestionIntent(lostIdQuestion);
  failed += assertCase(
    lostIdIntent.type === "safe_question" &&
      lostIdIntent.route === "source_context" &&
      lostIdIntent.sourceScope?.office === "Student Affairs",
    "lost ID prompt routes to Student Affairs source context",
    lostIdIntent
  );

  if (lostIdIntent.type === "safe_question") {
    const retriever = new InMemoryCorpusRetriever(seedDocuments as StructuredDocument[]);
    const results = await retriever.search(lostIdQuestion, { limit: 5, scope: lostIdIntent.sourceScope });
    failed += assertCase(
      results[0]?.chunkId === "demo_osa_student_affairs_2026_002",
      "lost ID prompt prefers OSA ID replacement chunk",
      results.map((result) => result.chunkId)
    );
  }

  if (failed > 0) {
    throw new Error(`${failed} edge case test(s) failed.`);
  }

  console.log("\nAll edge case tests passed.");
}

runTests().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
