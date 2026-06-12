import type { CompletionParams } from "llama.rn";

import type { LocalModelManifest } from "./localModelMetadata";
import { safeOutputTokens } from "./tokenBudget";

/**
 * llama.rn-specific generation tuning: stop tokens across the supported chat
 * template families and the sampling profiles used for safe chat. Retry
 * profiles are stricter (lower temperature, heavier repetition/DRY
 * penalties, shorter output) because they run after degenerate-output
 * detection.
 */

export const STOP_WORDS = [
  "</s>",
  "<|end|>",
  "<|eot_id|>",
  "<|end_of_text|>",
  "<|im_end|>",
  "<|EOT|>",
  "<|end_of_turn|>",
  "<|endoftext|>",
  // Gemma's turn delimiter has no pipes.
  "<end_of_turn>"
];

export function safeChatOutputTokens(nCtx: number, tier: LocalModelManifest["modelTier"], retry = false): number {
  const base = safeOutputTokens(nCtx, "safe-chat");
  const tierCap = tier === "tiny" ? 192 : tier === "minimum" ? 224 : base;
  const capped = Math.min(base, tierCap);
  return retry ? Math.max(128, Math.floor(capped * 0.72)) : capped;
}

export function safeChatSampling(retry = false): Partial<CompletionParams> {
  return retry
    ? {
        temperature: 0.25,
        top_k: 32,
        top_p: 0.82,
        min_p: 0.08,
        penalty_last_n: 192,
        penalty_repeat: 1.22,
        penalty_freq: 0.25,
        penalty_present: 0.1,
        dry_multiplier: 1,
        dry_base: 1.75,
        dry_allowed_length: 2,
        dry_penalty_last_n: 192
      }
    : {
        temperature: 0.45,
        top_k: 40,
        top_p: 0.88,
        min_p: 0.05,
        penalty_last_n: 128,
        penalty_repeat: 1.15,
        penalty_freq: 0.15,
        penalty_present: 0,
        dry_multiplier: 0.7,
        dry_base: 1.75,
        dry_allowed_length: 2,
        dry_penalty_last_n: 128
      };
}

/**
 * Returns scenario-tuned sampling parameters for safe-chat completions.
 * Factual/procedural questions use lower temperature for accuracy.
 * Creative scenarios use higher temperature for variety.
 * Coding uses near-zero temperature for correctness.
 * Falls back to the default safe-chat profile for unrecognised scenarios.
 */
export function safeChatSamplingForScenario(scenario: string | undefined, retry = false): Partial<CompletionParams> {
  if (retry) return safeChatSampling(true);

  switch (scenario) {
    case "coding_help":
      return {
        temperature: 0.1,
        top_k: 20,
        top_p: 0.9,
        min_p: 0.05,
        penalty_last_n: 128,
        penalty_repeat: 1.1,
        penalty_freq: 0.1,
        penalty_present: 0,
        dry_multiplier: 0.5,
        dry_base: 1.75,
        dry_allowed_length: 2,
        dry_penalty_last_n: 128
      };
    case "student_admin":
    case "campus_office":
    case "academic_support":
    case "wellbeing_safety":
      return {
        temperature: 0.15,
        top_k: 30,
        top_p: 0.9,
        min_p: 0.05,
        penalty_last_n: 128,
        penalty_repeat: 1.12,
        penalty_freq: 0.1,
        penalty_present: 0,
        dry_multiplier: 0.6,
        dry_base: 1.75,
        dry_allowed_length: 2,
        dry_penalty_last_n: 128
      };
    case "creative_brainstorm":
    case "off_topic_silly":
      return {
        temperature: 0.65,
        top_k: 50,
        top_p: 0.92,
        min_p: 0.04,
        penalty_last_n: 64,
        penalty_repeat: 1.1,
        penalty_freq: 0.1,
        penalty_present: 0,
        dry_multiplier: 0.5,
        dry_base: 1.75,
        dry_allowed_length: 2,
        dry_penalty_last_n: 64
      };
    default:
      return safeChatSampling(false);
  }
}
