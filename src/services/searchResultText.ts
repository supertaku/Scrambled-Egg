import type { SearchResponse, SearchResult } from "@/types/search";

/** Plain-text answer body from a retrieval hit (saved excerpt or generated snippet). */
export function getDirectAnswer(result: SearchResult): string {
  return result.answer?.trim() || result.content.trim();
}

export function buildAnswerMessage(response: SearchResponse, topResult: SearchResult): string {
  return response.answerText?.trim() || getDirectAnswer(topResult);
}
