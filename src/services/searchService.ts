/**
 * @deprecated This file is a passthrough that no longer adds value.
 * Import `answerStudentQuestion` from `@/services/answerService` directly.
 *
 * Kept temporarily to avoid breaking any external callers that might import
 * REFUSAL_MESSAGE. Schedule for deletion once all references are confirmed removed.
 */
import { SAFE_FALLBACK_MESSAGE } from "@/ai/prompts";
import type { SearchOptions, SearchResponse } from "@/types/search";

import { answerStudentQuestion } from "./answerService";

/** @deprecated Import SAFE_FALLBACK_MESSAGE from "@/ai/prompts" directly. */
export const REFUSAL_MESSAGE = SAFE_FALLBACK_MESSAGE;

/** @deprecated Import and call answerStudentQuestion from "@/services/answerService" directly. */
export async function searchStudentQuestion(
  question: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  return answerStudentQuestion(question, options);
}
