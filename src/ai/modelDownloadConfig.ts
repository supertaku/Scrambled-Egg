import type { LocalModelTier } from "./LocalAIProvider";
import type { ChatTemplateFamily, LocalModelGenerationPolicy } from "./localModelMetadata";

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
    chatTemplateFamily: "qwen",
    sha256Hex: "74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db"
  },
  {
    id: "llama-3.2-1b",
    description: "Compact conversational model for most 6GB+ phones.",
    name: "Llama 3.2 1B Instruct Q4_K_M",
    url: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    tier: "minimum",
    sizeMB: 808,
    supportedPlatforms: ["android", "ios"],
    artifactSource: "bartowski community GGUF quantization of Meta Llama 3.2 Instruct",
    artifactLicense: "Llama 3.2 Community License",
    lifecycleChannel: "supported",
    chatTemplateFamily: "llama",
    sha256Hex: "6f85a640a97cf2bf5b8e764087b1e83da0fdb51d7c9fab7d0fece9385611df83"
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
    chatTemplateFamily: "qwen",
    sha256Hex: "626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d"
  },
  {
    id: "qwen3-4b",
    description: "Higher quality multilingual chat for 12GB+ phones.",
    name: "Qwen3 4B Q4_K_M",
    url: "https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf",
    tier: "enhanced",
    sizeMB: 2500,
    supportedPlatforms: ["android", "ios"],
    artifactSource: "Qwen official Hugging Face repository",
    artifactLicense: "Apache-2.0",
    lifecycleChannel: "supported",
    generationPolicy: { thinkingMode: "disabled" },
    chatTemplateFamily: "qwen",
    sha256Hex: "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
  },
  {
    id: "qwen-2.5-7b",
    description: "Largest option for high-RAM flagship phones.",
    name: "Qwen 2.5 7B Instruct Q4_K_M",
    url: "https://huggingface.co/QuantFactory/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct.Q4_K_M.gguf",
    tier: "flagship",
    sizeMB: 4680,
    supportedPlatforms: ["android", "ios"],
    artifactSource: "QuantFactory community GGUF quantization of Qwen 2.5 Instruct",
    artifactLicense: "Apache-2.0",
    lifecycleChannel: "supported",
    chatTemplateFamily: "qwen",
    sha256Hex: "4e9221217000d0fc8f5ffdbae51a7201fcc3613de18ff1b1cd8c7c01f924437b"
  }
];
