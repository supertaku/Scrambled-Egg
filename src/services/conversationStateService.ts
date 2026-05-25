import type { ChatMessage } from "@/types/chat";
import type { ConversationState, SearchOptions, SearchResult, SourceAnchor } from "@/types/search";

import type { StudentQuestionIntent } from "./studentChatTypes";

const ACTOR_PATTERNS: Array<{ entity: string; pattern: RegExp }> = [
  { entity: "teacher", pattern: /\b(my\s+)?(teacher|professor|instructor)\b/i },
  { entity: "classmate", pattern: /\b(my\s+)?classmate\b/i },
  { entity: "friend", pattern: /\b(my\s+)?friend\b/i },
  { entity: "parent", pattern: /\b(my\s+)?(parent|mother|father|guardian)\b/i },
  { entity: "office staff", pattern: /\b(staff|registrar|osa|clinic|guidance|office)\b/i },
  { entity: "company", pattern: /\b(company|employer|hr|supervisor)\b/i },
  { entity: "user", pattern: /\b(i|me|my|mine|ako|ko|akin)\b/i }
];

const GOAL_PATTERNS: Array<{ goal: string; pattern: RegExp }> = [
  { goal: "find contact information", pattern: /\b(phone|contact|email|number|hotline)\b/i },
  { goal: "complete a document or requirement", pattern: /\b(moa|form|document|requirement|submit|sign)\b/i },
  { goal: "find an office or location", pattern: /\b(where|office|room|go|location|saan)\b/i },
  { goal: "understand a fee or payment", pattern: /\b(fee|payment|cost|how much|magkano)\b/i },
  { goal: "replace or recover an ID", pattern: /\b(id|identification|lost|nawala|replacement)\b/i }
];

function lastUserMessages(messages: ChatMessage[], max = 6): string[] {
  return messages
    .filter((message) => message.sender === "user" && message.text.trim().length > 0)
    .slice(-max)
    .map((message) => message.text.trim());
}

function detectActiveEntity(text: string): string | undefined {
  return ACTOR_PATTERNS.find((item) => item.pattern.test(text))?.entity;
}

function detectUserGoal(text: string): string | undefined {
  return GOAL_PATTERNS.find((item) => item.pattern.test(text))?.goal;
}

function scopeFromIntent(intent: StudentQuestionIntent): SearchOptions["scope"] | undefined {
  return intent.type === "safe_question" ? intent.sourceScope : undefined;
}

function topicFromIntent(intent: StudentQuestionIntent): string | undefined {
  if (intent.type !== "safe_question") {
    return intent.category;
  }

  return intent.scenario === "unknown_general" ? intent.capability : intent.scenario;
}

function sourceAnchorFromResult(result: SearchResult): SourceAnchor {
  return {
    ...(result.category ? { category: result.category } : {}),
    chunkId: result.chunkId,
    documentId: result.documentId,
    label: result.processName ?? result.sectionTitle ?? result.documentTitle,
    ...(result.office ? { office: result.office } : {})
  };
}

function latestSourceContext(messages: ChatMessage[]): {
  hasAmbiguousSourceAnchor?: boolean;
  lastSourceAnchor?: SourceAnchor;
} {
  const latestTurn = [...messages]
    .reverse()
    .find((message) => message.id !== "opening" && message.text.trim().length > 0);
  const response = latestTurn?.sender === "haki" ? latestTurn.response : undefined;
  if (
    !response?.reliable ||
    !["campus_sources", "haki_composed"].includes(response.answerBasis) ||
    response.citationsUsed.length === 0
  ) {
    return {};
  }

  const citedIds = new Set(response.citationsUsed);
  const citedResults = [response.topResult, latestTurn?.result, ...response.results]
    .filter((result): result is SearchResult => Boolean(result && citedIds.has(result.chunkId)))
    .filter((result, index, results) => results.findIndex((candidate) => candidate.chunkId === result.chunkId) === index);

  if (citedIds.size !== 1 || citedResults.length !== 1) {
    return { hasAmbiguousSourceAnchor: true };
  }

  const sourceResult = citedResults[0];
  return sourceResult ? { lastSourceAnchor: sourceAnchorFromResult(sourceResult) } : {};
}

function isAmbiguousFollowUp(question: string): boolean {
  const normalized = question.toLowerCase().trim();
  if (normalized.split(/\s+/).length > 5) return false;
  return /\b(that|it|this|they|them|he|she|him|her|ano|yun|yung|ulit|why|bakit)\b/i.test(normalized);
}

export function buildConversationState(input: {
  intent: StudentQuestionIntent;
  messages: ChatMessage[];
  question: string;
}): ConversationState {
  const priorUserText = lastUserMessages(input.messages).join(" ");
  const combined = `${priorUserText} ${input.question}`.trim();
  const activeEntity = detectActiveEntity(combined);
  const userGoal = detectUserGoal(combined);
  const sourceContext = latestSourceContext(input.messages);
  const lastSourceScope = scopeFromIntent(input.intent) ?? (
    sourceContext.lastSourceAnchor
      ? {
          ...(sourceContext.lastSourceAnchor.office ? { office: sourceContext.lastSourceAnchor.office } : {}),
          ...(sourceContext.lastSourceAnchor.category ? { category: sourceContext.lastSourceAnchor.category } : {}),
          documentId: sourceContext.lastSourceAnchor.documentId
        }
      : undefined
  );
  const currentTopic = topicFromIntent(input.intent);
  const unresolvedQuestion = isAmbiguousFollowUp(input.question)
    ? "The latest user message is a short follow-up; preserve the prior subject and ask a clarification if the target is unclear."
    : undefined;

  return {
    ...(activeEntity ? { activeEntity } : {}),
    ...(currentTopic ? { currentTopic } : {}),
    ...sourceContext,
    ...(lastSourceScope ? { lastSourceScope } : {}),
    ...(unresolvedQuestion ? { unresolvedQuestion } : {}),
    ...(userGoal ? { userGoal } : {})
  };
}

export function formatConversationState(state: ConversationState | undefined): string {
  if (!state || Object.keys(state).length === 0) {
    return "";
  }

  const lines = [
    state.currentTopic ? `Current topic: ${state.currentTopic}` : "",
    state.activeEntity ? `Active actor/entity: ${state.activeEntity}` : "",
    state.userGoal ? `User goal: ${state.userGoal}` : "",
    state.lastSourceAnchor ? `Last cited source: ${state.lastSourceAnchor.label}` : "",
    state.lastSourceScope
      ? `Last source scope: ${[
          state.lastSourceScope.office,
          state.lastSourceScope.category,
          state.lastSourceScope.documentId
        ].filter(Boolean).join(" / ")}`
      : "",
    state.unresolvedQuestion ? `Ambiguity note: ${state.unresolvedQuestion}` : ""
  ].filter(Boolean);

  return lines.length ? `Conversation state:\n${lines.join("\n")}` : "";
}
