import seedDocuments from "../src/data/seed-documents.json";
import goldenQuestions from "../src/data/golden-questions.json";
import { calculateConfidence } from "../src/retrieval/confidence";
import { InMemoryCorpusRetriever } from "../src/retrieval/InMemoryCorpusRetriever";
import type { ConfidenceLevel } from "../src/types/search";
import type { StructuredDocument } from "../src/types/document";
import { readSource } from "./test-utils/sourceAssertions";

interface GoldenQuestion {
  question: string;
  expectedTopChunkId?: string;
  minConfidence?: ConfidenceLevel;
  maxConfidence?: ConfidenceLevel;
  expectedReliable: boolean;
}

const confidenceRank: Record<ConfidenceLevel, number> = {
  low: 0,
  medium: 1,
  high: 2
};

function confidenceMeets(actual: ConfidenceLevel, minimum: ConfidenceLevel | undefined): boolean {
  if (!minimum) {
    return true;
  }

  return confidenceRank[actual] >= confidenceRank[minimum];
}

function confidenceDoesNotExceed(actual: ConfidenceLevel, maximum: ConfidenceLevel | undefined): boolean {
  if (!maximum) {
    return true;
  }

  return confidenceRank[actual] <= confidenceRank[maximum];
}

async function main() {
  const sourceAnswerServiceSource = readSource("src/services/sourceAnswerService.ts");
  const sourceRetrievalPipelineSource = readSource("src/services/sourceRetrievalPipeline.ts");
  if (!/retrieveRankedSources/.test(sourceAnswerServiceSource)) {
    throw new Error("sourceAnswerService must call the source retrieval pipeline.");
  }
  if (/new FTSRetriever|new VectorRetriever|new HybridRetriever/.test(sourceAnswerServiceSource)) {
    throw new Error("sourceAnswerService should not construct retrievers directly.");
  }
  if (!/new FTSRetriever/.test(sourceRetrievalPipelineSource) || !/new HybridRetriever/.test(sourceRetrievalPipelineSource)) {
    throw new Error("sourceRetrievalPipeline must own FTS/vector/hybrid retriever orchestration.");
  }

  const retriever = new InMemoryCorpusRetriever(seedDocuments as StructuredDocument[]);
  const cases = goldenQuestions as GoldenQuestion[];
  const failures: string[] = [];

  for (const testCase of cases) {
    const results = await retriever.search(testCase.question, { limit: 5 });
    const confidence = calculateConfidence(results, testCase.question);
    const reliable = results.length > 0 && confidence !== "low";
    const topChunkId = results[0]?.chunkId;

    if (reliable !== testCase.expectedReliable) {
      failures.push(
        `${testCase.question}: expected reliable=${testCase.expectedReliable}, got reliable=${reliable} (${confidence})`
      );
      continue;
    }

    if (testCase.expectedTopChunkId && topChunkId !== testCase.expectedTopChunkId) {
      failures.push(`${testCase.question}: expected top ${testCase.expectedTopChunkId}, got ${topChunkId ?? "none"}`);
    }

    if (!confidenceMeets(confidence, testCase.minConfidence)) {
      failures.push(`${testCase.question}: expected confidence >= ${testCase.minConfidence}, got ${confidence}`);
    }

    if (!confidenceDoesNotExceed(confidence, testCase.maxConfidence)) {
      failures.push(`${testCase.question}: expected confidence <= ${testCase.maxConfidence}, got ${confidence}`);
    }
  }

  if (failures.length > 0) {
    console.error("Golden retrieval failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    throw new Error(`${failures.length} golden retrieval case(s) failed.`);
  }

  console.log(`Golden retrieval passed: ${cases.length} cases.`);
}

main();
