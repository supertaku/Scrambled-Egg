import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import { normalizeQuery } from "@/retrieval/queryNormalizer";
import type { SearchResponse, SearchResponseType } from "@/types/search";

import { detectReplyLanguage, isTagalogLike } from "./replyLanguageService";
import type { QuestionScenario, StudentChatCapability, StudentQuestionIntent } from "./studentChatTypes";

type SafeQuestionIntent = Extract<StudentQuestionIntent, { type: "safe_question" }>;

function responseFromText(input: {
  answerText: string;
  confidence?: SearchResponse["confidence"];
  mode: DeviceAIMode;
  provenance?: SearchResponse["provenance"];
  question: string;
  reliable?: boolean;
  responseType?: SearchResponseType;
}): SearchResponse {
  return {
    question: input.question,
    normalizedQuestion: normalizeQuery(input.question),
    responseType: input.responseType ?? "general_advice",
    results: [],
    confidence: input.confidence ?? "medium",
    reliable: input.reliable ?? true,
    answerText: input.answerText,
    citationsUsed: [],
    provenance: input.provenance ?? "Answered with safe student guidance",
    activeMode: input.mode
  };
}

export function extractOriginalRequest(question: string): string {
  return question
    .replace(/^Summarize this for a student in plain language\. Keep it short and actionable:\s*/i, "")
    .replace(/^Give clear step-by-step instructions or a checklist for this student request:\s*/i, "")
    .replace(/^Give safe, practical student advice for this request:\s*/i, "")
    .replace(/^Student scenario: [^\n]+\. .*?\nQuestion:\s*/i, "")
    .replace(/^Student scenario: [^\n]+\. Student request type: [^\n]+\. [^\n]*\nQuestion:\s*/i, "")
    .replace(/^Student request type: [^\n]+\. [^\n]+\nQuestion:\s*/i, "")
    .trim();
}

function extractArithmeticExpression(question: string): string | null {
  const expression = question
    .trim()
    .replace(/^(what is|calculate|solve)\s+/i, "")
    .replace(/\?+$/g, "")
    .replace(/[xX]/g, "*")
    .replace(/\s+/g, "");

  if (!expression || expression.length > 40 || !/[+\-*/]/.test(expression) || !/^[0-9+\-*/().]+$/.test(expression)) {
    return null;
  }

  return expression;
}

function evaluateArithmeticExpression(expression: string): number | null {
  let index = 0;

  function peek(): string {
    return expression[index] ?? "";
  }

  function consume(): string {
    const value = expression[index] ?? "";
    index += 1;
    return value;
  }

  function parseNumber(): number | null {
    const start = index;
    while (/\d|\./.test(peek())) consume();
    if (start === index) return null;

    const value = Number(expression.slice(start, index));
    return Number.isFinite(value) ? value : null;
  }

  function parseFactor(): number | null {
    if (peek() === "+") {
      consume();
      return parseFactor();
    }

    if (peek() === "-") {
      consume();
      const value = parseFactor();
      return value === null ? null : -value;
    }

    if (peek() === "(") {
      consume();
      const value = parseExpression();
      if (peek() !== ")") return null;
      consume();
      return value;
    }

    return parseNumber();
  }

  function parseTerm(): number | null {
    let value = parseFactor();
    if (value === null) return null;

    while (peek() === "*" || peek() === "/") {
      const operator = consume();
      const next = parseFactor();
      if (next === null || (operator === "/" && next === 0)) return null;
      value = operator === "*" ? value * next : value / next;
    }

    return value;
  }

  function parseExpression(): number | null {
    let value = parseTerm();
    if (value === null) return null;

    while (peek() === "+" || peek() === "-") {
      const operator = consume();
      const next = parseTerm();
      if (next === null) return null;
      value = operator === "+" ? value + next : value - next;
    }

    return value;
  }

  const value = parseExpression();
  return value !== null && index === expression.length ? value : null;
}

function formatArithmeticAnswer(value: number): string {
  const rounded = Math.abs(value) < 1e-10 ? 0 : value;
  return Number.isInteger(rounded) ? String(rounded) : String(Number(rounded.toFixed(6)));
}

function answerBasicMath(question: string): string | null {
  const expression = extractArithmeticExpression(question);
  if (!expression) return null;

  const value = evaluateArithmeticExpression(expression);
  return value === null ? null : `${expression.replace(/\*/g, " x ")} = ${formatArithmeticAnswer(value)}`;
}

function relationshipFallback(question: string): string {
  const normalized = normalizeQuery(question);
  const language = detectReplyLanguage(question);
  if (/\bavoid\b/.test(normalized)) {
    if (isTagalogLike(language)) {
      return "Pwede kang dumistansya nang respectful: sumama sa friends, pumili ng ibang route or seat kung kaya, keep replies short and polite, at huwag mong i-monitor kung saan siya pumupunta. Kung uncomfortable or unsafe na, lapit sa Guidance, OSA, trusted faculty, or guard.";
    }

    return "You can keep distance respectfully: stay with friends, choose different routes or seats when possible, keep replies short and polite, and do not monitor where they go. If the situation feels uncomfortable or unsafe, ask Guidance, OSA, a trusted faculty member, or a guard for help.";
  }

  if (/\bconfess|confession|umamin|ligaw\b/.test(normalized)) {
    if (isTagalogLike(language)) {
      return "Keep it simple and respectful. Humanap ng calm na public-but-not-crowded moment, sabihin mo nang diretso pero walang pressure, tapos tanggapin mo yung sagot niya clearly. Kung no or uncomfortable siya, give space and keep campus interactions polite.";
    }

    return "Keep it simple and respectful. Choose a calm public-but-not-crowded moment, say what you feel without pressuring them, and accept their answer clearly. If they say no or seem uncomfortable, give them space and keep campus interactions polite.";
  }

  if (isTagalogLike(language)) {
    return "Handle it with respect and clear boundaries. Sabihin mo nang kalmado, iwasan ang pressure or paulit-ulit na messages, and give space kung hindi siya interested. Kung stressful na, talk to a trusted friend, adviser, or Guidance.";
  }

  return "Handle it with respect and clear boundaries. Say what you mean calmly, avoid pressure or repeated messages, and give the other person space if they are not interested. If it becomes stressful, talk to a trusted friend, adviser, or Guidance.";
}

function studyFallback(question: string): string {
  const normalized = normalizeQuery(question);
  const language = detectReplyLanguage(question);
  if (/\bexam|quiz|test|final|midterm\b/.test(normalized)) {
    if (isTagalogLike(language)) {
      return "Start sa coverage, then hatiin mo into small review blocks. Unahin ang weak topics, practice old problems or sample questions, ituro mo sa sarili mo out loud, and matulog nang maayos instead of all-night cramming. Kaya mo yan \u{1F4AA}";
    }

    return "Start with the coverage, then split it into small review blocks. Prioritize weak topics, practice old problems or sample questions, teach the idea out loud, and sleep instead of cramming all night. If a topic is still unclear, ask your instructor, classmates, or adviser early.";
  }

  if (isTagalogLike(language)) {
    return "For better grades, alamin muna kung aling subjects ang humihila pababa. Gumawa ng weekly study schedule, review right after class habang fresh pa, practice instead of puro reread, submit requirements early, and ask your instructor or adviser kung ano ang dapat i-improve before the next exam.";
  }

  return "For better grades, check which subjects are pulling you down first. Make a weekly study schedule, review after class while the lesson is fresh, practice instead of only rereading, submit requirements early, and ask your instructor or adviser what to improve before the next exam or activity.";
}

type CodingLanguage = "cpp" | "csharp" | "javascript" | "python" | "sql";

function detectCodingLanguage(question: string): CodingLanguage {
  if (/(?:c#|\bcsharp\b|\bc sharp\b)/i.test(question)) return "csharp";
  if (/(?:c\+\+|\bcpp\b|\bc plus plus\b)/i.test(question)) return "cpp";
  if (/\b(sql|database query|query)\b/i.test(question)) return "sql";
  if (/\b(javascript|java script|node\.?js|js)\b/i.test(question)) return "javascript";
  if (/\bpython\b/i.test(question)) return "python";
  return "python";
}

function hasExplicitCodingLanguage(question: string): boolean {
  return /(?:\bpython\b|\bjavascript\b|\bjava script\b|\bnode\.?js\b|\bjs\b|c\+\+|\bcpp\b|\bc plus plus\b|c#|\bcsharp\b|\bc sharp\b|\bsql\b)/i.test(question);
}

function codingLanguageLabel(language: CodingLanguage): string {
  switch (language) {
    case "cpp":
      return "C++";
    case "csharp":
      return "C#";
    case "javascript":
      return "JavaScript";
    case "sql":
      return "SQL";
    default:
      return "Python";
  }
}

function sortingCodeForLanguage(language: CodingLanguage): string {
  switch (language) {
    case "javascript":
      return [
        "```javascript",
        "function sortNumbers(values) {",
        "  return [...values].sort((a, b) => a - b);",
        "}",
        "",
        "console.log(sortNumbers([5, 2, 9, 1])); // [1, 2, 5, 9]",
        "```"
      ].join("\n");
    case "cpp":
      return [
        "```cpp",
        "#include <algorithm>",
        "#include <iostream>",
        "#include <vector>",
        "",
        "std::vector<int> sortNumbers(std::vector<int> values) {",
        "    std::sort(values.begin(), values.end());",
        "    return values;",
        "}",
        "",
        "int main() {",
        "    std::vector<int> numbers = {5, 2, 9, 1};",
        "    for (int number : sortNumbers(numbers)) {",
        "        std::cout << number << \" \";",
        "    }",
        "}",
        "```"
      ].join("\n");
    case "csharp":
      return [
        "```csharp",
        "using System;",
        "using System.Linq;",
        "",
        "int[] SortNumbers(int[] values)",
        "{",
        "    return values.OrderBy(value => value).ToArray();",
        "}",
        "",
        "Console.WriteLine(string.Join(\", \", SortNumbers(new[] { 5, 2, 9, 1 })));",
        "```"
      ].join("\n");
    case "sql":
      return [
        "```sql",
        "SELECT id, name, score",
        "FROM students",
        "ORDER BY score DESC;",
        "```"
      ].join("\n");
    default:
      return [
        "```python",
        "def sort_numbers(values):",
        "    return sorted(values)",
        "",
        "numbers = [5, 2, 9, 1]",
        "print(sort_numbers(numbers))  # [1, 2, 5, 9]",
        "```"
      ].join("\n");
  }
}

function movementCodeForLanguage(language: CodingLanguage): string {
  switch (language) {
    case "javascript":
      return [
        "```javascript",
        "function move(position, dx, dy) {",
        "  return {",
        "    x: position.x + dx,",
        "    y: position.y + dy",
        "  };",
        "}",
        "",
        "console.log(move({ x: 3, y: 4 }, 2, -1)); // { x: 5, y: 3 }",
        "```"
      ].join("\n");
    case "cpp":
      return [
        "```cpp",
        "#include <iostream>",
        "",
        "struct Position {",
        "    int x;",
        "    int y;",
        "};",
        "",
        "Position move(Position current, int dx, int dy) {",
        "    return {current.x + dx, current.y + dy};",
        "}",
        "",
        "int main() {",
        "    Position next = move({3, 4}, 2, -1);",
        "    std::cout << next.x << \", \" << next.y;",
        "}",
        "```"
      ].join("\n");
    case "csharp":
      return [
        "```csharp",
        "using UnityEngine;",
        "",
        "public class PlayerMovement : MonoBehaviour",
        "{",
        "    public float speed = 5f;",
        "",
        "    void Update()",
        "    {",
        "        float horizontal = Input.GetAxisRaw(\"Horizontal\");",
        "        float vertical = Input.GetAxisRaw(\"Vertical\");",
        "        Vector3 direction = new Vector3(horizontal, 0f, vertical).normalized;",
        "",
        "        transform.Translate(direction * speed * Time.deltaTime, Space.World);",
        "    }",
        "}",
        "```"
      ].join("\n");
    case "sql":
      return [
        "```sql",
        "UPDATE player_positions",
        "SET x = x + :dx,",
        "    y = y + :dy",
        "WHERE player_id = :player_id;",
        "```"
      ].join("\n");
    default:
      return [
        "```python",
        "def move(position, dx, dy):",
        "    return {",
        "        \"x\": position[\"x\"] + dx,",
        "        \"y\": position[\"y\"] + dy,",
        "    }",
        "",
        "print(move({\"x\": 3, \"y\": 4}, 2, -1))  # {'x': 5, 'y': 3}",
        "```"
      ].join("\n");
  }
}

function starterCodeForLanguage(language: CodingLanguage): string {
  switch (language) {
    case "javascript":
      return [
        "```javascript",
        "function calculateTotal(prices) {",
        "  return prices.reduce((total, price) => total + price, 0);",
        "}",
        "",
        "console.log(calculateTotal([50, 25, 10])); // 85",
        "```"
      ].join("\n");
    case "cpp":
      return [
        "```cpp",
        "#include <iostream>",
        "#include <vector>",
        "",
        "int calculateTotal(const std::vector<int>& prices) {",
        "    int total = 0;",
        "    for (int price : prices) {",
        "        total += price;",
        "    }",
        "    return total;",
        "}",
        "",
        "int main() {",
        "    std::cout << calculateTotal({50, 25, 10});",
        "}",
        "```"
      ].join("\n");
    case "csharp":
      return [
        "```csharp",
        "using System;",
        "using System.Linq;",
        "",
        "int CalculateTotal(int[] prices)",
        "{",
        "    return prices.Sum();",
        "}",
        "",
        "Console.WriteLine(CalculateTotal(new[] { 50, 25, 10 }));",
        "```"
      ].join("\n");
    case "sql":
      return [
        "```sql",
        "SELECT student_id, SUM(amount) AS total_amount",
        "FROM payments",
        "GROUP BY student_id;",
        "```"
      ].join("\n");
    default:
      return [
        "```python",
        "def calculate_total(prices):",
        "    return sum(prices)",
        "",
        "print(calculate_total([50, 25, 10]))  # 85",
        "```"
      ].join("\n");
  }
}

function codingFallback(question: string): string {
  const normalized = normalizeQuery(question);
  const language = detectCodingLanguage(question);
  const label = codingLanguageLabel(language);
  const defaultNote = hasExplicitCodingLanguage(question) ? "" : "No language was mentioned, so I will default to Python.\n\n";

  if (/\bsort|sorting|algorithm\b/.test(normalized)) {
    return [
      `${defaultNote}Here is a simple ${label} sorting example:`,
      "",
      sortingCodeForLanguage(language),
      "",
      language === "sql"
        ? "Use `ORDER BY` when you want sorted query results."
        : "This returns a sorted result without needing extra input from the user."
    ].join("\n");
  }

  if (/\b(move|moving|movement|position)\b/i.test(question)) {
    return [
      `${defaultNote}Here is a simple ${label} movement example:`,
      "",
      movementCodeForLanguage(language),
      "",
      language === "csharp"
        ? "This version assumes Unity movement. If you mean console C#, say so and I can adjust it."
        : "This keeps the example simple: it updates a position using horizontal and vertical changes."
    ].join("\n");
  }

  return [
    `${defaultNote}Here is a simple ${label} function example:`,
    "",
    starterCodeForLanguage(language),
    "",
    "If you send the exact goal, I can adjust the function to match it."
  ].join("\n");
}

function generalKnowledgeFallback(question: string): string {
  const normalized = normalizeQuery(question);
  const language = detectReplyLanguage(question);
  if (/\bhow to run\b|\brunning\b/.test(normalized)) {
    return "Start easy: warm up for 5 minutes, jog at a pace where you can still talk, then alternate running and walking if needed. Keep your posture relaxed, land softly, and build distance slowly so you do not get injured.";
  }

  if (/\bmango\b/.test(normalized) && /\bscientific name\b/.test(normalized)) {
    return "The scientific name of the mango tree is Mangifera indica.";
  }

  if (isTagalogLike(language)) {
    return "Kaya kong tumulong sa safe general questions. I have 1 quick question: gusto mo ba ng short explanation, example, steps, or code?";
  }

  return "I can help with safe general questions too. Add the topic and the kind of answer you need, such as a short explanation, example, steps, or code.";
}

function scenarioFallbackText(
  question: string,
  capability: StudentChatCapability,
  scenario: QuestionScenario = "unknown_general"
): string {
  const request = extractOriginalRequest(question);
  const normalized = normalizeQuery(request);
  const hasQuestionText = normalized.split(" ").filter(Boolean).length > 1;
  const language = detectReplyLanguage(request);

  switch (scenario) {
    case "conversation_greeting":
      if (isTagalogLike(language)) {
        return "Hi! Haki here \u{1F60A} Pwede mo akong tanungin about TUP offices, enrollment, ID concerns, clinic or guidance help, student life, study help, or safe general questions.";
      }

      return "Hi! Ask me about TUP offices, enrollment, ID concerns, clinic or guidance help, student life, study help, or safe general questions \u{1F60A}";
    case "conversation_thanks":
      return isTagalogLike(language) ? "Walang anuman \u{1F60A} Send ka lang ulit ng question anytime." : "You're welcome. Send another question anytime \u{1F60A}";
    case "conversation_goodbye":
      return isTagalogLike(language) ? "Bye. Ingat, and come back if you need campus or study help." : "Bye. Take care, and come back if you need campus or study help.";
    case "capability_discovery":
      return "I can help with campus offices, enrollment, Registrar/OSA/Clinic/Guidance questions, canteen and org info, study advice, safe general knowledge, and simple coding or explanation requests. For official TUP requirements, I use saved campus sources when available.";
    case "clarification":
      return isTagalogLike(language)
        ? "Sure. May 1 quick question ako: anong klaseng advice ang kailangan mo - studies, campus office transaction, student life, or personal campus situation?"
        : "Sure. I have 1 quick question: what kind of advice do you need - studies, a campus office transaction, student life, or a personal campus situation?";
    case "basic_math":
      return answerBasicMath(request) ?? "I can help with simple arithmetic. Please send the numbers and operation, like `8 / 2` or `15 + 7`.";
    case "study_advice":
      return studyFallback(request);
    case "relationship_advice":
      return relationshipFallback(request);
    case "coding_help":
      return codingFallback(request);
    case "general_knowledge":
      return generalKnowledgeFallback(request);
    case "summary_or_translation":
      return "I have 2 quick questions: what text should I work on, and do you want it summarized, translated, rewritten, or grammar-checked?";
    case "creative_brainstorm":
      return "I have 3 quick questions: what is the topic, who is the audience, and what format do you want - title, caption, outline, or ideas?";
    case "adversarial":
      return "I cannot ignore Haki's safety and source rules, but I can still help with a normal campus, study, or safe general question.";
    case "off_topic_silly":
      return "I can keep it light, but I still need a clear prompt. Ask for a joke, caption, riddle, or idea and include the topic.";
    default:
      break;
  }

  if (capability === "instruction" || capability === "general_advice") {
    return hasQuestionText
      ? isTagalogLike(language)
        ? "I can help with that. May 1 quick question ako: anong goal or situation ang gusto mong unahin?"
        : "I can help with that. I have 1 quick question: what goal or situation should I focus on?"
      : isTagalogLike(language)
        ? "May 1 quick question ako: tungkol ba ito sa enrollment, office, study prep, campus rules, or personal campus situation?"
        : "I have 1 quick question: is this about enrollment, an office, study prep, campus rules, or a personal campus situation?";
  }

  return "I can help with safe general questions. If this is about an official TUP requirement, include the office, document, or process so I can check the saved campus guide.";
}

const SOURCE_MISS_INTROS = [
  "Looks like we still don't have that information in our database. Great job finding that! Let Haki's admin know via email.",
  "That detail is not in Haki's database yet. Nice catch! Please email Haki's admin so it can be reviewed and added.",
  "Haki does not have that saved source right now. Good find! Send Haki's admin an email about it.",
  "That info is still missing from the current database. Sharp catch! Let Haki's admin know through email.",
  "I checked the saved campus data and that detail is not there yet. Great eye! Please email Haki's admin.",
  "That one is not available in Haki's current database. Nice discovery! Pass it to Haki's admin by email.",
  "We have not stored that campus detail yet. Good catch! Haki's admin should hear about it through email.",
  "That answer is not in the saved database at the moment. Solid find! Please notify Haki's admin via email.",
  "Haki's database does not include that detail yet. Good spot! Send it to Haki's admin through email.",
  "That campus info is still waiting to be added to Haki. Great catch! Let the admin know via email.",
  "I cannot find that detail in the current saved sources. Nice one! Please email Haki's admin about it.",
  "That item is not covered by Haki's database yet. Great find! Flag it to Haki's admin by email.",
  "The saved campus guide does not have that information yet. Good catch! Tell Haki's admin via email.",
  "That detail is missing from the database for now. Nice catch! Let Haki's admin know by email.",
  "Haki does not have a reliable saved entry for that yet. Great job spotting the gap! Please email Haki's admin."
];

let sourceMissVariantCursor = 0;

function nextSourceMissIntro(): string {
  const intro =
    SOURCE_MISS_INTROS[sourceMissVariantCursor % SOURCE_MISS_INTROS.length] ??
    "Looks like we still don't have that information in our database. Great job finding that! Let Haki's admin know via email.";
  sourceMissVariantCursor += 1;
  return intro;
}

function sourceMissAdvice(question: string, scenario: QuestionScenario): string {
  const normalized = normalizeQuery(question);
  const asksAboutAddingUnits =
    /\b(add|adding|dagdag|magdagdag|kumuha|kuha)\b.*\b(units?|subjects?)\b|\badd load|load revision\b/i.test(question);
  const asksAboutDropping =
    /\b(dropout|drop out|mag[- ]?dropout|drop subject|dropping)\b/i.test(question);

  if (asksAboutAddingUnits) {
    return "Start with your course adviser or department. Prepare your COR, curriculum or checklist, target subject or units, and reason for adding before asking about add-load or load revision.";
  }

  if (asksAboutDropping) {
    return "Talk to your course adviser before making it final. If the reason is personal, financial, or mental load, Guidance can help you think through options, then the Registrar can confirm any official record process.";
  }

  if (scenario === "wellbeing_safety") {
    if (/\bhurt|injured|injury|accident|sick|fainted|faint|dizzy|bleeding|chest pain|difficulty breathing\b/.test(normalized)) {
      return "If you are hurt or feel sick now, ask the nearest guard, faculty member, class officer, or office staff for help and go to the Clinic if you can. For severe symptoms or danger, seek emergency help immediately.";
    }

    return "For safety, counseling, or urgent concerns, contact the relevant office directly, ask a trusted faculty member or guard for routing, and use emergency help if someone is in danger.";
  }

  if (scenario === "student_admin" && /\bregistrar|cor|tor|transcript|records?\b/.test(normalized)) {
    return "For Registrar-related questions, prepare your student ID or temporary proof of enrollment, student number, program/year level, and the document or concern you need, then verify the current requirements with the Registrar.";
  }

  if (scenario === "student_admin" && /\bid\b/.test(normalized)) {
    return "For lost, damaged, or replacement ID concerns, prepare your student number, COR or registration form, proof of payment if required, and ask OSA about temporary ID or gate-pass options.";
  }

  if (scenario === "academic_support") {
    return "If this is about grades, subjects, prerequisites, or academic standing, start with your instructor or course adviser, then verify record-related steps with the Registrar if needed.";
  }

  if (scenario === "campus_life") {
    return "Try checking with the office, unit, or campus page that owns that place, event, service, or announcement.";
  }

  return "Try asking the relevant office, checking official announcements, or sending the exact document, deadline, place, or process name to Haki's admin for review.";
}

function shouldAskSourceClarification(question: string, intent: SafeQuestionIntent): boolean {
  if (intent.route !== "source_context" || intent.sourceScope) {
    return false;
  }

  if (!["academic_support", "campus_life", "campus_office", "student_admin"].includes(intent.scenario)) {
    return false;
  }

  return /\b(how (do|can|should) i|process|procedure|steps?|requirements?)\b/i.test(question);
}

function sourceClarificationText(): string {
  return "I can check the saved TUPT sources, but I need 1 quick detail first: is this about a TUPT process, and which office or document should I look for?";
}

function sourceMissText(question: string, scenario: QuestionScenario): string {
  return `${nextSourceMissIntro()}\n\nFor now, ${sourceMissAdvice(question, scenario)}`;
}

export function buildDeterministicSafeAnswerText(
  question: string,
  capability: StudentChatCapability,
  scenario: QuestionScenario = "unknown_general"
): string {
  return scenarioFallbackText(question, capability, scenario);
}

export function buildQuickScenarioResponse(
  question: string,
  intent: SafeQuestionIntent,
  mode: DeviceAIMode
): SearchResponse | null {
  const quickScenarios = new Set<QuestionScenario>([
    "adversarial",
    "basic_math",
    "capability_discovery",
    "clarification",
    "conversation_goodbye",
    "conversation_greeting",
    "conversation_thanks"
  ]);

  if (!quickScenarios.has(intent.scenario)) return null;

  return responseFromText({
    answerText: scenarioFallbackText(question, intent.capability, intent.scenario),
    confidence: intent.scenario === "clarification" ? "low" : "medium",
    mode,
    question,
    reliable: intent.scenario !== "clarification",
    responseType: "general_advice"
  });
}

export function buildSourceMissFallbackResponse(
  question: string,
  intent: SafeQuestionIntent,
  mode: DeviceAIMode
): SearchResponse {
  if (shouldAskSourceClarification(question, intent)) {
    return responseFromText({
      answerText: sourceClarificationText(),
      confidence: "low",
      mode,
      provenance: "No reliable saved source found",
      question,
      reliable: false,
      responseType: "source"
    });
  }

  return responseFromText({
    answerText: sourceMissText(question, intent.scenario),
    confidence: "low",
    mode,
    provenance: "No reliable saved source found",
    question,
    reliable: false,
    responseType: "source"
  });
}
