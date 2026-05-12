import type { ChatMessage } from "@/types/chat";

function parseArithmeticFollowUp(question: string): { operator: "divide" | "multiply"; value: number } | null {
  const normalized = question.toLowerCase().replace(/\s+/g, " ").trim();
  const divide = normalized.match(/^(?:divide|divided by|\/)\s*(?:by\s*)?(-?\d+(?:\.\d+)?)\??$/);
  if (divide?.[1]) return { operator: "divide", value: Number(divide[1]) };

  const multiply = normalized.match(/^(?:multiply|times|x|\*)\s*(?:by\s*)?(-?\d+(?:\.\d+)?)\??$/);
  if (multiply?.[1]) return { operator: "multiply", value: Number(multiply[1]) };

  return null;
}

function extractLastNumber(messages: ChatMessage[]): number | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const text = messages[index]?.text ?? "";
    const matches = [...text.matchAll(/-?\d+(?:\.\d+)?/g)];
    const last = matches.at(-1)?.[0];
    if (last) {
      const value = Number(last);
      if (Number.isFinite(value)) return value;
    }
  }

  return null;
}

function formatNumber(value: number): string {
  const normalized = Math.abs(value) < 1e-10 ? 0 : value;
  return Number.isInteger(normalized) ? String(normalized) : String(Number(normalized.toFixed(6)));
}

/** Answers bare divide/multiply follow-ups against the last number in the thread, or returns null. */
export function buildArithmeticFollowUpAnswer(question: string, messages: ChatMessage[]): string | null {
  const operation = parseArithmeticFollowUp(question);
  if (!operation || operation.value === 0) return null;

  const previous = extractLastNumber(messages);
  if (previous === null) return null;

  const value = operation.operator === "divide" ? previous / operation.value : previous * operation.value;
  const symbol = operation.operator === "divide" ? "/" : "x";
  return `${formatNumber(previous)} ${symbol} ${formatNumber(operation.value)} = ${formatNumber(value)}`;
}
