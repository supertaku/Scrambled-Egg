import type { LocalModelTier } from "./LocalAIProvider";

export interface ModelFileConfig {
  name: string;
  url: string;
}

export interface ModelTierConfig {
  tier: LocalModelTier;
  repo: string;
  revision: string;
  files: string[];
}

export const MODEL_TIER_CONFIGS: Record<string, ModelTierConfig> = {
  tiny: {
    tier: "tiny",
    repo: "larryliu0820/Qwen3-0.6B-ExecuTorch-XNNPACK",
    revision: "main",
    files: [
      "model.pte",
      "tokenizer.json",
      "vocab.json",
      "merges.txt",
      "config.json",
      "generation_config.json",
      "tokenizer_config.json"
    ]
  },
  minimum: {
    tier: "minimum",
    repo: "larryliu0820/Qwen3-1.7B-ExecuTorch-XNNPACK",
    revision: "main",
    files: [
      "model.pte",
      "tokenizer.json",
      "vocab.json",
      "merges.txt",
      "config.json",
      "generation_config.json",
      "tokenizer_config.json"
    ]
  },
  flagship: {
    tier: "flagship",
    repo: "larryliu0820/llava-v1.5-7b-IN8-INT4",
    revision: "main",
    files: [
      "model.pte",
      "tokenizer.json",
      "vocab.json",
      "merges.txt",
      "config.json",
      "generation_config.json",
      "tokenizer_config.json"
    ]
  }
};

export function getHFDownloadUrl(repo: string, revision: string, file: string): string {
  return `https://huggingface.co/${repo}/resolve/${revision}/${file}`;
}
