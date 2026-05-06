import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import type { LocalModelTier } from "@/ai/LocalAIProvider";

/**
 * Returns the preferred model tier for the current mode, giving priority to
 * `recommendedModelTier` (derived from actual device hardware) over `modelTier`
 * (the tier of the currently loaded model assets).
 *
 * Returns `undefined` if no meaningful tier is available, so callers can use
 * optional spread syntax to omit the field when it would be "unknown".
 */
export function getPreferredModelTier(mode: DeviceAIMode): LocalModelTier | undefined {
  const tier = mode.capabilities.recommendedModelTier ?? mode.capabilities.modelTier;
  return tier && tier !== "unknown" ? tier : undefined;
}
