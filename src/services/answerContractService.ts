import { normalizeQuery } from "@/retrieval/queryNormalizer";
import type { SearchResponse } from "@/types/search";

import { classifyStudentQuestionIntent } from "./questionIntentService";
import type { QuestionScenario, StudentQuestionIntent } from "./studentChatTypes";

export type AnswerAbility = "campus_source" | "student_support" | "general_fact" | "safety" | "profile_app";

export interface AnswerContract {
  ability: AnswerAbility;
  allowModelRewrite: boolean;
  clarificationOptions?: string[];
  deterministicSource: boolean;
  format: "compact_source" | "concise_chat" | "deterministic" | "general_fact_notice";
  factCheckNotice?: string;
  intent: StudentQuestionIntent;
  needsFactNotice: boolean;
  normalizedQuestion: string;
  requiresSource: boolean;
  sourceFirst: boolean;
}

const PROFILE_APP_SCENARIOS = new Set<QuestionScenario>([
  "capability_discovery",
  "device_specification"
]);

const GENERAL_FACT_SCENARIOS = new Set<QuestionScenario>([
  "general_knowledge"
]);

const DENTAL_CARE_OPTIONS = ["dental care consultation", "dental treatment", "dental emergency treatment"];

export const GENERAL_FACT_CHECK_NOTICE =
  "Note: Haki may be wrong on general facts outside saved TUPT sources, so double-check with a reliable source.";

function isProfileQuestion(question: string): boolean {
  return /\b(who am i|what do you know about me|my profile|what is my name|what course am i|what program am i|what year am i|how old (am )?i|my age)\b/i.test(question);
}

function abilityForQuestion(question: string, intent: StudentQuestionIntent): AnswerAbility {
  if (intent.type === "unsafe_request") {
    return "safety";
  }

  if (intent.route === "source_context") {
    return "campus_source";
  }

  if (isProfileQuestion(question) || intent.capability === "image_generation" || PROFILE_APP_SCENARIOS.has(intent.scenario)) {
    return "profile_app";
  }

  if (GENERAL_FACT_SCENARIOS.has(intent.scenario)) {
    return "general_fact";
  }

  return "student_support";
}

function clarificationOptionsForQuestion(question: string, ability: AnswerAbility): string[] | undefined {
  if (ability !== "campus_source") {
    return undefined;
  }

  const normalized = normalizeQuery(question);
  const mentionsDentalCare = /\bdental\b.*\bcare\b|\bcare\b.*\bdental\b/.test(normalized);
  const hasSpecificDentalTarget = /\b(consultation|consult|treatment|emergency|urgent|toothache|pain)\b/.test(normalized);
  return mentionsDentalCare && !hasSpecificDentalTarget ? DENTAL_CARE_OPTIONS : undefined;
}

function formatOptions(options: string[]): string {
  if (options.length <= 2) return options.join(" or ");
  return `${options.slice(0, -1).join(", ")}, or ${options[options.length - 1]}`;
}

export function buildAnswerContract(
  question: string,
  precomputedIntent?: StudentQuestionIntent
): AnswerContract {
  const intent = precomputedIntent ?? classifyStudentQuestionIntent(question);
  const ability = abilityForQuestion(question, intent);
  const isCampusSource = ability === "campus_source";
  const factCheckNotice = ability === "general_fact" ? GENERAL_FACT_CHECK_NOTICE : undefined;
  const clarificationOptions = clarificationOptionsForQuestion(question, ability);

  return {
    ability,
    allowModelRewrite: !isCampusSource && ability !== "safety" && ability !== "profile_app",
    ...(clarificationOptions ? { clarificationOptions } : {}),
    deterministicSource: isCampusSource,
    format: isCampusSource
      ? "compact_source"
      : ability === "general_fact"
        ? "general_fact_notice"
        : ability === "profile_app" || ability === "safety"
          ? "deterministic"
          : "concise_chat",
    ...(factCheckNotice ? { factCheckNotice } : {}),
    intent,
    needsFactNotice: Boolean(factCheckNotice),
    normalizedQuestion: normalizeQuery(question),
    requiresSource: isCampusSource,
    sourceFirst: isCampusSource
  };
}

export function buildContractClarificationResponse(
  question: string,
  contract: AnswerContract,
  selectedMode: { mode: SearchResponse["activeMode"] }
): SearchResponse | null {
  if (!contract.clarificationOptions?.length) {
    return null;
  }

  return {
    question,
    normalizedQuestion: contract.normalizedQuestion,
    responseType: "source",
    results: [],
    confidence: "low",
    reliable: false,
    answerText: `I have 1 quick question: do you mean ${formatOptions(contract.clarificationOptions)}?`,
    citationsUsed: [],
    provenance: "No reliable saved source found",
    activeMode: selectedMode.mode
  };
}

export function withAnswerContractNotice(response: SearchResponse, contract: AnswerContract): SearchResponse {
  if (!contract.factCheckNotice) {
    return response;
  }

  const answerText = response.answerText?.trim();
  if (!answerText || answerText.includes(contract.factCheckNotice)) {
    return {
      ...response,
      factCheckNotice: contract.factCheckNotice
    };
  }

  return {
    ...response,
    answerText: `${answerText}\n\n${contract.factCheckNotice}`,
    factCheckNotice: contract.factCheckNotice
  };
}
