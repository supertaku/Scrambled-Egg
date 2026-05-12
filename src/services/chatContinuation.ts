import type { SearchResponse } from "@/types/search";

function hasSentenceEnding(text: string): boolean {
  return /[.!?。！？)"'\]]\s*$/.test(text.trim());
}

export function needsContinuation(response: SearchResponse, answerText: string): boolean {
  return Boolean(response.isIncomplete) || (answerText.length > 80 && !hasSentenceEnding(answerText));
}

/**
 * Trims any leading overlap between the existing tail of `previous` and the
 * head of `next` before splicing. Prevents "X. X. Y." artefacts when the model
 * restarts despite being told to continue.
 */
export function stitchContinuation(previous: string, next: string): string {
  const prev = previous.trimEnd();
  const cont = next.trimStart();
  const maxOverlap = Math.min(prev.length, cont.length, 120);
  for (let size = maxOverlap; size >= 6; size -= 1) {
    if (prev.slice(-size).toLowerCase() === cont.slice(0, size).toLowerCase()) {
      return `${prev}${cont.slice(size)}`.trim();
    }
  }
  return `${prev} ${cont}`.trim();
}
