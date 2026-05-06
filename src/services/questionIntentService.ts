import {
  classifyQuestionScenario,
  classifyRouteForScenario,
  isCodingScenario,
  isGeneralResponseScenario,
  matchesAny,
  sourceScopeForQuestionScenario
} from "./questionScenarioService";
import { detectReplyLanguage } from "./replyLanguageService";
import type {
  QuestionRoute,
  QuestionScenario,
  ReplyLanguage,
  SafetyCategory,
  SourceScope,
  StudentChatCapability,
  StudentQuestionIntent
} from "./studentChatTypes";

export type {
  QuestionRoute,
  QuestionScenario,
  ReplyLanguage,
  SafetyCategory,
  SourceScope,
  StudentChatCapability,
  StudentQuestionIntent
} from "./studentChatTypes";

const IMAGE_GENERATION_PATTERNS = [
  /\b(generate|create|make|draw|design)\b.*\b(image|picture|photo|poster|banner|logo|sticker|illustration|infographic)\b/i,
  /\b(image generator|text to image|ai art|poster draft|visual aid)\b/i
];

const SUMMARY_PATTERNS = [
  /\b(summarize|summary|recap|tl;dr|tldr|key points|main points|short version)\b/i
];

const INSTRUCTION_PATTERNS = [
  /\b(step by step|steps?|procedure|process|guide|instructions?|checklist|requirements?)\b/i,
  /\b(how to|how (do|can|should) i|what to do|what should i do|what do i need|proper way to)\b/i
];

const GENERAL_ADVICE_PATTERNS = [
  /\b(advice|tips?|recommend|suggest|help me decide|plan|strategy|study plan|time management)\b/i,
  /\b(how can i improve|what should i do if|is it okay if|how do i handle)\b/i,
  /\b(prepare|review|study)\b.*\b(exam|quiz|test|finals?|midterms?)\b/i,
  /\b(exam|quiz|test|finals?|midterms?)\b.*\b(prepare|review|study)\b/i
];

const SAFETY_PATTERNS: Array<{ category: SafetyCategory; patterns: RegExp[]; reason: string }> = [
  {
    category: "self_harm",
    reason: "Self-harm method request",
    patterns: [
      /\b(kill myself|suicide method|how to suicide|self harm method|painless death)\b/i,
      /\b(how (do|can) i)\b.*\b(hurt myself|end my life)\b/i,
      /\b(paano|pano)\b.*\b(saktan ang sarili|magpakamatay|tapusin buhay)\b/i
    ]
  },
  {
    category: "violence",
    reason: "Violence or weaponization request",
    patterns: [
      /\b(build|make|create|hide|use)\b.*\b(weapon|bomb|explosive|poison|molotov)\b/i,
      /\b(how (do|can) i|help me)\b.*\b(kill|hurt|attack|beat up|stab)\b/i,
      /\b(paano|pano|tulungan mo ako)\b.*\b(saktan|patayin|bugbugin|saksakin)\b/i
    ]
  },
  {
    category: "cyber_abuse",
    reason: "Cyber abuse or credential theft request",
    patterns: [
      /\b(hack|malware|phishing|keylogger|ransomware|steal password|credential theft|bypass login|session cookie)\b/i,
      /\b(how (do|can) i|teach me)\b.*\b(crack|exploit|ddos|sql injection)\b/i,
      /\b(paano|pano|turuan mo ako)\b.*\b(hack|kunin.*password|bypass.*login)\b/i
    ]
  },
  {
    category: "privacy_invasion",
    reason: "Privacy invasion request",
    patterns: [
      /\b(stalk|spy on|track|dox|doxx|find.*address|follow .* home|read.*messages without)\b/i,
      /\b(how (do|can) i|help me)\b.*\b(track someone|find someone's location|get private info)\b/i,
      /\b(paano|pano|gusto ko)\b.*\b(stalk|i-track|itrack|sundan|alamin.*location|basahin.*message)\b/i
    ]
  },
  {
    category: "harassment",
    reason: "Harassment, coercion, or manipulation request",
    patterns: [
      /\b(blackmail|threaten|harass|revenge against|humiliate|spread rumors)\b/i,
      /\b(force|coerce|manipulate|trick)\b.*\b(someone|him|her|them|my crush|classmate|teacher|professor)\b/i,
      /\b(blackmail|takutin|gantihan|ipahiya|sirain|manipulahin)\b.*\b(crush|classmate|kaklase|teacher|professor|siya|sya)\b/i
    ]
  },
  {
    category: "sexual_exploitation",
    reason: "Sexual exploitation request",
    patterns: [
      /\b(nude|nudes|sexual exploit|sextortion|nonconsensual|without consent|revenge porn)\b/i,
      /\b(minor|underage)\b.*\b(sex|sexual|nude|dating)\b/i
    ]
  },
  {
    category: "academic_dishonesty",
    reason: "Academic dishonesty request",
    patterns: [
      /\b(how (do|can) i|help me|teach me|give me|make me|show me|write me|create)\b.*\b(cheat|copy answers|plagiarize|forge|fake id|fake excuse)\b/i,
      /\bhow to\b.*\b(cheat|copy answers|plagiarize|forge|fake id|fake excuse)\b/i,
      /\b(answer key|bypass proctor|cheat sheet)\b/i,
      /\b(paano|pano|gusto ko)\b.*\b(mangopya|mandaya|kopyahin.*answer|gumawa.*fake|pekeng)\b/i
    ]
  },
  {
    category: "dangerous_illegal",
    reason: "Dangerous or illegal activity request",
    patterns: [
      /\b(how (do|can) i|help me|teach me)\b.*\b(make fake documents|sell drugs|evade police|break into)\b/i,
      /\b(counterfeit|money laundering|illegal drugs|shoplift)\b/i,
      /\b(paano|pano)\b.*\b(gumawa.*fake documents|magbenta.*droga|umiwas.*pulis|magnakaw)\b/i
    ]
  }
];

function safeQuestion(
  capability: StudentChatCapability,
  language: ReplyLanguage,
  route: QuestionRoute,
  scenario: QuestionScenario,
  sourceScope?: SourceScope
): StudentQuestionIntent {
  return {
    capability,
    language,
    route,
    scenario,
    type: "safe_question",
    ...(sourceScope ? { sourceScope } : {})
  };
}

function classifyCapability(question: string, route: QuestionRoute, scenario: QuestionScenario): StudentChatCapability {
  if (matchesAny(question, IMAGE_GENERATION_PATTERNS)) return "image_generation";
  if (matchesAny(question, SUMMARY_PATTERNS)) return "summary";

  if (isCodingScenario(scenario)) {
    return matchesAny(question, INSTRUCTION_PATTERNS) ? "instruction" : "general_advice";
  }

  if (isGeneralResponseScenario(scenario)) return "general_advice";
  if (matchesAny(question, INSTRUCTION_PATTERNS)) return "instruction";
  if (route === "obvious_general" && matchesAny(question, GENERAL_ADVICE_PATTERNS)) return "general_advice";

  return "university_answer";
}

function unsafeIntentForQuestion(
  question: string,
  capability: StudentChatCapability,
  language: ReplyLanguage,
  route: QuestionRoute
): StudentQuestionIntent | null {
  for (const group of SAFETY_PATTERNS) {
    if (matchesAny(question, group.patterns)) {
      return {
        capability,
        category: group.category,
        language,
        reason: group.reason,
        route,
        type: "unsafe_request"
      };
    }
  }

  return null;
}

export function classifyStudentQuestionIntent(question: string): StudentQuestionIntent {
  const normalized = question.trim();
  const language = detectReplyLanguage(normalized);
  const scenario = classifyQuestionScenario(normalized);
  const route = classifyRouteForScenario(normalized, scenario);
  const capability = classifyCapability(normalized, route, scenario);
  const sourceScope = sourceScopeForQuestionScenario(normalized, scenario);

  if (!normalized) {
    return safeQuestion(capability, language, route, scenario, sourceScope);
  }

  return unsafeIntentForQuestion(normalized, capability, language, route) ?? safeQuestion(capability, language, route, scenario, sourceScope);
}
