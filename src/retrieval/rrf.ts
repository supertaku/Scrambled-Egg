import type { SearchResult } from "@/types/search";

interface FusedResult {
  result: SearchResult;
  fusionScore: number;
  bestRankScore: number;
}

function confidenceWeight(confidence: SearchResult["confidence"]): number {
  if (confidence === "high") {
    return 3;
  }
  if (confidence === "medium") {
    return 2;
  }
  return 1;
}

function preferResult(candidate: SearchResult, current: SearchResult): boolean {
  const candidateConfidence = confidenceWeight(candidate.confidence);
  const currentConfidence = confidenceWeight(current.confidence);

  if (candidateConfidence !== currentConfidence) {
    return candidateConfidence > currentConfidence;
  }

  return candidate.rankScore > current.rankScore;
}

export function reciprocalRankFusion(
  resultSets: SearchResult[][],
  k = 60,
  limit = 8
): SearchResult[] {
  const fused = new Map<string, FusedResult>();

  resultSets.forEach((results) => {
    results.forEach((result, index) => {
      const fusionIncrement = 1 / (k + index + 1);
      const current = fused.get(result.chunkId);

      if (!current) {
        fused.set(result.chunkId, {
          result,
          fusionScore: fusionIncrement,
          bestRankScore: result.rankScore
        });
        return;
      }

      current.fusionScore += fusionIncrement;
      current.bestRankScore = Math.max(current.bestRankScore, result.rankScore);
      if (preferResult(result, current.result)) {
        current.result = result;
      }
    });
  });

  return Array.from(fused.values())
    .map(({ result, fusionScore, bestRankScore }) => ({
      ...result,
      rankScore: Number((bestRankScore + fusionScore * 100).toFixed(3))
    }))
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, limit);
}
