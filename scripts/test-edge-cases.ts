import seedDocuments from "../src/data/seed-documents.json";
import { unavailableCapabilities } from "../src/ai/LocalAIProvider";
import type { DeviceAIMode } from "../src/ai/DeviceAIMode";
import type { DeviceCapabilityReport } from "../src/ai/CapabilityDetector";
import { isDegenerateAssistantText, validateCampusGroundingQuality } from "../src/ai/outputQuality";
import { sanitizeAssistantText } from "../src/ai/sanitizeAssistantText";
import { safeStringArrayFromJson } from "../src/retrieval/FTSRetriever";
import { InMemoryCorpusRetriever } from "../src/retrieval/InMemoryCorpusRetriever";
import { VectorRetriever } from "../src/retrieval/VectorRetriever";
import {
  buildDeterministicCapabilityResponse,
  buildDeterministicSafeAnswerText,
  buildDeviceSpecificationResponse,
  buildProfileContextResponse,
  buildWellbeingSupportResponse
} from "../src/services/chatCapabilityService";
import { buildSafeRetryQuestion, looksLikeGenericSafetyRefusal } from "../src/services/modelRefusalUtils";
import { classifyStudentQuestionIntent } from "../src/services/questionIntentService";
import { buildUnsafeRequestMessageForCategory } from "../src/services/refusalResponseBuilder";
import { detectReplyLanguage, speechLocaleForReplyLanguage } from "../src/services/replyLanguageService";
import { replyLanguageInstruction } from "../src/services/replyLanguageService";
import type { SourceAnswerDraft } from "../src/services/sourceAnswerService";
import type { StructuredDocument } from "../src/types/document";
import type { SearchResult } from "../src/types/search";

const GENERIC_REFUSAL_BITS = [
  "I can help with safe questions",
  "harming others",
  "privacy invasion",
  "illegal activity",
  "manipulation"
];

const testMode: DeviceAIMode = {
  id: "local-safe-chat",
  label: "Test local AI",
  provenance: "Answered with safe student guidance",
  retrieverStrategy: "fts5",
  summaryProviderId: "llama-rn",
  summaryProviderName: "llama.rn GGUF",
  embeddingProviderId: null,
  embeddingProviderName: null,
  capabilities: {
    ...unavailableCapabilities([], null),
    safeChat: true,
    summary: true,
    modelName: "Llama 3.2 1B Instruct",
    modelTier: "minimum",
    contextWindowTokens: 1536
  },
  platform: "android",
  platformVersion: "35",
  detectedAt: "2026-05-06T00:00:00.000Z",
  fallbackReason: null
};

const testCapabilityReport: DeviceCapabilityReport = {
  platform: "android",
  osVersion: "35",
  baseFtsAvailable: true,
  appleFoundationModelsAvailable: false,
  llamaRnAvailable: true,
  embeddingsAvailable: false,
  safeChatAvailable: true,
  summarizationAvailable: true,
  selectedMode: testMode,
  unavailableReasons: [],
  lastCheckedAt: "2026-05-06T00:00:00.000Z",
  approximateDeviceCapability: "standard",
  memoryClass: "512MB app heap class",
  supportedAbis: ["arm64-v8a"],
  architecture: "arm64-v8a",
  memoryGB: 6,
  freeStorageGB: 12,
  lowMemory: false,
  recommendedModelTier: "minimum",
  providers: []
};

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

function embeddingBlob(values: number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * Float32Array.BYTES_PER_ELEMENT);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setFloat32(index * Float32Array.BYTES_PER_ELEMENT, value, true));
  return bytes;
}

function testSourceResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 100,
    chunkId: "feedback_sec_2",
    documentId: "tup_taguig_feedback_complaints",
    documentTitle: "TUP-Taguig Feedback and Complaints",
    documentType: "procedure",
    sectionTitle: "Public Assistance and Complaints",
    processName: "Filing a complaint",
    content: "TUP-Taguig students can submit feedback or complaints through the saved feedback and complaints procedure.",
    answer: "Use the TUP-Taguig feedback and complaints process and prepare the concern details.",
    citation: "TUP-Taguig Feedback and Complaints",
    pageNumber: null,
    category: "Student Administration",
    office: "Public Assistance and Complaints Desk",
    tags: ["feedback", "complaint", "TUP-Taguig"],
    lastUpdated: "2026-05-10",
    synonyms: ["complaints", "feedback"],
    steps: ["Prepare the concern details.", "Submit the complaint through the TUP-Taguig feedback process."],
    prerequisites: ["Specific concern details"],
    officeLocation: null,
    contactInfo: null,
    priority: 4,
    snippet: null,
    contentHighlight: null,
    bm25Score: 10,
    rankScore: 10,
    confidence: "high",
    ...overrides
  };
}

function testSourceDraft(result = testSourceResult()): SourceAnswerDraft {
  return {
    confidence: "high",
    normalizedQuestion: "how do i file a complaint",
    provenance: "Retrieved directly from source",
    reliable: true,
    results: [result],
    selectedMode: {
      mode: testMode,
      summaryProvider: null,
      embeddingProvider: null
    },
    topResult: result
  };
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

  console.log("\nTesting VectorRetriever cosine ranking...");

  const vectorRows = [
    {
      id: 1,
      chunk_id: "clinic_consultation",
      document_id: "clinic_doc",
      document_title: "Clinic Services",
      document_type: "office",
      section_title: "Medical consultation",
      process_name: "Clinic visit",
      content: "Students who feel sick can visit the TUP-Taguig Clinic for regular medical consultation.",
      answer: "Go to the TUP-Taguig Clinic for medical consultation.",
      citation: "Clinic Services",
      page_number: null,
      category: "Health",
      office: "TUP-Taguig Clinic",
      tags: "clinic health sick",
      synonyms: "hurt illness medical",
      steps: null,
      prerequisites: null,
      office_location: null,
      contact_info: null,
      priority: 4,
      last_updated: "2026-01-01",
      model_name: "test-embedder",
      embedding: embeddingBlob([1, 0, 0]),
      dimension: 3
    },
    {
      id: 2,
      chunk_id: "library_books",
      document_id: "library_doc",
      document_title: "Library",
      document_type: "office",
      section_title: "Books",
      process_name: "Borrowing",
      content: "Students can find books in the library.",
      answer: "Visit the library for books.",
      citation: "Library",
      page_number: null,
      category: "Library",
      office: "Library",
      tags: "books library",
      synonyms: "borrow reading",
      steps: null,
      prerequisites: null,
      office_location: null,
      contact_info: null,
      priority: 1,
      last_updated: "2026-01-01",
      model_name: "test-embedder",
      embedding: embeddingBlob([0, 1, 0]),
      dimension: 3
    }
  ];
  const vectorDb = {
    getAllAsync: async () => vectorRows
  };
  const vectorProvider = {
    id: "llama-rn" as const,
    name: "test-embedder",
    isAvailable: async () => true,
    getCapabilities: async () => ({
      ...unavailableCapabilities([], null),
      embeddings: true,
      providerReady: true,
      modelName: "test-embedder"
    }),
    summarizeFromSources: async () => ({
      status: "no_reliable_answer" as const,
      text: "",
      citationIds: [],
      providerId: "llama-rn" as const,
      providerName: "test-embedder"
    }),
    embedText: async () => [1, 0, 0]
  };
  const vectorResults = await new VectorRetriever(vectorDb as never, vectorProvider).search("where should I go if I feel sick?", { limit: 2 });
  failed += assertCase(
    vectorResults[0]?.chunkId === "clinic_consultation" && (vectorResults[0]?.semanticScore ?? 0) > 0.99,
    "vector retriever ranks stored embeddings by cosine similarity",
    vectorResults.map((result) => ({ chunkId: result.chunkId, semanticScore: result.semanticScore }))
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

  const awkwardAnswer = buildDeterministicSafeAnswerText("How do I handle an awkward campus situation?", "general_advice", "relationship_advice");
  failed += assertCase(/respect|boundaries|Guidance/i.test(awkwardAnswer), "awkward campus situation gets general advice", awkwardAnswer);

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
  // Regression guard: English modal phrases starting with "May" used to flip
  // the classifier to Tagalog because "may" is in the Tagalog seed list.
  failed += assertCase(
    detectReplyLanguage("May I know the registrar office hours?") === "english",
    "English 'May I' phrase is classified as English, not Tagalog"
  );
  failed += assertCase(
    detectReplyLanguage("May be I should go to OSA?") === "english",
    "English 'May be' phrase is classified as English, not Tagalog"
  );
  failed += assertCase(
    detectReplyLanguage("Maybe the clinic is open today") === "english",
    "English 'Maybe' phrase is classified as English, not Tagalog"
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

  const tagalogLostIdIntent = classifyStudentQuestionIntent("nawala ko id ko, ano dapat gawin?");
  failed += assertCase(
    tagalogLostIdIntent.type === "safe_question" &&
      tagalogLostIdIntent.route === "source_context" &&
      tagalogLostIdIntent.sourceScope?.office === "Student Affairs",
    "Tagalog lost-ID prompt routes to Student Affairs",
    tagalogLostIdIntent
  );
  failed += assertCase(
    /English only/i.test(replyLanguageInstruction("tagalog")),
    "Tagalog language instruction still enforces English-only replies"
  );

  const depressedIntent = classifyStudentQuestionIntent("im depressed");
  failed += assertCase(
    depressedIntent.type === "safe_question" && depressedIntent.scenario === "wellbeing_safety",
    "depression prompt routes to wellbeing support",
    depressedIntent
  );
  if (depressedIntent.type === "safe_question") {
    const wellbeingResponse = buildWellbeingSupportResponse("im depressed", depressedIntent, testMode);
    failed += assertCase(
      Boolean(wellbeingResponse?.answerText && /handle it alone|emergency help|trusted/i.test(wellbeingResponse.answerText)),
      "depression prompt gets supportive deterministic response",
      wellbeingResponse?.answerText
    );
  }

  const deviceIntent = classifyStudentQuestionIntent("what is my device specification?");
  failed += assertCase(
    deviceIntent.type === "safe_question" &&
      deviceIntent.route === "obvious_general" &&
      deviceIntent.scenario === "device_specification",
    "device-spec prompt routes to deterministic device specs",
    deviceIntent
  );
  const deviceResponse = buildDeviceSpecificationResponse("what is my device specification?", testMode, testCapabilityReport);
  failed += assertCase(
    /Platform: android 35|RAM: 6\.0GB|Active model: Llama 3\.2 1B/i.test(deviceResponse.answerText ?? ""),
    "device-spec prompt returns deterministic device information",
    deviceResponse.answerText
  );

  const whoAmIResponse = buildProfileContextResponse(
    "who am i",
    testMode,
    "Student profile context.\nName: Joshua\nCourse/program: BSIT\nYear level: 4th-year"
  );
  failed += assertCase(
    Boolean(whoAmIResponse?.answerText && /Name: Joshua|Course\/program: BSIT|Year level: 4th-year/i.test(whoAmIResponse.answerText)),
    "profile question uses saved profile details only",
    whoAmIResponse?.answerText
  );

  const ageResponse = buildProfileContextResponse("how old i am?", testMode, "Name: Joshua\nCourse/program: BSIT\nYear level: 4th-year");
  failed += assertCase(
    Boolean(ageResponse?.answerText && /do not have your age saved/i.test(ageResponse.answerText)),
    "age question does not infer age from year level",
    ageResponse?.answerText
  );

  failed += assertCase(
    isDegenerateAssistantText("magkakarating na magkakarating na magkakarating na magkakarating na magkakarating na"),
    "loop guard detects repeated generated phrases"
  );
  failed += assertCase(
    !isDegenerateAssistantText("Report the lost ID to OSA, bring proof of identity, and ask for the replacement steps."),
    "loop guard allows normal concise answers"
  );

  console.log("\nTesting campus hallucination guard...");

  const texasQuality = validateCampusGroundingQuality({
    answerText: "Submit it through Texas A&M University's Office of Student Conduct and Conflict Resolution.",
    question: "How do I file a complaint?",
    sourceEvidence: ["TUP-Taguig feedback and complaints procedure"]
  });
  failed += assertCase(
    !texasQuality.ok && texasQuality.flags.some((flag) => /Texas A&M|student conduct/i.test(flag)),
    "campus guard catches unsupported foreign university claims",
    texasQuality
  );

  const residenceQuality = validateCampusGroundingQuality({
    answerText: "The student union building is a short walk from your residence hall.",
    question: "Are you sure?",
    sourceEvidence: ["TUP-Taguig campus guide"]
  });
  failed += assertCase(
    !residenceQuality.ok && residenceQuality.flags.some((flag) => /student union|residence/i.test(flag)),
    "campus guard catches unsupported dormitory and student-union claims",
    residenceQuality
  );

  const userSuppliedPlaceQuality = validateCampusGroundingQuality({
    answerText: "Texas A&M University is in Texas.",
    question: "What is Texas A&M University?"
  });
  failed += assertCase(userSuppliedPlaceQuality.ok, "campus guard allows user-supplied non-TUPT places", userSuppliedPlaceQuality);

  const complaintQuestion = "How do I file a complaint?";
  const complaintQualityIntent = classifyStudentQuestionIntent(complaintQuestion);
  if (complaintQualityIntent.type === "safe_question") {
    const sourceResult = testSourceResult();
    const sourceDraft = testSourceDraft(sourceResult);
    const generatedQuality = validateCampusGroundingQuality({
      answerText: "Contact Texas A&M University's Office of Student Conduct and Conflict Resolution and bring your passport.",
      question: complaintQuestion,
      sourceEvidence: [sourceResult.content, sourceResult.answer ?? ""]
    });
    const routedFallback = !generatedQuality.ok
      ? buildDeterministicCapabilityResponse(complaintQuestion, complaintQualityIntent.capability, sourceDraft)
      : null;
    failed += assertCase(
      Boolean(routedFallback?.answerText && /Here is what you can do|Prepare the concern details/i.test(routedFallback.answerText)),
      "guarded source query falls back to deterministic source instructions",
      routedFallback?.answerText
    );
    failed += assertCase(
      Boolean(routedFallback?.answerText && !/Texas A&M|passport|OSCCR/i.test(routedFallback.answerText)),
      "deterministic fallback removes unsupported foreign-campus claims",
      routedFallback?.answerText
    );
  } else {
    failed += assertCase(false, "complaint question is safe for quality routing", complaintQualityIntent);
  }

  const ambiguousSourceIntent = {
    capability: "instruction",
    language: "english",
    route: "source_context",
    scenario: "student_admin",
    type: "safe_question"
  } as const;
  const ambiguousQuality = validateCampusGroundingQuality({
    answerText: "Go to Tuscarawas University's student union building.",
    question: "How do I process it?"
  });
  const ambiguousFallback = !ambiguousQuality.ok
    ? { answerText: "I have 1 quick question: which TUPT office, document, or process are you asking about?" }
    : null;
  failed += assertCase(
    Boolean(ambiguousFallback?.answerText && /^I have 1 quick question:/.test(ambiguousFallback.answerText)),
    "guarded ambiguous weak source query asks one clarification instead of guessing",
    ambiguousFallback?.answerText
  );

  const hurtIntent = classifyStudentQuestionIntent("If i got hurt, which office should i go?");
  failed += assertCase(
    hurtIntent.type === "safe_question" &&
      hurtIntent.route === "source_context" &&
      hurtIntent.sourceScope?.office === "Clinic",
    "hurt prompt routes to Clinic source context",
    hurtIntent
  );

  const complaintIntent = classifyStudentQuestionIntent("How do I file a complaint?");
  failed += assertCase(
    complaintIntent.type === "safe_question" &&
      complaintIntent.route === "source_context" &&
      complaintIntent.sourceScope?.documentId === "tup_taguig_feedback_complaints",
    "complaint prompt routes to saved TUPT feedback source",
    complaintIntent
  );

  const awkwardIntent = classifyStudentQuestionIntent("How do I handle an awkward campus situation?");
  failed += assertCase(
    awkwardIntent.type === "safe_question" &&
      awkwardIntent.route === "obvious_general" &&
      awkwardIntent.scenario === "relationship_advice",
    "awkward campus situation routes to general advice instead of source miss",
    awkwardIntent
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

  const slapIntent = classifyStudentQuestionIntent("what if i need to slap someone to pass the test");
  failed += assertCase(
    slapIntent.type === "unsafe_request" && slapIntent.category === "violence",
    "slap someone prompt is classified as violence",
    slapIntent
  );

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
    // Haki always replies in English (AGENTS.md). Even when the question was
    // Taglish, the refusal text must NOT contain Tagalog-only words and must
    // contain the English refusal vocabulary.
    failed += assertCase(
      /cheat|reviewer|study plan/i.test(taglishMessage) && !/hindi ako|tutulong|delikado|gets ko/i.test(taglishMessage),
      "Taglish question still receives an English refusal",
      taglishMessage
    );
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
      results[0]?.chunkId === "tup_taguig_office_of_the_student_affairs_procedures_replacement_of_lost_or_damaged_id",
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
