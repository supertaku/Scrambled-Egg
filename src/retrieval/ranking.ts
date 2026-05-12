import type { SearchResult } from "@/types/search";
import { computeConfidenceScore } from "./confidence";

import { normalizeQuery, tokenizeQuery } from "./queryNormalizer";
import { expandToken } from "./synonymIndex";

function textIncludes(text: string | null, token: string): boolean {
  return Boolean(text?.toLowerCase().includes(token));
}

function countTokenMatches(text: string | null, tokens: string[]): number {
  if (!text) {
    return 0;
  }
  const lower = text.toLowerCase();
  return tokens.filter((token) =>
    expandToken(token).some((variation) => lower.includes(normalizeQuery(variation)))
  ).length;
}

/** Small boost for fresher documents (ties break toward recent `lastUpdated`). */
function recencyBoost(lastUpdated: string | null, referenceMs: number = Date.now()): number {
  if (!lastUpdated?.trim()) return 0;
  const parsed = Date.parse(lastUpdated.trim());
  if (!Number.isFinite(parsed)) return 0;
  const ageDays = (referenceMs - parsed) / 86_400_000;
  if (ageDays < 0) return 1.2;
  const scaleDays = 730;
  return 1.2 * Math.exp(-ageDays / scaleDays);
}

export function calculateRankScore(result: SearchResult, query: string): number {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) {
    return 0;
  }

  let score = 0;
  score += countTokenMatches(result.sectionTitle, tokens) * 3;
  score += countTokenMatches(result.processName, tokens) * 3;
  score += countTokenMatches(result.office, tokens) * 2;
  score += countTokenMatches(result.category, tokens) * 2;
  score += countTokenMatches(result.documentTitle, tokens) * 2;
  score += countTokenMatches(result.citation, tokens) * 1.5;
  score += countTokenMatches(result.answer, tokens) * 1.2;
  score += countTokenMatches(result.content, tokens);
  score += countTokenMatches(result.tags.join(" "), tokens) * 2;
  score += countTokenMatches(result.synonyms.join(" "), tokens) * 3;

  const phrase = normalizeQuery(query);
  const exactCandidate = normalizeQuery(
    [result.sectionTitle, result.processName, result.answer, result.content].filter(Boolean).join(" ")
  );
  if (phrase.length >= 8 && exactCandidate.includes(phrase)) {
    score += 5;
  }

  for (const token of tokens) {
    if (
      expandToken(token).some(
        (variation) => textIncludes(result.office, normalizeQuery(variation)) || textIncludes(result.category, normalizeQuery(variation))
      )
    ) {
      score += 0.75;
    }
  }

  if (Number.isFinite(result.bm25Score)) {
    score += Math.min(Math.abs(result.bm25Score), 5);
  }

  if (Number.isFinite(result.semanticScore)) {
    score += Math.max(0, Math.min(result.semanticScore ?? 0, 1)) * 8;
  }

  score += recencyBoost(result.lastUpdated);

  return Number(score.toFixed(3));
}

export function rankSearchResults(results: SearchResult[], query: string): SearchResult[] {
  return results
    .map((result) => {
      const rankScore = calculateRankScore(result, query);
      const { raw, level } = computeConfidenceScore(result, query);
      return {
        ...result,
        rankScore,
        confidence: level,
        confidenceScore: raw
      };
    })
    .sort((a, b) => b.rankScore - a.rankScore);
}
