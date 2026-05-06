import { AppleFoundationModelsProvider } from "./AppleFoundationModelsProvider";
import { ExecuTorchProvider } from "./ExecuTorchProvider";
import { FallbackProvider } from "./FallbackProvider";
import { LlamaRnProvider } from "./LlamaRnProvider";
import type { LocalAIProvider, LocalAIProviderId } from "./LocalAIProvider";

export interface LocalAIProviderRegistry {
  appleFoundationModels: AppleFoundationModelsProvider;
  execuTorch: ExecuTorchProvider;
  fallback: FallbackProvider;
  llamaRn: LlamaRnProvider;
  byId(providerId: LocalAIProviderId | null): LocalAIProvider | null;
  dispose(): Promise<void>;
}

export function createLocalAIProviderRegistry(): LocalAIProviderRegistry {
  const appleFoundationModels = new AppleFoundationModelsProvider();
  const execuTorch = new ExecuTorchProvider();
  const fallback = new FallbackProvider();
  const llamaRn = new LlamaRnProvider();
  const providerMap = new Map<LocalAIProviderId, LocalAIProvider>([
    [appleFoundationModels.id, appleFoundationModels],
    [execuTorch.id, execuTorch],
    [fallback.id, fallback],
    [llamaRn.id, llamaRn]
  ]);

  return {
    appleFoundationModels,
    execuTorch,
    fallback,
    llamaRn,
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
