import type { LocalModelTier } from "./LocalAIProvider";
import type { ChatTemplateFamily, LocalModelGenerationPolicy } from "./localModelMetadata";

export type ModelRuntimeFormat = "gguf" | "litert-lm";
export type ModelActivationPolicy = "auto-after-smoke-test" | "manual";
export type ModelRecommendationGroup = "recommended" | "alternative" | "experimental";
export type RuntimeAvailability = Partial<Record<ModelRuntimeFormat, boolean>>;

export interface ModelFileConfig {
  name: string;
  url: string;
}

export interface GgufDownloadConfig {
  id: string;
  description: string;
  name: string;
  url: string;
  tier: LocalModelTier;
  sizeMB: number;
  supportedPlatforms: Array<"android" | "ios">;
  artifactSource: string;
  artifactLicense: string;
  lifecycleChannel: "supported" | "evaluation";
  runtimeFormat: ModelRuntimeFormat;
  artifactFileName: string;
  activationPolicy: ModelActivationPolicy;
  recommendationGroup: ModelRecommendationGroup;
  parameterCountB: number;
  estimatedWorkingSetGB: number;
  minimumRamGB: number;
  minimumFreeStorageGB: number;
  defaultContextTokens: number;
  maxContextTokens: number;
  generationPolicy?: LocalModelGenerationPolicy;
  chatTemplateFamily?: Exclude<ChatTemplateFamily, "unknown">;
  /** Expected SHA-256 of the artifact when the publisher provides one. */
  sha256Hex?: string;
}

export const GGUF_MODELS: GgufDownloadConfig[] = [
  {
    id: "qwen-2.5-0.5b",
    description: "Smallest fallback for older 4GB phones.",
    name: "Qwen 2.5 0.5B Instruct Q4_K_M",
    url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
    tier: "tiny",
    sizeMB: 491,
    supportedPlatforms: ["android", "ios"],
    artifactSource: "Qwen official Hugging Face repository",
    artifactLicense: "Apache-2.0",
    lifecycleChannel: "supported",
    runtimeFormat: "gguf",
    artifactFileName: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "alternative",
    parameterCountB: 0.5,
    estimatedWorkingSetGB: 0.9,
    minimumRamGB: 4,
    minimumFreeStorageGB: 3,
    defaultContextTokens: 1280,
    maxContextTokens: 2048,
    chatTemplateFamily: "qwen",
    sha256Hex: "74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db"
  },
  {
    id: "llama-3.2-1b",
    description: "Compact conversational model for most 6GB+ phones.",
    name: "Llama 3.2 1B Instruct Q4_K_M",
    url: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    tier: "tiny",
    sizeMB: 808,
    supportedPlatforms: ["android", "ios"],
    artifactSource: "bartowski community GGUF quantization of Meta Llama 3.2 Instruct",
    artifactLicense: "Llama 3.2 Community License",
    lifecycleChannel: "supported",
    runtimeFormat: "gguf",
    artifactFileName: "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "recommended",
    parameterCountB: 1,
    estimatedWorkingSetGB: 1.8,
    minimumRamGB: 4,
    minimumFreeStorageGB: 3,
    defaultContextTokens: 1280,
    maxContextTokens: 2048,
    chatTemplateFamily: "llama",
    sha256Hex: "6f85a640a97cf2bf5b8e764087b1e83da0fdb51d7c9fab7d0fece9385611df83"
  },
  {
    id: "gemma-4-e2b-litert-lm",
    description: "Google Gemma 4 E2B optimized for the Android LiteRT-LM runtime.",
    name: "Gemma 4 E2B Instruct LiteRT-LM",
    url: "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/6e5c4f1e395deb959c494953478fa5cec4b8008f/gemma-4-E2B-it.litertlm",
    tier: "minimum",
    sizeMB: 2588147712 / 1024 ** 2,
    supportedPlatforms: ["android"],
    artifactSource: "Google LiteRT Community Hugging Face repository",
    artifactLicense: "Apache-2.0",
    lifecycleChannel: "evaluation",
    runtimeFormat: "litert-lm",
    artifactFileName: "gemma-4-E2B-it.litertlm",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "recommended",
    parameterCountB: 2,
    estimatedWorkingSetGB: 2.4,
    minimumRamGB: 4,
    minimumFreeStorageGB: 5,
    defaultContextTokens: 2048,
    maxContextTokens: 32768,
    sha256Hex: "181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c"
  },
  {
    id: "gemma-4-e4b-litert-lm",
    description: "Google Gemma 4 E4B for capable Android phones with the LiteRT-LM runtime.",
    name: "Gemma 4 E4B Instruct LiteRT-LM",
    url: "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/28299f30ee4d43294517a4ac93abd6163412f07f/gemma-4-E4B-it.litertlm",
    tier: "good",
    sizeMB: 3659530240 / 1024 ** 2,
    supportedPlatforms: ["android"],
    artifactSource: "Google LiteRT Community Hugging Face repository",
    artifactLicense: "Apache-2.0",
    lifecycleChannel: "evaluation",
    runtimeFormat: "litert-lm",
    artifactFileName: "gemma-4-E4B-it.litertlm",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "recommended",
    parameterCountB: 4,
    estimatedWorkingSetGB: 3.5,
    minimumRamGB: 8,
    minimumFreeStorageGB: 7,
    defaultContextTokens: 2048,
    maxContextTokens: 32768,
    sha256Hex: "0b2a8980ce155fd97673d8e820b4d29d9c7d99b8fa6806f425d969b145bd52e0"
  },
  {
    id: "llama-3.2-3b",
    description: "Balanced conversational model for 8GB-class phones.",
    name: "Llama 3.2 3B Instruct Q4_K_M",
    url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    tier: "good",
    sizeMB: 1926,
    supportedPlatforms: ["android", "ios"],
    artifactSource: "bartowski community GGUF quantization of Meta Llama 3.2 Instruct",
    artifactLicense: "Llama 3.2 Community License",
    lifecycleChannel: "supported",
    runtimeFormat: "gguf",
    artifactFileName: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "alternative",
    parameterCountB: 3,
    estimatedWorkingSetGB: 4.4,
    minimumRamGB: 6,
    minimumFreeStorageGB: 5,
    defaultContextTokens: 1536,
    maxContextTokens: 2048,
    chatTemplateFamily: "llama",
    sha256Hex: "6c1a2b41161032677be168d354123594c0e6e67d2b9227c84f296ad037c728ff"
  },
  {
    id: "qwen-2.5-3b",
    description: "Better instruction following for 8GB+ phones.",
    name: "Qwen 2.5 3B Instruct Q4_K_M",
    url: "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
    tier: "good",
    sizeMB: 2100,
    supportedPlatforms: ["android", "ios"],
    artifactSource: "Qwen official Hugging Face repository",
    artifactLicense: "Apache-2.0",
    lifecycleChannel: "supported",
    runtimeFormat: "gguf",
    artifactFileName: "qwen2.5-3b-instruct-q4_k_m.gguf",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "alternative",
    parameterCountB: 3,
    estimatedWorkingSetGB: 4,
    minimumRamGB: 8,
    minimumFreeStorageGB: 5,
    defaultContextTokens: 2048,
    maxContextTokens: 3072,
    chatTemplateFamily: "qwen",
    sha256Hex: "626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d"
  },
  {
    id: "qwen3-4b",
    description: "Higher-quality chat for capable 8GB+ phones.",
    name: "Qwen3 4B Q4_K_M",
    url: "https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf",
    tier: "good",
    sizeMB: 2500,
    supportedPlatforms: ["android", "ios"],
    artifactSource: "Qwen official Hugging Face repository",
    artifactLicense: "Apache-2.0",
    lifecycleChannel: "supported",
    runtimeFormat: "gguf",
    artifactFileName: "Qwen3-4B-Q4_K_M.gguf",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "recommended",
    parameterCountB: 4,
    estimatedWorkingSetGB: 4.6,
    minimumRamGB: 8,
    minimumFreeStorageGB: 6,
    defaultContextTokens: 2048,
    maxContextTokens: 4096,
    generationPolicy: { thinkingMode: "disabled" },
    chatTemplateFamily: "qwen",
    sha256Hex: "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
  },
  {
    id: "qwen-2.5-7b",
    description: "Large option for high-RAM phones.",
    name: "Qwen 2.5 7B Instruct Q4_K_M",
    url: "https://huggingface.co/QuantFactory/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct.Q4_K_M.gguf",
    tier: "enhanced",
    sizeMB: 4680,
    supportedPlatforms: ["android", "ios"],
    artifactSource: "QuantFactory community GGUF quantization of Qwen 2.5 Instruct",
    artifactLicense: "Apache-2.0",
    lifecycleChannel: "supported",
    runtimeFormat: "gguf",
    artifactFileName: "Qwen2.5-7B-Instruct.Q4_K_M.gguf",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "alternative",
    parameterCountB: 7,
    estimatedWorkingSetGB: 7.5,
    minimumRamGB: 12,
    minimumFreeStorageGB: 9,
    defaultContextTokens: 3072,
    maxContextTokens: 4096,
    chatTemplateFamily: "qwen",
    sha256Hex: "4e9221217000d0fc8f5ffdbae51a7201fcc3613de18ff1b1cd8c7c01f924437b"
  },
  {
    id: "qwen3-14b",
    description: "Experimental high-RAM model for flagship devices only.",
    name: "Qwen3 14B Q4_K_M",
    url: "https://huggingface.co/Qwen/Qwen3-14B-GGUF/resolve/main/Qwen3-14B-Q4_K_M.gguf",
    tier: "flagship",
    sizeMB: 9000,
    supportedPlatforms: ["android", "ios"],
    artifactSource: "Qwen official Hugging Face repository",
    artifactLicense: "Apache-2.0",
    lifecycleChannel: "evaluation",
    runtimeFormat: "gguf",
    artifactFileName: "Qwen3-14B-Q4_K_M.gguf",
    activationPolicy: "manual",
    recommendationGroup: "experimental",
    parameterCountB: 14,
    estimatedWorkingSetGB: 14,
    minimumRamGB: 16,
    minimumFreeStorageGB: 14,
    defaultContextTokens: 4096,
    maxContextTokens: 4096,
    generationPolicy: { thinkingMode: "disabled" },
    chatTemplateFamily: "qwen",
    sha256Hex: "500a8806e85ee9c83f3ae08420295592451379b4f8cf2d0f41c15dffeb6b81f0"
  }
];
