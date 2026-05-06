import type { ConfidenceLevel, SearchResult } from "@/types/search";
import {
  CONFIDENCE_HIGH_MULTI_SUPPORT_THRESHOLD,
  CONFIDENCE_HIGH_THRESHOLD_COVERAGE,
  CONFIDENCE_HIGH_THRESHOLD_FULL,
  CONFIDENCE_HIGH_THRESHOLD_PHRASE,
  CONFIDENCE_MEDIUM_LOW_THRESHOLD,
  CONFIDENCE_MEDIUM_THRESHOLD
} from "@/utils/constants";
import { normalizeQuery, tokenizeQuery } from "./queryNormalizer";

interface ConfidenceScore {
  raw: number;
  level: ConfidenceLevel;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function tokenMatches(text: string, token: string): boolean {
  if (text.includes(token)) {
    return true;
  }

  if (token.length > 3 && token.endsWith("s")) {
    return text.includes(token.slice(0, -1));
  }

  return false;
}

function countMatches(text: string, tokens: string[]): number {
  return tokens.filter((token) => tokenMatches(text, token)).length;
}

export function computeConfidenceScore(result: SearchResult, query: string): ConfidenceScore {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) {
    return { raw: 0, level: "low" };
  }

  const phrase = normalizeQuery(query);
  const searchable = [
    result.documentTitle,
    result.sectionTitle,
    result.processName,
    result.office,
    result.category,
    result.answer,
    result.content,
    result.citation,
    result.tags.join(" "),
    result.synonyms.join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const normalizedSearchable = normalizeQuery(searchable);

  const priorityText = normalizeQuery(
    [result.sectionTitle, result.processName, result.tags.join(" "), result.synonyms.join(" ")]
      .filter(Boolean)
      .join(" ")
  );
  const metadataText = normalizeQuery([result.office, result.category, result.documentTitle].filter(Boolean).join(" "));
  const answerText = normalizeQuery(result.answer ?? "");
  const citationText = normalizeQuery(result.citation ?? "");

  // 1. Token coverage across the source chunk.
  const matchCount = countMatches(normalizedSearchable, tokens);
  const tokenCoverage = matchCount / tokens.length;

  // 2. Exact phrase match. Single-token phrase matches are too broad for High confidence.
  const exactPhraseMatch = tokens.length >= 2 && phrase.length >= 8 && normalizedSearchable.includes(phrase) ? 1 : 0;

  // 3. BM25 Magnitude (normalized, assuming BM25 scores usually fall under 50 in our scale)
  const bm25Magnitude = clamp(Math.abs(result.bm25Score) / 20, 0, 1);

  // 4. Priority coverage: section/process/tags/synonyms are stronger than body-only matches.
  const priorityMatchCount = countMatches(priorityText, tokens);
  const priorityCoverage = priorityMatchCount / tokens.length;
  const metadataCoverage = countMatches(metadataText, tokens) / tokens.length;
  const answerCoverage = countMatches(answerText, tokens) / tokens.length;
  const citationCoverage = countMatches(citationText, tokens) / tokens.length;

  // 5. Source-grounded metadata quality.
  const authorPriority = clamp(result.priority / 10, 0, 1);
  const explicitAnswer = result.answer && result.answer.trim().length > 0 ? 1 : 0;
  const explicitCitation = result.citation && result.citation.trim().length > 0 ? 1 : 0;
  const explicitPage = result.pageNumber !== null ? 1 : 0;

  // Weighted Sum
  const weightedSum =
    tokenCoverage * 0.24 +
    exactPhraseMatch * 0.18 +
    bm25Magnitude * 0.1 +
    priorityCoverage * 0.17 +
    metadataCoverage * 0.07 +
    answerCoverage * 0.08 +
    citationCoverage * 0.04 +
    authorPriority * 0.06 +
    explicitAnswer * 0.03 +
    explicitCitation * 0.02 +
    explicitPage * 0.01;

  const raw = clamp(weightedSum, 0, 1);
  const hasMultipleTokenEvidence = tokens.length >= 2 && matchCount >= Math.min(2, tokens.length);
  const hasStrongPriorityEvidence = tokens.length >= 2 && priorityCoverage >= 0.6;
  const hasExplicitGrounding = explicitAnswer === 1 && explicitCitation === 1;
  let level: ConfidenceLevel = "low";
  if (
    (raw >= CONFIDENCE_HIGH_THRESHOLD_FULL && hasMultipleTokenEvidence && hasStrongPriorityEvidence && hasExplicitGrounding) ||
    (raw >= CONFIDENCE_HIGH_THRESHOLD_PHRASE && hasMultipleTokenEvidence && exactPhraseMatch === 1 && hasExplicitGrounding) ||
    (raw >= CONFIDENCE_HIGH_THRESHOLD_COVERAGE && tokenCoverage >= 0.75 && hasStrongPriorityEvidence && hasExplicitGrounding)
  ) {
    level = "high";
  } else if (raw >= CONFIDENCE_MEDIUM_THRESHOLD && (hasMultipleTokenEvidence || priorityMatchCount > 0 || metadataCoverage >= 0.5)) {
    level = "medium";
  }

  return { raw, level };
}

export function scoreResultConfidence(result: SearchResult, query: string): ConfidenceLevel {
  return computeConfidenceScore(result, query).level;
}

export function calculateConfidence(results: SearchResult[], query: string): ConfidenceLevel {
  if (results.length === 0) {
    return "low";
  }

  const top = results[0];
  if (!top) {
    return "low";
  }

  const topScore = computeConfidenceScore(top, query);
  const scoredResults = results.map((result) => ({
    result,
    score: computeConfidenceScore(result, query)
  }));

  if (topScore.level === "high") {
    return "high";
  }

  const mediumOrBetter = scoredResults.filter((item) => item.score.raw >= 0.35);
  const mediumOrBetterCount = mediumOrBetter.length;
  const supportingDocuments = new Set(mediumOrBetter.map((item) => item.result.documentId));
  const supportingSections = new Set(
    mediumOrBetter.map((item) => item.result.sectionTitle ?? item.result.processName ?? item.result.chunkId)
  );
  const hasMultipleSourceSupport = supportingDocuments.size > 1 || supportingSections.size > 1;
  const topHasExplicitAnswer = Boolean(top.answer?.trim());
  const topHasCitationMetadata = Boolean(top.citation?.trim()) || top.pageNumber !== null;

  if (topScore.raw >= CONFIDENCE_HIGH_MULTI_SUPPORT_THRESHOLD && mediumOrBetterCount >= 3 && hasMultipleSourceSupport && topHasCitationMetadata) {
    return "high";
  }

  if (
    topScore.raw >= CONFIDENCE_MEDIUM_THRESHOLD ||
    (topScore.raw >= CONFIDENCE_MEDIUM_LOW_THRESHOLD && mediumOrBetterCount >= 2 && (topHasExplicitAnswer || topHasCitationMetadata))
  ) {
    return "medium";
  }

  return "low";
}
