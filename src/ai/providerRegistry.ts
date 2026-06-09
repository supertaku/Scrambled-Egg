import { AppleFoundationModelsProvider } from "./AppleFoundationModelsProvider";
import { FallbackProvider } from "./FallbackProvider";
import { LiteRtLmProvider } from "./LiteRtLmProvider";
import { LlamaRnProvider } from "./LlamaRnProvider";
import { OnnxGenAiProvider } from "./OnnxGenAiProvider";
import type { LocalAIProvider, LocalAIProviderId } from "./LocalAIProvider";

export interface LocalAIProviderRegistry {
  appleFoundationModels: AppleFoundationModelsProvider;
  fallback: FallbackProvider;
  liteRtLm: LiteRtLmProvider;
  llamaRn: LlamaRnProvider;
  onnxGenAi: OnnxGenAiProvider;
  byId(providerId: LocalAIProviderId | null): LocalAIProvider | null;
  dispose(): Promise<void>;
}

export function createLocalAIProviderRegistry(): LocalAIProviderRegistry {
  const appleFoundationModels = new AppleFoundationModelsProvider();
  const fallback = new FallbackProvider();
  const liteRtLm = new LiteRtLmProvider();
  const llamaRn = new LlamaRnProvider();
  const onnxGenAi = new OnnxGenAiProvider();
  const providerMap = new Map<LocalAIProviderId, LocalAIProvider>([
    [appleFoundationModels.id, appleFoundationModels],
    [fallback.id, fallback],
    [liteRtLm.id, liteRtLm],
    [llamaRn.id, llamaRn],
    [onnxGenAi.id, onnxGenAi]
  ]);

  return {
    appleFoundationModels,
    fallback,
    liteRtLm,
    llamaRn,
    onnxGenAi,
    byId(providerId) {
      return providerId ? providerMap.get(providerId) ?? null : null;
    },
    async dispose() {
      const providers = Array.from(new Set(providerMap.values()));
      await Promise.all(
        providers.map((provider) =>
          provider.dispose ? provider.dispose().catch(() => undefined) : Promise.resolve()
        )
      );
    }
  };
}
