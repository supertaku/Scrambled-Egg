import type { ChatContextTurn } from "@/types/search";
import type { LocalModelTier, SourceChunkForSummary } from "./LocalAIProvider";

export const APPROX_CHARS_PER_TOKEN = 4;
const TAGLISH_APPROX_CHARS_PER_TOKEN = 3.5;
export const CHAT_CONTEXT_MAX_TURNS = 6;
export const CHAT_CONTEXT_MAX_TOKENS = 600;
export const CHAT_CONTEXT_MAX_TOKENS_PER_TURN = 180;

const TAGLISH_MARKERS =
  /\b(ako|ang|ano|ba|bakit|gusto|hindi|ikaw|kailangan|ko|lang|magkano|mga|mo|na|ng|nito|pa|paano|para|po|pwede|saan|sa|siya|taga|tapos|tayo|yun)\b/i;

function charsPerEstimatedToken(text: string): number {
  return TAGLISH_MARKERS.test(text) ? TAGLISH_APPROX_CHARS_PER_TOKEN : APPROX_CHARS_PER_TOKEN;
}

export function estimateTokens(text: string | null | undefined): number {
  const trimmed = text?.trim() ?? "";
  return trimmed.length === 0 ? 0 : Math.ceil(trimmed.length / charsPerEstimatedToken(trimmed));
}

export function truncateToEstimatedTokens(text: string, maxTokens: number): string {
  if (maxTokens <= 0) return "";
  const maxChars = Math.floor(maxTokens * TAGLISH_APPROX_CHARS_PER_TOKEN);
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trimEnd();
}

export async function pruneChatContextWithTokenizer(
  turns: ChatContextTurn[],
  countTokens: (text: string) => Promise<number>,
  maxTokens = CHAT_CONTEXT_MAX_TOKENS,
  maxTurns = CHAT_CONTEXT_MAX_TURNS
): Promise<ChatContextTurn[]> {
  const selected: ChatContextTurn[] = [];
  let usedTokens = 0;

  for (let index = turns.length - 1; index >= 0 && selected.length < maxTurns; index -= 1) {
    const turn = turns[index];
    if (!turn?.text.trim()) continue;

    let text = turn.text.trim();
    let tokens = await countTokens(text);
    while (tokens > CHAT_CONTEXT_MAX_TOKENS_PER_TURN && text.length > 32) {
      text = text.slice(0, Math.floor(text.length * 0.85)).trimEnd();
      tokens = await countTokens(text);
    }
    if (tokens > CHAT_CONTEXT_MAX_TOKENS_PER_TURN) continue;

    if (usedTokens + tokens > maxTokens && selected.length > 0) {
      break;
    }

    selected.push({ sender: turn.sender, text });
    usedTokens += tokens;
  }

  return selected.reverse();
}

export function pruneChatContext(
  turns: ChatContextTurn[],
  maxTokens = CHAT_CONTEXT_MAX_TOKENS,
  maxTurns = CHAT_CONTEXT_MAX_TURNS
): ChatContextTurn[] {
  const selected: ChatContextTurn[] = [];
  let usedTokens = 0;

  for (let index = turns.length - 1; index >= 0 && selected.length < maxTurns; index -= 1) {
    const turn = turns[index];
    if (!turn?.text.trim()) continue;

    const text = truncateToEstimatedTokens(turn.text.trim(), CHAT_CONTEXT_MAX_TOKENS_PER_TURN);
    const tokens = estimateTokens(text);
    if (usedTokens + tokens > maxTokens && selected.length > 0) {
      break;
    }

    selected.push({ sender: turn.sender, text });
    usedTokens += tokens;
  }

  return selected.reverse();
}

export function safeOutputTokens(nCtx: number, kind: "safe-chat" | "summary"): number {
  const fraction = kind === "safe-chat" ? 0.25 : 0.2;
  const cap = kind === "safe-chat" ? 640 : 360;
  const floor = kind === "safe-chat" ? 256 : 192;
  return Math.min(cap, Math.max(floor, Math.floor(nCtx * fraction)));
}

export function safeInputBudgetTokens(nCtx: number, outputTokens: number): number {
  return Math.max(256, nCtx - outputTokens - 128);
}

export function sourceChunkTokenCost(source: SourceChunkForSummary): number {
  return estimateTokens(
    [
      source.citationId,
      source.documentTitle,
      source.sectionTitle,
      source.processName,
      source.answer,
      source.content
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function pruneSourcesForBudget(
  sources: SourceChunkForSummary[] | undefined,
  availableTokens: number
): SourceChunkForSummary[] | undefined {
  if (!sources?.length || availableTokens <= 0) return undefined;

  const selected: SourceChunkForSummary[] = [];
  let usedTokens = 0;

  for (const source of sources) {
    const remaining = availableTokens - usedTokens;
    if (remaining <= 0) break;

    const cost = sourceChunkTokenCost(source);
    if (cost <= remaining) {
      selected.push(source);
      usedTokens += cost;
      continue;
    }

    const headerCost = estimateTokens([source.citationId, source.documentTitle, source.sectionTitle].filter(Boolean).join(" "));
    const bodyBudget = remaining - headerCost;
    if (bodyBudget <= 24) break;

    selected.push({
      ...source,
      answer: source.answer ? truncateToEstimatedTokens(source.answer, bodyBudget) : source.answer,
      content: truncateToEstimatedTokens(source.answer ? "" : source.content, bodyBudget)
    });
    break;
  }

  return selected.length > 0 ? selected : undefined;
}

export function summaryBudgetForTier(tier: LocalModelTier | undefined): { maxSources: number; maxSourceTokens: number } {
  switch (tier) {
    case "tiny":
      return { maxSources: 2, maxSourceTokens: 500 };
    case "minimum":
      return { maxSources: 3, maxSourceTokens: 900 };
    case "good":
      return { maxSources: 4, maxSourceTokens: 1400 };
    case "enhanced":
      return { maxSources: 6, maxSourceTokens: 2200 };
    case "flagship":
    case "apple-intelligence":
      return { maxSources: 8, maxSourceTokens: 3200 };
    default:
      return { maxSources: 3, maxSourceTokens: 900 };
  }
}

export function pruneSourcesForTier(
  sources: SourceChunkForSummary[],
  tier: LocalModelTier | undefined
): SourceChunkForSummary[] {
  const budget = summaryBudgetForTier(tier);
  return pruneSourcesForBudget(sources.slice(0, budget.maxSources), budget.maxSourceTokens) ?? [];
}
