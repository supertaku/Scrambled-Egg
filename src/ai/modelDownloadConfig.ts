import type { LocalModelTier } from "./LocalAIProvider";
import type { ChatTemplateFamily, LocalModelGenerationPolicy } from "./localModelMetadata";

export interface ModelFileConfig {
  name: string;
  url: string;
}

export type ModelRuntimeFormat = "gguf" | "litert-lm" | "onnx-genai";
export type ModelArtifactKind = "single-file" | "directory";
export type ModelEvidenceLevel = "official-mobile-benchmark" | "official-local-artifact" | "community-gguf";
export type ModelActivationPolicy = "auto-after-smoke-test" | "manual";
export type ModelRecommendationGroup = "recommended" | "alternative" | "experimental";
export type RuntimeAvailability = Partial<Record<ModelRuntimeFormat, boolean>>;

export interface GgufDownloadConfig {
  id: string;
  description: string;
  name: string;
  url: string;
  tier: LocalModelTier;
  sizeMB: number;
  runtimeFormat: ModelRuntimeFormat;
  artifactKind: ModelArtifactKind;
  artifactFileName: string;
  modelFamily: Exclude<ChatTemplateFamily, "unknown">;
  parameterCountB: number;
  estimatedWorkingSetGB: number;
  minimumRamGB: number;
  recommendedRamGB: number;
  minimumFreeStorageGB: number;
  defaultContextTokens: number;
  maxContextTokens: number;
  evidenceLevel: ModelEvidenceLevel;
  activationPolicy: ModelActivationPolicy;
  recommendationGroup: ModelRecommendationGroup;
  supportedPlatforms: Array<"android" | "ios">;
  artifactSource: string;
  artifactLicense: string;
  lifecycleChannel: "supported" | "evaluation";
  generationPolicy?: LocalModelGenerationPolicy;
  /**
   * Expected prompt/chat-template family for the GGUF chat model. This is
   * manifest metadata only; validation still reads the GGUF metadata.
   */
  chatTemplateFamily?: Exclude<ChatTemplateFamily, "unknown">;
  /**
   * Expected SHA-256 of the downloaded file (Git LFS `oid`, lowercase hex).
   * When set, `downloadGgufModel` rejects mismatches before activation.
   */
  sha256Hex?: string;
}

function catalogEntry(input: GgufDownloadConfig): GgufDownloadConfig {
  return input;
}

export const GGUF_MODELS: GgufDownloadConfig[] = [
  catalogEntry({
    id: "qwen-2.5-0.5b",
    description: "Smallest fallback for older 4GB phones.",
    name: "Qwen 2.5 0.5B Instruct Q4_K_M",
    url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
    tier: "tiny",
    sizeMB: 491,
    runtimeFormat: "gguf",
    artifactKind: "single-file",
    artifactFileName: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    modelFamily: "qwen",
    parameterCountB: 0.5,
    estimatedWorkingSetGB: 0.9,
    minimumRamGB: 4,
    recommendedRamGB: 4,
    minimumFreeStorageGB: 3,
    defaultContextTokens: 1280,
    maxContextTokens: 2048,
    evidenceLevel: "official-local-artifact",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "alternative",
    supportedPlatforms: ["android", "ios"],
    artifactSource: "Qwen official Hugging Face repository",
    artifactLicense: "Apache-2.0",
    lifecycleChannel: "supported",
    chatTemplateFamily: "qwen",
    sha256Hex: "74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db"
  }),
  catalogEntry({
    id: "llama-3.2-1b",
    description: "Safe compact conversational model for true 4GB phones.",
    name: "Llama 3.2 1B Instruct Q4_K_M",
    url: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    tier: "tiny",
    sizeMB: 808,
    runtimeFormat: "gguf",
    artifactKind: "single-file",
    artifactFileName: "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    modelFamily: "llama",
    parameterCountB: 1,
    estimatedWorkingSetGB: 1.8,
    minimumRamGB: 4,
    recommendedRamGB: 6,
    minimumFreeStorageGB: 3,
    defaultContextTokens: 1280,
    maxContextTokens: 2048,
    evidenceLevel: "community-gguf",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "recommended",
    supportedPlatforms: ["android", "ios"],
    artifactSource: "bartowski community GGUF quantization of Meta Llama 3.2 Instruct",
    artifactLicense: "Llama 3.2 Community License",
    lifecycleChannel: "supported",
    chatTemplateFamily: "llama",
    sha256Hex: "6f85a640a97cf2bf5b8e764087b1e83da0fdb51d7c9fab7d0fece9385611df83"
  }),
  catalogEntry({
    id: "gemma-4-e2b-litert-lm",
    description: "Mobile-native Gemma model for capable phones.",
    name: "Gemma 4 E2B Instruct LiteRT-LM",
    url: "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm",
    tier: "minimum",
    sizeMB: 2583,
    runtimeFormat: "litert-lm",
    artifactKind: "single-file",
    artifactFileName: "gemma-4-E2B-it.litertlm",
    modelFamily: "gemma",
    parameterCountB: 2,
    estimatedWorkingSetGB: 2.4,
    minimumRamGB: 4,
    recommendedRamGB: 6,
    minimumFreeStorageGB: 5,
    defaultContextTokens: 2048,
    maxContextTokens: 32768,
    evidenceLevel: "official-mobile-benchmark",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "recommended",
    supportedPlatforms: ["android", "ios"],
    artifactSource: "Google LiteRT Community Hugging Face repository",
    artifactLicense: "Apache-2.0",
    lifecycleChannel: "evaluation",
    chatTemplateFamily: "gemma"
  }),
  catalogEntry({
    id: "llama-3.2-3b",
    description: "3B GGUF fallback for 6GB+ phones when LiteRT-LM is unavailable.",
    name: "Llama 3.2 3B Instruct Q4_K_M",
    url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    tier: "minimum",
    sizeMB: 2020,
    runtimeFormat: "gguf",
    artifactKind: "single-file",
    artifactFileName: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    modelFamily: "llama",
    parameterCountB: 3,
    estimatedWorkingSetGB: 4.4,
    minimumRamGB: 6,
    recommendedRamGB: 8,
    minimumFreeStorageGB: 5,
    defaultContextTokens: 1536,
    maxContextTokens: 2048,
    evidenceLevel: "community-gguf",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "alternative",
    supportedPlatforms: ["android", "ios"],
    artifactSource: "bartowski community GGUF quantization of Meta Llama 3.2 Instruct",
    artifactLicense: "Llama 3.2 Community License",
    lifecycleChannel: "supported",
    chatTemplateFamily: "llama",
    sha256Hex: "6c1a2b41161032677be168d354123594c0e6e67d2b9227c84f296ad037c728ff"
  }),
  catalogEntry({
    id: "qwen-2.5-3b",
    description: "Better instruction following for 8GB+ phones.",
    name: "Qwen 2.5 3B Instruct Q4_K_M",
    url: "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
    tier: "good",
    sizeMB: 2100,
    runtimeFormat: "gguf",
    artifactKind: "single-file",
    artifactFileName: "qwen2.5-3b-instruct-q4_k_m.gguf",
    modelFamily: "qwen",
    parameterCountB: 3,
    estimatedWorkingSetGB: 4,
    minimumRamGB: 8,
    recommendedRamGB: 8,
    minimumFreeStorageGB: 5,
    defaultContextTokens: 2048,
    maxContextTokens: 3072,
    evidenceLevel: "official-local-artifact",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "alternative",
    supportedPlatforms: ["android", "ios"],
    artifactSource: "Qwen official Hugging Face repository",
    artifactLicense: "Apache-2.0",
    lifecycleChannel: "supported",
    chatTemplateFamily: "qwen",
    sha256Hex: "626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d"
  }),
  catalogEntry({
    id: "qwen3-4b",
    description: "Higher quality multilingual chat for 12GB+ phones.",
    name: "Qwen3 4B Q4_K_M",
    url: "https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf",
    tier: "good",
    sizeMB: 2500,
    runtimeFormat: "gguf",
    artifactKind: "single-file",
    artifactFileName: "Qwen3-4B-Q4_K_M.gguf",
    modelFamily: "qwen",
    parameterCountB: 4,
    estimatedWorkingSetGB: 4.6,
    minimumRamGB: 8,
    recommendedRamGB: 12,
    minimumFreeStorageGB: 6,
    defaultContextTokens: 2048,
    maxContextTokens: 4096,
    evidenceLevel: "official-local-artifact",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "recommended",
    supportedPlatforms: ["android", "ios"],
    artifactSource: "Qwen official Hugging Face repository",
    artifactLicense: "Apache-2.0",
    lifecycleChannel: "supported",
    generationPolicy: { thinkingMode: "disabled" },
    chatTemplateFamily: "qwen",
    sha256Hex: "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
  }),
  catalogEntry({
    id: "gemma-4-e4b-litert-lm",
    description: "Larger mobile-native Gemma model for capable 8GB+ phones.",
    name: "Gemma 4 E4B Instruct LiteRT-LM",
    url: "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it.litertlm",
    tier: "good",
    sizeMB: 3654,
    runtimeFormat: "litert-lm",
    artifactKind: "single-file",
    artifactFileName: "gemma-4-E4B-it.litertlm",
    modelFamily: "gemma",
    parameterCountB: 4,
    estimatedWorkingSetGB: 3.5,
    minimumRamGB: 8,
    recommendedRamGB: 8,
    minimumFreeStorageGB: 7,
    defaultContextTokens: 2048,
    maxContextTokens: 32768,
    evidenceLevel: "official-mobile-benchmark",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "recommended",
    supportedPlatforms: ["android", "ios"],
    artifactSource: "Google LiteRT Community Hugging Face repository",
    artifactLicense: "Apache-2.0",
    lifecycleChannel: "evaluation",
    chatTemplateFamily: "gemma"
  }),
  catalogEntry({
    id: "phi-4-mini-gguf",
    description: "Reasoning-first Phi model for capable 8GB+ phones.",
    name: "Phi-4-mini Instruct Q4_K_M",
    url: "https://huggingface.co/bartowski/microsoft_Phi-4-mini-instruct-GGUF/resolve/main/microsoft_Phi-4-mini-instruct-Q4_K_M.gguf",
    tier: "good",
    sizeMB: 2490,
    runtimeFormat: "gguf",
    artifactKind: "single-file",
    artifactFileName: "microsoft_Phi-4-mini-instruct-Q4_K_M.gguf",
    modelFamily: "phi",
    parameterCountB: 3.8,
    estimatedWorkingSetGB: 4.8,
    minimumRamGB: 8,
    recommendedRamGB: 12,
    minimumFreeStorageGB: 6,
    defaultContextTokens: 2048,
    maxContextTokens: 4096,
    evidenceLevel: "community-gguf",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "alternative",
    supportedPlatforms: ["android", "ios"],
    artifactSource: "bartowski community GGUF quantization of Microsoft Phi-4-mini Instruct",
    artifactLicense: "MIT",
    lifecycleChannel: "evaluation",
    chatTemplateFamily: "phi"
  }),
  catalogEntry({
    id: "phi-4-mini-onnx-int4",
    description: "Reasoning-first 3.8B ONNX candidate for 8GB+ phones once the ONNX GenAI bridge is available.",
    name: "Phi-4-mini Instruct ONNX INT4",
    url: "https://huggingface.co/microsoft/Phi-4-mini-instruct-onnx",
    tier: "good",
    sizeMB: 4860,
    runtimeFormat: "onnx-genai",
    artifactKind: "directory",
    artifactFileName: "cpu_and_mobile/cpu-int4-rtn-block-32-acc-level-4",
    modelFamily: "phi",
    parameterCountB: 3.8,
    estimatedWorkingSetGB: 6.5,
    minimumRamGB: 8,
    recommendedRamGB: 12,
    minimumFreeStorageGB: 8,
    defaultContextTokens: 2048,
    maxContextTokens: 4096,
    evidenceLevel: "official-local-artifact",
    activationPolicy: "manual",
    recommendationGroup: "experimental",
    supportedPlatforms: ["android", "ios"],
    artifactSource: "Microsoft official Hugging Face ONNX repository",
    artifactLicense: "MIT",
    lifecycleChannel: "evaluation",
    chatTemplateFamily: "phi"
  }),
  catalogEntry({
    id: "qwen-2.5-7b",
    description: "Legacy high-quality Qwen GGUF alternative for 12GB+ phones.",
    name: "Qwen 2.5 7B Instruct Q4_K_M",
    url: "https://huggingface.co/QuantFactory/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct.Q4_K_M.gguf",
    tier: "enhanced",
    sizeMB: 4680,
    runtimeFormat: "gguf",
    artifactKind: "single-file",
    artifactFileName: "Qwen2.5-7B-Instruct.Q4_K_M.gguf",
    modelFamily: "qwen",
    parameterCountB: 7,
    estimatedWorkingSetGB: 7.5,
    minimumRamGB: 12,
    recommendedRamGB: 12,
    minimumFreeStorageGB: 9,
    defaultContextTokens: 3072,
    maxContextTokens: 4096,
    evidenceLevel: "community-gguf",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "alternative",
    supportedPlatforms: ["android", "ios"],
    artifactSource: "QuantFactory community GGUF quantization of Qwen 2.5 Instruct",
    artifactLicense: "Apache-2.0",
    lifecycleChannel: "supported",
    chatTemplateFamily: "qwen",
    sha256Hex: "4e9221217000d0fc8f5ffdbae51a7201fcc3613de18ff1b1cd8c7c01f924437b"
  }),
  catalogEntry({
    id: "qwen3-8b",
    description: "Stronger text-only GGUF model for 12GB+ phones.",
    name: "Qwen3 8B Q4_K_M",
    url: "https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf",
    tier: "enhanced",
    sizeMB: 5030,
    runtimeFormat: "gguf",
    artifactKind: "single-file",
    artifactFileName: "Qwen3-8B-Q4_K_M.gguf",
    modelFamily: "qwen",
    parameterCountB: 8,
    estimatedWorkingSetGB: 8,
    minimumRamGB: 12,
    recommendedRamGB: 12,
    minimumFreeStorageGB: 10,
    defaultContextTokens: 3072,
    maxContextTokens: 4096,
    evidenceLevel: "official-local-artifact",
    activationPolicy: "auto-after-smoke-test",
    recommendationGroup: "recommended",
    supportedPlatforms: ["android", "ios"],
    artifactSource: "Qwen official Hugging Face repository",
    artifactLicense: "Apache-2.0",
    lifecycleChannel: "supported",
    generationPolicy: { thinkingMode: "disabled" },
    chatTemplateFamily: "qwen",
    sha256Hex: "d98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785"
  }),
  catalogEntry({
    id: "qwen3-14b",
    description: "Advanced high-RAM GGUF candidate for 16GB+ phones; manual activation until real-device smoke tests pass.",
    name: "Qwen3 14B Q4_K_M",
    url: "https://huggingface.co/Qwen/Qwen3-14B-GGUF/resolve/main/Qwen3-14B-Q4_K_M.gguf",
    tier: "flagship",
    sizeMB: 9000,
    runtimeFormat: "gguf",
    artifactKind: "single-file",
    artifactFileName: "Qwen3-14B-Q4_K_M.gguf",
    modelFamily: "qwen",
    parameterCountB: 14,
    estimatedWorkingSetGB: 14,
    minimumRamGB: 16,
    recommendedRamGB: 16,
    minimumFreeStorageGB: 14,
    defaultContextTokens: 4096,
    maxContextTokens: 4096,
    evidenceLevel: "official-local-artifact",
    activationPolicy: "manual",
    recommendationGroup: "experimental",
    supportedPlatforms: ["android", "ios"],
    artifactSource: "Qwen official Hugging Face repository",
    artifactLicense: "Apache-2.0",
    lifecycleChannel: "evaluation",
    generationPolicy: { thinkingMode: "disabled" },
    chatTemplateFamily: "qwen",
    sha256Hex: "500a8806e85ee9c83f3ae08420295592451379b4f8cf2d0f41c15dffeb6b81f0"
  })
];
