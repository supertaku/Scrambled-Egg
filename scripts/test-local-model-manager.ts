import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildLocalModelManifest,
  deriveModelMetadata,
  getLlamaContextSettingsForTier,
  inferChatTemplateFamilyFromText,
  inferChatTemplateValidation,
  inferModelFamilyFromText,
  validateImportedModel,
  type BuildManifestInput,
  type DeviceHardwareProfile
} from "../src/ai/localModelMetadata";
import { GGUF_MODELS } from "../src/ai/modelDownloadConfig";
import {
  estimateTokens,
  pruneChatContext,
  safeInputBudgetTokens,
  safeOutputTokens,
  summaryBudgetForTier,
  truncateToEstimatedTokens
} from "../src/ai/tokenBudget";
import { buildConversationState, formatConversationState } from "../src/services/conversationStateService";
import { classifyStudentQuestionIntent } from "../src/services/questionIntentService";
import {
  hasLinkedNativeVoiceModule,
  isNativeVoiceModuleCandidate,
  resolveNativeVoiceExport
} from "../src/services/nativeVoiceModuleGuard";

const capableAndroid: DeviceHardwareProfile = {
  platform: "android",
  osVersion: "35",
  supportedAbis: ["arm64-v8a", "armeabi-v7a"],
  architecture: "arm64-v8a, armeabi-v7a",
  memoryGB: 8,
  memoryClass: "1.0GB app heap class",
  lowMemory: false,
  freeStorageGB: 20,
  backendDevices: ["cpu:Android CPU"]
};

const metadata = deriveModelMetadata({
  originalName: "Qwen3-0.6B-Q4_K_M.gguf",
  modelInfo: {
    general: {
      name: "Qwen3 0.6B Q4_K_M"
    }
  }
});

assert.equal(metadata.modelParameterCountB, 0.6);
assert.equal(metadata.modelTier, "tiny");
assert.equal(metadata.modelQuantization, "q4_k_m");
assert.equal(metadata.chatTemplate.status, "unknown");
assert.equal(metadata.chatTemplate.modelFamily, "qwen");

assert.deepEqual(
  validateImportedModel({
    fileName: "Qwen3-0.6B-Q4_K_M.gguf",
    role: "chat",
    metadata,
    sizeBytes: 512 * 1024 * 1024,
    hardware: capableAndroid
  }),
  []
);

assert.equal(inferModelFamilyFromText("Meta-Llama-3.2-1B-Instruct-Q4_K_M.gguf"), "llama");
assert.equal(inferModelFamilyFromText("qwen2.5-3b-instruct-q4_k_m.gguf"), "qwen");
assert.equal(inferModelFamilyFromText("gemma-3-1b-it-q4_k_m.gguf"), "gemma");
assert.equal(inferModelFamilyFromText("Phi-3-mini-4k-instruct-q4.gguf"), "phi");
assert.equal(inferChatTemplateFamilyFromText("<|start_header_id|>user<|end_header_id|>"), "llama");
assert.equal(inferChatTemplateFamilyFromText("<|im_start|>user\nhello<|im_end|>"), "qwen");
assert.equal(inferChatTemplateFamilyFromText("<start_of_turn>user\nhello<end_of_turn>"), "gemma");
assert.equal(inferChatTemplateFamilyFromText("<|system|>You are helpful<|end|><|user|>Hi<|end|>"), "phi");

assert.deepEqual(
  inferChatTemplateValidation({
    rawInfo: {
      general: { architecture: "llama", name: "Llama 3.2 1B Instruct" },
      tokenizer: { chat_template: "<|begin_of_text|><|start_header_id|>user<|end_header_id|>{{ content }}" }
    },
    modelName: "Llama 3.2 1B Instruct Q4_K_M",
    fileName: "Llama-3.2-1B-Instruct-Q4_K_M.gguf"
  }),
  {
    status: "supported",
    modelFamily: "llama",
    templateFamily: "llama",
    reason: "GGUF chat template appears compatible with the llama model family.",
    modelFamilySource: "gguf-metadata",
    templateFamilySource: "gguf-metadata"
  }
);

assert.equal(
  inferChatTemplateValidation({
    rawInfo: {
      general: { architecture: "qwen2", name: "Qwen2.5 3B Instruct" },
      tokenizer: { chat_template: "<|im_start|>user\n{{ content }}<|im_end|>" }
    },
    modelName: "Qwen2.5 3B Instruct",
    fileName: "qwen2.5-3b-instruct-q4_k_m.gguf"
  }).status,
  "supported"
);

assert.equal(
  inferChatTemplateValidation({
    rawInfo: {
      general: { architecture: "gemma", name: "Gemma 3 1B IT" },
      tokenizer: { chat_template: "<start_of_turn>user\n{{ content }}<end_of_turn>" }
    },
    modelName: "Gemma 3 1B IT",
    fileName: "gemma-3-1b-it-q4_k_m.gguf"
  }).templateFamily,
  "gemma"
);

assert.equal(
  inferChatTemplateValidation({
    rawInfo: {
      general: { architecture: "phi3", name: "Phi-3 Mini Instruct" },
      tokenizer: { chat_template: "<|system|>{{ system }}<|end|><|user|>{{ prompt }}<|end|><|assistant|>" }
    },
    modelName: "Phi-3 Mini Instruct",
    fileName: "Phi-3-mini-4k-instruct-q4.gguf"
  }).templateFamily,
  "phi"
);

const unknownTemplateMetadata = deriveModelMetadata({
  originalName: "Mystery-1B-Q4_K_M.gguf",
  modelInfo: {
    general: {
      name: "Mystery 1B Q4_K_M"
    }
  }
});
assert.equal(unknownTemplateMetadata.chatTemplate.status, "unknown");
assert.deepEqual(
  validateImportedModel({
    fileName: "Mystery-1B-Q4_K_M.gguf",
    role: "chat",
    metadata: unknownTemplateMetadata,
    sizeBytes: 800 * 1024 * 1024,
    hardware: capableAndroid
  }),
  []
);

const mismatchedTemplateMetadata = deriveModelMetadata({
  originalName: "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
  modelInfo: {
    general: {
      architecture: "llama",
      name: "Llama 3.2 1B Instruct Q4_K_M"
    },
    tokenizer: {
      chat_template: "<|im_start|>user\n{{ content }}<|im_end|>"
    }
  }
});
assert.equal(mismatchedTemplateMetadata.chatTemplate.status, "mismatch");
assert.match(
  validateImportedModel({
    fileName: "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    role: "chat",
    metadata: mismatchedTemplateMetadata,
    sizeBytes: 808 * 1024 * 1024,
    hardware: capableAndroid
  }).join("\n"),
  /template mismatch/
);
assert.ok(GGUF_MODELS.every((model) => model.chatTemplateFamily === "llama" || model.chatTemplateFamily === "qwen"));

assert.match(
  validateImportedModel({
    fileName: "Qwen3-0.6B-Q4_K_M.bin",
    role: "chat",
    metadata,
    sizeBytes: 512 * 1024 * 1024,
    hardware: capableAndroid
  }).join("\n"),
  /\.gguf/
);

assert.match(
  validateImportedModel({
    fileName: "Llama-7B-Q4_K_M.gguf",
    role: "chat",
    metadata: deriveModelMetadata({ originalName: "Llama-7B-Q4_K_M.gguf" }),
    sizeBytes: 4 * 1024 ** 3,
    hardware: { ...capableAndroid, memoryGB: 4, freeStorageGB: 5 }
  }).join("\n"),
  /requires at least/
);

assert.match(
  validateImportedModel({
    fileName: "Qwen3-0.6B-Q4_K_M.gguf",
    role: "chat",
    metadata,
    sizeBytes: 512 * 1024 * 1024,
    hardware: { ...capableAndroid, supportedAbis: ["armeabi-v7a"], architecture: "armeabi-v7a" }
  }).join("\n"),
  /arm64-v8a/
);

const manifestInput: BuildManifestInput = {
  role: "chat",
  source: "downloaded",
  sourceId: "qwen3-0.6b",
  downloadId: "qwen3-0.6b",
  originalName: "Qwen3-0.6B-Q4_K_M.gguf",
  storedName: "haki-chat.gguf",
  uri: "file:///models/haki-chat.gguf",
  manifestPath: "file:///models/chat-model-manifest.json",
  sizeBytes: 512 * 1024 * 1024,
  fileHash: "abc123",
  metadata,
  hardware: capableAndroid,
  now: "2026-05-06T00:00:00.000Z"
};
const manifest = buildLocalModelManifest(manifestInput);
assert.equal(manifest.fileHashAlgorithm, "md5");
assert.equal(manifest.source, "downloaded");
assert.equal(manifest.downloadId, "qwen3-0.6b");
assert.equal(manifest.chatTemplate?.status, "unknown");
assert.equal(manifest.rejectionReasons.length, 0);
assert.equal(manifest.recommendedModelTier, "good");

assert.deepEqual(getLlamaContextSettingsForTier("tiny", false), {
  nCtx: 1280,
  nBatch: 128,
  nThreads: 3
});

assert.equal(hasLinkedNativeVoiceModule({}), false);
assert.equal(hasLinkedNativeVoiceModule({ Voice: null, RCTVoice: undefined }), false);
assert.equal(hasLinkedNativeVoiceModule({ RCTVoice: {} }), true);

const fakeVoiceModule = {
  isAvailable: () => Promise.resolve(true),
  start: () => Promise.resolve(),
  stop: () => Promise.resolve()
};

assert.equal(resolveNativeVoiceExport({ default: fakeVoiceModule }), fakeVoiceModule);
assert.equal(resolveNativeVoiceExport({ Voice: fakeVoiceModule }), fakeVoiceModule);
assert.equal(isNativeVoiceModuleCandidate({}), false);
assert.equal(isNativeVoiceModuleCandidate(fakeVoiceModule), true);

assert.equal(estimateTokens("12345678"), 2);
assert.ok(estimateTokens("paano po ako mag enroll") > estimateTokens("how do i enroll"));
assert.equal(truncateToEstimatedTokens("123456789", 2), "1234567");
assert.equal(safeOutputTokens(1280, "safe-chat"), 320);
assert.equal(safeInputBudgetTokens(1280, 320), 832);
assert.deepEqual(summaryBudgetForTier("tiny"), { maxSources: 2, maxSourceTokens: 500 });
assert.deepEqual(summaryBudgetForTier("flagship"), { maxSources: 8, maxSourceTokens: 3200 });

const prunedContext = pruneChatContext([
  { sender: "user", text: "first ".repeat(160) },
  { sender: "haki", text: "second ".repeat(160) },
  { sender: "user", text: "latest question" }
], 120, 6);
assert.equal(prunedContext.at(-1)?.text, "latest question");
assert.ok(prunedContext.length < 3);

assert.equal(classifyStudentQuestionIntent("how can i cheet in exam?").type, "unsafe_request");
assert.equal(classifyStudentQuestionIntent("pano gumawa ng kodigo sa quiz?").type, "unsafe_request");
assert.equal(classifyStudentQuestionIntent("how do I copy a file in Python?").type, "safe_question");

const teacherStateIntent = classifyStudentQuestionIntent("my teacher needs the HR phone number before signing my MOA");
const teacherState = buildConversationState({
  intent: teacherStateIntent,
  messages: [],
  question: "my teacher needs the HR phone number before signing my MOA"
});
assert.equal(teacherState.activeEntity, "teacher");
assert.equal(teacherState.userGoal, "find contact information");
assert.match(formatConversationState(teacherState), /Active actor\/entity: teacher/);

const localModelManagerSource = readFileSync(new URL("../src/ai/localModelManager.ts", import.meta.url), "utf8");
assert.equal(/FileSystem\.makeDirectoryAsync|FileSystem\.copyAsync|FileSystem\.deleteAsync|FileSystem\.getInfoAsync/.test(localModelManagerSource), false);
assert.match(localModelManagerSource, /expo-file-system\/legacy/);
assert.match(localModelManagerSource, /cleanupPartialGgufDownloads/);

const settingsSource = readFileSync(new URL("../src/components/settings/SettingsScreen.tsx", import.meta.url), "utf8");
assert.match(settingsSource, /downloadGgufModel/);
assert.match(settingsSource, /removeImportedModel/);
assert.match(settingsSource, /await loadSettings\(true\)/);
assert.doesNotMatch(settingsSource, /ModelDownloader/);

console.log("Local model manager tests passed.");
