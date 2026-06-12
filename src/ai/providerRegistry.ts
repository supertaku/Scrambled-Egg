import { AppleFoundationModelsProvider } from "./AppleFoundationModelsProvider";
import { FallbackProvider } from "./FallbackProvider";
import { LlamaRnProvider } from "./LlamaRnProvider";
import { LiteRtLmProvider } from "./LiteRtLmProvider";
import type { LocalAIProvider, LocalAIProviderId } from "./LocalAIProvider";

export interface LocalAIProviderRegistry {
  appleFoundationModels: AppleFoundationModelsProvider;
  fallback: FallbackProvider;
  liteRtLm: LiteRtLmProvider;
  llamaRn: LlamaRnProvider;
  byId(providerId: LocalAIProviderId | null): LocalAIProvider | null;
  dispose(): Promise<void>;
}

export function createLocalAIProviderRegistry(): LocalAIProviderRegistry {
  const appleFoundationModels = new AppleFoundationModelsProvider();
  const fallback = new FallbackProvider();
  const liteRtLm = new LiteRtLmProvider();
  const llamaRn = new LlamaRnProvider();
  const providerMap = new Map<LocalAIProviderId, LocalAIProvider>([
    [appleFoundationModels.id, appleFoundationModels],
    [fallback.id, fallback],
    [liteRtLm.id, liteRtLm],
    [llamaRn.id, llamaRn]
  ]);

  return {
    appleFoundationModels,
    fallback,
    liteRtLm,
    llamaRn,
    byId(providerId) {
      return providerId ? providerMap.get(providerId) ?? null : null;
    },
    async dispose() {
      const providers = Array.from(new Set(providerMap.values()));
      const results = await Promise.allSettled(
        providers.map((provider) => provider.dispose?.() ?? Promise.resolve())
      );
      const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      if (failures.length > 0) {
        throw new Error(`${failures.length} local AI provider${failures.length === 1 ? "" : "s"} failed to release.`);
      }
    }
  };
}
