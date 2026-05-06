import type {
  LocalAICapabilities,
  LocalAIProvider,
  LocalSummaryResult,
  SummarizeFromSourcesInput
} from "./LocalAIProvider";
import { noReliableSummary } from "./providerUtils";

export class FallbackProvider implements LocalAIProvider {
  readonly id = "fallback" as const;
  readonly name = "SQLite FTS5 Source Search";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getCapabilities(): Promise<LocalAICapabilities> {
    return {
      summary: false,
      safeChat: false,
      embeddings: false,
      reranking: false,
      providerReady: true,
      requiresCustomDevBuild: false,
      minimumOS: "iOS 15+ / Android 9+",
      modelAssetsAvailable: null,
      approximateDeviceCapability: "unknown",
      memoryClass: null,
      unavailableReasons: [],
      notes: ["Always available. Uses local SQLite FTS5 retrieval and source-grounded answer fields only."]
    };
  }

  async summarizeFromSources(input: SummarizeFromSourcesInput): Promise<LocalSummaryResult> {
    const firstSource = input.sources[0];
    if (!firstSource) {
      return noReliableSummary(this.id, this.name);
    }

    return {
      status: "ok",
      text: firstSource.answer?.trim() || firstSource.content,
      citationIds: [firstSource.citationId],
      providerId: this.id,
      providerName: this.name
    };
  }
}
