import type { QuestionRoute, QuestionScenario, SourceScope } from "./studentChatTypes";

const GREETING_PATTERNS = [
  /^(hi|hello|hey|yo|good morning|good afternoon|good evening|kumusta|kamusta|musta)( haki)?[!. ]*$/i,
  /^(hi|hello|hey)[, ]+haki[!. ]*$/i
];

const THANKS_PATTERNS = [
  /^(thanks|thank you|ty|salamat|salamat po|okay thanks|ok thanks)[!. ]*$/i
];

const GOODBYE_PATTERNS = [
  /^(bye|goodbye|see you|see ya|later|exit|paalam|sige bye)[!. ]*$/i
];

const CAPABILITY_DISCOVERY_PATTERNS = [
  /\b(what can you do|what do you do|who are you|what is haki|help topics|sample questions?)\b/i,
  /\b(can you help me|what can i ask)\b/i
];

const CLARIFICATION_PATTERNS = [
  /^(help|help me|advice|tips|question|\?|can i ask|can i ask for advice|can i ask for an advice|i need advice|advise me)[?.! ]*$/i,
  /^(what should i do|where should i go)[?.! ]*$/i,
  /^(pwede magtanong|pwede ba magtanong|may tanong ako|hingi advice|pahingi advice|ano gagawin ko)[?.! ]*$/i
];

const DEVICE_SPECIFICATION_PATTERNS = [
  /\b(device|phone|hardware|system)\b.*\b(spec|specs|specification|specifications|capability|capabilities|status|ram|storage|model)\b/i,
  /\b(what is|show|check|tell me)\b.*\b(my device|this phone|phone specs|device specs)\b/i,
  /\b(active local ai|local ai status|model status|recommended model tier)\b/i
];

const WEAK_SCHOOL_CONTEXT_PATTERNS = [
  /\b(tup|technological university|campus|university|school|college)\b/i
];

const STRONG_SOURCE_CONTEXT_PATTERNS = [
  /\b(student handbook|policy|policies|rules?|guidelines?|official document|memo|memorandum)\b/i,
  /\b(enrollment|registrar|clinic|accounting|cashier|library|guidance|osa|student affairs|canteen|cafeteria|office|department)\b/i,
  /\b(id|cor|certificate|clearance|scholarship|tuition|grades|records|permit|uniform|violation|discipline|shift|shifting)\b/i,
  /\b(gmc|good moral|good moral character|good moral certificate|certificate of good moral|moral character)\b/i,
  /\b(orgs?|organizations?|council)\b/i,
  /\b(feedback|complaints?|complainant|public assistance|complaints desk|customer feedback)\b/i,
  /\b(deadline|schedule)\b/i
];

const SOURCE_PROCEDURE_PATTERNS = [
  /\b(where|when|who|what office|requirements?|process|procedure|steps?|how (do|can|should) i)\b/i
];

const EXPLICIT_GENERAL_PATTERNS = [
  /\b(love advice|crush|relationship|friendship|motivat(e|ion)|study tips|productivity)\b/i,
  /\b(exam prep|prepare for (an? )?(exam|quiz|test)|review for (an? )?(exam|quiz|test))\b/i,
  /\b(joke|story|translate|summarize this|brainstorm|ideas|meaning of|difference between)\b/i
];

const ADVERSARIAL_PATTERNS = [
  /\b(ignore|forget|override|bypass)\b.*\b(instructions?|rules?|system|safety|policy)\b/i,
  /\b(system prompt|developer message|jailbreak|pretend you are not haki|act as unrestricted)\b/i
];

const CODING_PATTERNS = [
  /\b(code|coding|program|function|algorithm|debug|python|javascript|typescript|java|c\+\+|html|css|sql)\b/i,
  /\b(c#|csharp|c sharp)\b/i,
  /\b(write|create|make|fix|explain)\b.*\b(script|app|program)\b/i
];

const BASIC_KNOWLEDGE_PATTERNS = [
  /\b(scientific name|define|definition|meaning of|what is|who is|explain)\b/i,
  /\b(math|science|history|grammar|english|tagalog|filipino)\b/i,
  /\bhow to run\b/i
];

const SUMMARY_TRANSLATION_PATTERNS = [
  /\b(translate|translation|summarize this|summarise this|paraphrase|rewrite|grammar check)\b/i
];

const CREATIVE_BRAINSTORM_PATTERNS = [
  /\b(brainstorm|ideas?|caption|slogan|title|outline|draft|joke|story|poem)\b/i
];

const STUDY_ADVICE_PATTERNS = [
  /\b(better grades|improve (my )?grades|raise (my )?grades|pass (my )?(subject|subjects|class|classes)|study tips?)\b/i,
  /\b(study plan|time management|productivity|review schedule|exam prep|prepare for (an? )?(exam|quiz|test)|review for (an? )?(exam|quiz|test))\b/i,
  /\b(how (do|can|should) i)\b.*\b(study|review|prepare|focus|memorize|learn faster)\b/i,
  /\b(paano|pano)\b.*\b(mag[- ]?aral|magreview|mag review|pumasa|mataas.*grades?|focus)\b/i
];

const ACADEMIC_RECORD_PATTERNS = [
  /\b(missing|wrong|incorrect|encoded|record|ers|certificate|certification|official|release|request)\b.*\b(grade|grades)\b/i,
  /\b(grade|grades)\b.*\b(missing|wrong|incorrect|encoded|record|ers|certificate|certification|official|release|request)\b/i,
  /\b(inc|incomplete|failed subject|failing subject|drop|dropping|dropout|drop out|adviser|advisor|curriculum|prerequisite|petition|overload|underload|add units?|adding units?|add load|load revision)\b/i,
  /\b(gusto ko|balak ko|pwede ba)\b.*\b(mag[- ]?dropout|mag drop out|dropout|drop subject|magdagdag.*units?|add units?)\b/i,
  /\b(dagdag|magdagdag|kumuha|kuha)\b.*\b(units?|subjects?)\b/i
];

export const LOST_ID_PATTERNS = [
  /\b(lost|lose|missing|misplaced|damaged|broken|replace|replacement|temporary)\b.*\b(id|student id|school id|identification)\b/i,
  /\b(id|student id|school id|identification)\b.*\b(lost|missing|misplaced|damaged|broken|replace|replacement|temporary)\b/i,
  /\b(nawala|naiwala|nawawala|wala|nasira|sira)\b.*\b(id|student id|school id|identification)\b/i,
  /\b(id|student id|school id|identification)\b.*\b(nawala|naiwala|nawawala|wala|nasira|sira)\b/i
];

const HEALTH_SAFETY_PATTERNS = [
  /\b(hurt|injured|injury|accident|sick|ill|fainted|faint|dizzy|clinic|medical|dental|tooth|first aid|bleeding|chest pain|difficulty breathing)\b/i,
  /\b(emergency|urgent|fire|earthquake|threat|hazard|unsafe|broken lights?|leak|security|guard)\b/i
];

const GUIDANCE_WELLBEING_PATTERNS = [
  /\b(guidance|counseling|counselling|counselor|mental health|stress|anxiety|burnout|overwhelmed|personal problem|family problem|grief|depressed|depression|lonely|hopeless)\b/i,
  /\b(ayoko na|pagod na ako|gusto ko mawala|di ko na kaya|hindi ko na kaya)\b/i
];

const FEEDBACK_COMPLAINT_PATTERNS = [
  /\b(feedback|complaints?|complainant|complaints desk|customer feedback|public assistance)\b/i,
  /\b(file|send|submit|process|processed|handle|report)\b.*\b(complaints?|feedback)\b/i
];

const GOOD_MORAL_PATTERNS = [
  /\b(good moral|good moral character|good moral certificate|gmc|certificate of good moral|moral character)\b/i,
  /\b(request|get|secure|apply|process|procedure|requirements?)\b.*\b(good moral|good moral certificate|gmc|moral character)\b/i
];

const REGISTRAR_PATTERNS = [
  /\b(registrar|cor|certificate of registration|tor|transcript|school records?|academic records?|honorable dismissal|graduation|shift|shifting|transfer program)\b/i
];

const OSA_PATTERNS = [
  /\b(osa|student affairs|student welfare|student services|scholarship|organization|organizations|orgs?|club|clubs|discipline|orientation)\b/i
];

const ACCOUNTING_PATTERNS = [
  /\b(accounting|cashier|payment|tuition|assessment|balance|billing|financial hold|receipt|clearance hold)\b/i
];

const LIBRARY_PATTERNS = [
  /\b(library|borrow books?|return books?|research help|journal|journals|references|library clearance)\b/i
];

const UITC_PATTERNS = [
  /\b(uitc|ers|student portal|portal|account|password|login|log in|system access|email account)\b/i
];

const ACADEMIC_DEPARTMENT_PATTERNS = [
  /\b(department|chair|course adviser|course advisor|adviser|advisor|subject enlistment|closed section|petition subject|prerequisite|curriculum|overload|underload|add units?|adding units?|add load|load revision)\b/i,
  /\b(dagdag|magdagdag|kumuha|kuha)\b.*\b(units?|subjects?)\b/i
];

const IRJP_PATTERNS = [
  /\b(irjp|ojt|internship|job placement|career fair|resume|interview|industrial training)\b/i
];

const ADMISSIONS_PATTERNS = [
  /\b(admission|admissions|applicant|notice of admission|freshman|first[- ]year|enroll|enrollment)\b/i
];

const CAMPUS_LIFE_PATTERNS = [
  /\b(canteen|cafeteria|food|dining|lunch|snack|events?|student life|campus life|parking|transport|map|directions?|where is|location|facility|facilities|comfort room|class suspension|announcement|advisory)\b/i
];

const RELATIONSHIP_PATTERNS = [
  /\b(crush|confess|confession|relationship|love advice|friendship|avoid someone|avoid my|classmate conflict|roommate|boundaries|personal space)\b/i,
  /\b(awkward|uncomfortable|embarrassing)\b.*\b(campus|school|class|classmate|situation)\b/i,
  /\b(ligaw|umamin|iwasan|iniiwasan|kaibigan|kaklase|personal space)\b/i
];

const SILLY_PATTERNS = [
  /\b(lol|haha|random|roast me|sing a song|meme|riddle)\b/i
];

const SOURCE_SCENARIOS = new Set<QuestionScenario>([
  "academic_support",
  "campus_life",
  "campus_office",
  "student_admin",
  "wellbeing_safety"
]);

const OBVIOUS_GENERAL_SCENARIOS = new Set<QuestionScenario>([
  "adversarial",
  "basic_math",
  "capability_discovery",
  "clarification",
  "coding_help",
  "conversation_goodbye",
  "conversation_greeting",
  "conversation_thanks",
  "creative_brainstorm",
  "device_specification",
  "general_knowledge",
  "off_topic_silly",
  "relationship_advice",
  "study_advice",
  "summary_or_translation"
]);

export function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function isBasicArithmeticQuestion(question: string): boolean {
  const compact = question
    .replace(/^(what is|calculate|solve)\s+/i, "")
    .replace(/\?+$/g, "")
    .replace(/\s+/g, "");

  return (
    compact.length > 0 &&
    compact.length <= 40 &&
    /[0-9]/.test(compact) &&
    /[+\-*/xX]/.test(compact) &&
    /^[0-9+\-*/xX().]+$/.test(compact)
  );
}

export function classifyQuestionScenario(question: string): QuestionScenario {
  const normalized = question.trim();
  if (!normalized) return "clarification";

  if (matchesAny(normalized, GREETING_PATTERNS)) return "conversation_greeting";
  if (matchesAny(normalized, THANKS_PATTERNS)) return "conversation_thanks";
  if (matchesAny(normalized, GOODBYE_PATTERNS)) return "conversation_goodbye";
  if (matchesAny(normalized, CAPABILITY_DISCOVERY_PATTERNS)) return "capability_discovery";
  if (matchesAny(normalized, CLARIFICATION_PATTERNS)) return "clarification";
  if (matchesAny(normalized, DEVICE_SPECIFICATION_PATTERNS)) return "device_specification";
  if (isBasicArithmeticQuestion(normalized)) return "basic_math";
  if (matchesAny(normalized, ADVERSARIAL_PATTERNS)) return "adversarial";
  if (matchesAny(normalized, LOST_ID_PATTERNS)) return "student_admin";
  if (matchesAny(normalized, FEEDBACK_COMPLAINT_PATTERNS)) return "student_admin";
  if (matchesAny(normalized, GOOD_MORAL_PATTERNS)) return "student_admin";
  if (matchesAny(normalized, HEALTH_SAFETY_PATTERNS) || matchesAny(normalized, GUIDANCE_WELLBEING_PATTERNS)) {
    return "wellbeing_safety";
  }

  const hasOfficeSignal =
    matchesAny(normalized, REGISTRAR_PATTERNS) ||
    matchesAny(normalized, OSA_PATTERNS) ||
    matchesAny(normalized, ACCOUNTING_PATTERNS) ||
    matchesAny(normalized, LIBRARY_PATTERNS) ||
    matchesAny(normalized, UITC_PATTERNS) ||
    matchesAny(normalized, ACADEMIC_DEPARTMENT_PATTERNS) ||
    matchesAny(normalized, IRJP_PATTERNS) ||
    matchesAny(normalized, ADMISSIONS_PATTERNS);

  if (hasOfficeSignal) {
    return matchesAny(normalized, REGISTRAR_PATTERNS) ||
      matchesAny(normalized, ADMISSIONS_PATTERNS) ||
      matchesAny(normalized, ACADEMIC_RECORD_PATTERNS)
      ? "student_admin"
      : "campus_office";
  }

  if (matchesAny(normalized, ACADEMIC_RECORD_PATTERNS)) return "academic_support";
  if (matchesAny(normalized, STUDY_ADVICE_PATTERNS)) return "study_advice";
  if (matchesAny(normalized, RELATIONSHIP_PATTERNS)) return "relationship_advice";
  if (matchesAny(normalized, CAMPUS_LIFE_PATTERNS)) return "campus_life";
  if (matchesAny(normalized, CODING_PATTERNS)) return "coding_help";
  if (matchesAny(normalized, SUMMARY_TRANSLATION_PATTERNS)) return "summary_or_translation";
  if (matchesAny(normalized, CREATIVE_BRAINSTORM_PATTERNS)) return "creative_brainstorm";
  if (matchesAny(normalized, BASIC_KNOWLEDGE_PATTERNS)) return "general_knowledge";
  if (matchesAny(normalized, SILLY_PATTERNS)) return "off_topic_silly";

  return "unknown_general";
}

export function classifyRouteForScenario(question: string, scenario: QuestionScenario): QuestionRoute {
  if (matchesAny(question, LOST_ID_PATTERNS)) return "source_context";
  if (matchesAny(question, FEEDBACK_COMPLAINT_PATTERNS)) return "source_context";
  if (OBVIOUS_GENERAL_SCENARIOS.has(scenario)) return "obvious_general";
  if (SOURCE_SCENARIOS.has(scenario)) return "source_context";

  const hasStrongSourceSignal = matchesAny(question, STRONG_SOURCE_CONTEXT_PATTERNS);
  const hasSourceProcedureSignal = matchesAny(question, SOURCE_PROCEDURE_PATTERNS);
  const hasWeakSchoolSignal = matchesAny(question, WEAK_SCHOOL_CONTEXT_PATTERNS);
  const hasGeneralSignal = matchesAny(question, EXPLICIT_GENERAL_PATTERNS);

  if (hasGeneralSignal && !hasStrongSourceSignal) return "obvious_general";
  if (hasStrongSourceSignal || (hasWeakSchoolSignal && hasSourceProcedureSignal)) return "source_context";

  return "obvious_general";
}

export function sourceScopeForQuestionScenario(question: string, scenario: QuestionScenario): SourceScope | undefined {
  if (matchesAny(question, LOST_ID_PATTERNS)) return { office: "Student Affairs" };
  if (matchesAny(question, FEEDBACK_COMPLAINT_PATTERNS)) return { documentId: "tup_taguig_feedback_complaints" };
  if (matchesAny(question, GOOD_MORAL_PATTERNS)) return { office: "Student Affairs" };

  const scopeMatches = [
    matchesAny(question, HEALTH_SAFETY_PATTERNS),
    matchesAny(question, GUIDANCE_WELLBEING_PATTERNS),
    matchesAny(question, REGISTRAR_PATTERNS),
    matchesAny(question, OSA_PATTERNS),
    matchesAny(question, ACCOUNTING_PATTERNS),
    matchesAny(question, LIBRARY_PATTERNS),
    matchesAny(question, UITC_PATTERNS),
    matchesAny(question, ACADEMIC_DEPARTMENT_PATTERNS),
    matchesAny(question, IRJP_PATTERNS),
    matchesAny(question, ADMISSIONS_PATTERNS)
  ].filter(Boolean).length;

  if (scopeMatches > 1) return undefined;

  if (matchesAny(question, HEALTH_SAFETY_PATTERNS)) return { office: "Clinic" };
  if (matchesAny(question, GUIDANCE_WELLBEING_PATTERNS)) return { office: "Guidance" };
  if (matchesAny(question, REGISTRAR_PATTERNS)) return { office: "Registrar" };
  if (matchesAny(question, OSA_PATTERNS)) return { office: "Student Affairs" };
  if (matchesAny(question, ACCOUNTING_PATTERNS)) return { office: "Accounting" };
  if (matchesAny(question, LIBRARY_PATTERNS)) return { office: "Library" };
  if (matchesAny(question, UITC_PATTERNS)) return { office: "University Information Technology Center" };
  if (matchesAny(question, ACADEMIC_DEPARTMENT_PATTERNS)) return { office: "Academic Department" };
  if (matchesAny(question, IRJP_PATTERNS)) return { office: "IRJP" };
  if (matchesAny(question, ADMISSIONS_PATTERNS)) return { office: "Admissions" };
  if (
    scenario === "campus_life" &&
    /\b(facility|facilities|parking|transport|map|directions?|location|where is|class suspension|announcement|advisory)\b/i.test(question)
  ) {
    return { office: "Administration" };
  }

  return undefined;
}

export function isCodingScenario(scenario: QuestionScenario): boolean {
  return scenario === "coding_help";
}

export function isGeneralResponseScenario(scenario: QuestionScenario): boolean {
  return OBVIOUS_GENERAL_SCENARIOS.has(scenario);
}
