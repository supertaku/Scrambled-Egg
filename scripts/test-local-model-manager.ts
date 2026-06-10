import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildLocalModelManifest,
  catalogDownloadFitsHardwareForDownload,
  catalogDownloadFitsHardware,
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
  chooseExecutionProfile,
  executionCandidatesForHardware,
  modelPerformanceKey
} from "../src/ai/localModelPerformance";
import type { LocalModelPerformanceProfile } from "../src/ai/LocalAIProvider";
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
assert.ok(GGUF_MODELS.every((model) =>
  model.chatTemplateFamily === "llama" ||
  model.chatTemplateFamily === "qwen" ||
  model.chatTemplateFamily === "gemma" ||
  model.chatTemplateFamily === "phi"
));
assert.ok(GGUF_MODELS.every((model) => model.lifecycleChannel === "supported" || model.lifecycleChannel === "evaluation"));
assert.ok(GGUF_MODELS.every((model) => model.supportedPlatforms.includes("android") && model.supportedPlatforms.includes("ios")));
assert.equal(GGUF_MODELS.find((model) => model.id === "qwen3-4b")?.generationPolicy?.thinkingMode, "disabled");

const runtimeAwareCatalog = GGUF_MODELS as Array<(typeof GGUF_MODELS)[number] & {
  activationPolicy?: string;
  artifactKind?: string;
  defaultContextTokens?: number;
  evidenceLevel?: string;
  estimatedWorkingSetGB?: number;
  maxContextTokens?: number;
  minimumFreeStorageGB?: number;
  minimumRamGB?: number;
  modelFamily?: string;
  parameterCountB?: number;
  recommendedRamGB?: number;
  runtimeFormat?: string;
}>;
assert.ok(runtimeAwareCatalog.every((model) => model.runtimeFormat));
assert.ok(runtimeAwareCatalog.every((model) => model.artifactKind));
assert.ok(runtimeAwareCatalog.every((model) => model.evidenceLevel));
assert.ok(runtimeAwareCatalog.every((model) => typeof model.minimumRamGB === "number"));
assert.ok(runtimeAwareCatalog.every((model) => typeof model.recommendedRamGB === "number"));
assert.ok(runtimeAwareCatalog.every((model) => typeof model.minimumFreeStorageGB === "number"));
assert.ok(runtimeAwareCatalog.every((model) => typeof model.defaultContextTokens === "number"));
assert.ok(runtimeAwareCatalog.every((model) => typeof model.maxContextTokens === "number"));
assert.ok(runtimeAwareCatalog.every((model) => typeof model.estimatedWorkingSetGB === "number"));
assert.ok(runtimeAwareCatalog.every((model) => typeof model.parameterCountB === "number"));
assert.ok(runtimeAwareCatalog.every((model) => model.lifecycleChannel === "evaluation" || model.sha256Hex));
assert.equal(runtimeAwareCatalog.find((model) => model.id === "gemma-4-e2b-litert-lm")?.runtimeFormat, "litert-lm");
assert.equal(runtimeAwareCatalog.find((model) => model.id === "gemma-4-e2b-litert-lm")?.lifecycleChannel, "evaluation");
assert.equal(runtimeAwareCatalog.find((model) => model.id === "gemma-4-e2b-litert-lm")?.activationPolicy, "auto-after-smoke-test");
assert.equal(runtimeAwareCatalog.find((model) => model.id === "gemma-4-e2b-litert-lm")?.recommendationGroup, "recommended");
assert.equal(runtimeAwareCatalog.find((model) => model.id === "gemma-4-e2b-litert-lm")?.artifactFileName, "gemma-4-E2B-it.litertlm");
assert.match(runtimeAwareCatalog.find((model) => model.id === "gemma-4-e2b-litert-lm")?.url ?? "", /gemma-4-E2B-it\.litertlm$/);
assert.equal(runtimeAwareCatalog.find((model) => model.id === "gemma-4-e4b-litert-lm")?.minimumRamGB, 8);
assert.equal(runtimeAwareCatalog.find((model) => model.id === "gemma-4-e4b-litert-lm")?.activationPolicy, "auto-after-smoke-test");
assert.equal(runtimeAwareCatalog.find((model) => model.id === "gemma-4-e4b-litert-lm")?.artifactFileName, "gemma-4-E4B-it.litertlm");
assert.match(runtimeAwareCatalog.find((model) => model.id === "gemma-4-e4b-litert-lm")?.url ?? "", /gemma-4-E4B-it\.litertlm$/);
assert.equal(runtimeAwareCatalog.find((model) => model.id === "phi-4-mini-gguf")?.runtimeFormat, "gguf");
assert.equal(runtimeAwareCatalog.find((model) => model.id === "phi-4-mini-gguf")?.artifactKind, "single-file");
assert.equal(runtimeAwareCatalog.find((model) => model.id === "phi-4-mini-gguf")?.activationPolicy, "auto-after-smoke-test");
assert.match(runtimeAwareCatalog.find((model) => model.id === "phi-4-mini-gguf")?.url ?? "", /Phi-4-mini-instruct-Q4_K_M\.gguf$/);
assert.equal(runtimeAwareCatalog.find((model) => model.id === "phi-4-mini-onnx-int4")?.runtimeFormat, "onnx-genai");
assert.equal(runtimeAwareCatalog.find((model) => model.id === "phi-4-mini-onnx-int4")?.activationPolicy, "manual");
assert.equal(runtimeAwareCatalog.find((model) => model.id === "qwen3-8b")?.generationPolicy?.thinkingMode, "disabled");
assert.equal(runtimeAwareCatalog.find((model) => model.id === "qwen3-14b")?.lifecycleChannel, "evaluation");
assert.ok(["qwen-2.5-0.5b", "qwen-2.5-3b", "qwen-2.5-7b", "qwen3-4b", "qwen3-8b", "qwen3-14b"].every((id) =>
  runtimeAwareCatalog.some((model) => model.id === id && model.runtimeFormat === "gguf")
));
assert.ok(runtimeAwareCatalog.some((model) => model.id === "phi-4-mini-gguf" && model.runtimeFormat === "gguf"));

function compatibleCatalogIds(hardware: DeviceHardwareProfile): string[] {
  return GGUF_MODELS.filter((model) => catalogDownloadFitsHardware(model, hardware)).map((model) => model.id);
}

function compatibleCatalogIdsWithRuntime(
  hardware: DeviceHardwareProfile,
  runtimeAvailability: Partial<Record<string, boolean>>
): string[] {
  return GGUF_MODELS
    .filter((model) => catalogDownloadFitsHardware(model, hardware, runtimeAvailability))
    .map((model) => model.id);
}

function downloadableCatalogIds(hardware: DeviceHardwareProfile): string[] {
  return GGUF_MODELS
    .filter((model) => catalogDownloadFitsHardwareForDownload(model, hardware))
    .map((model) => model.id);
}

assert.deepEqual(compatibleCatalogIds({ ...capableAndroid, memoryGB: 4 }), ["qwen-2.5-0.5b", "llama-3.2-1b"]);
assert.ok(downloadableCatalogIds({ ...capableAndroid, memoryGB: 4, freeStorageGB: 20 }).includes("gemma-4-e2b-litert-lm"));
assert.ok(downloadableCatalogIds({ ...capableAndroid, memoryGB: 7.2, freeStorageGB: 20 }).includes("gemma-4-e4b-litert-lm"));
assert.equal(downloadableCatalogIds({ ...capableAndroid, memoryGB: 6.9, freeStorageGB: 20 }).includes("gemma-4-e4b-litert-lm"), false);
assert.deepEqual(
  compatibleCatalogIdsWithRuntime({ ...capableAndroid, memoryGB: 4, freeStorageGB: 20 }, { "litert-lm": true }),
  ["qwen-2.5-0.5b", "llama-3.2-1b", "gemma-4-e2b-litert-lm"]
);
assert.deepEqual(compatibleCatalogIds({ ...capableAndroid, memoryGB: 8 }), [
  "qwen-2.5-0.5b",
  "llama-3.2-1b",
  "llama-3.2-3b",
  "qwen-2.5-3b",
  "qwen3-4b",
  "phi-4-mini-gguf"
]);
assert.deepEqual(compatibleCatalogIdsWithRuntime({ ...capableAndroid, memoryGB: 8 }, { "litert-lm": true, "onnx-genai": true }), [
  "qwen-2.5-0.5b",
  "llama-3.2-1b",
  "gemma-4-e2b-litert-lm",
  "llama-3.2-3b",
  "qwen-2.5-3b",
  "qwen3-4b",
  "gemma-4-e4b-litert-lm",
  "phi-4-mini-gguf",
  "phi-4-mini-onnx-int4"
]);
assert.deepEqual(compatibleCatalogIds({ ...capableAndroid, memoryGB: 12 }), [
  "qwen-2.5-0.5b",
  "llama-3.2-1b",
  "llama-3.2-3b",
  "qwen-2.5-3b",
  "qwen3-4b",
  "phi-4-mini-gguf",
  "qwen-2.5-7b",
  "qwen3-8b"
]);
assert.deepEqual(compatibleCatalogIds({ ...capableAndroid, memoryGB: 8, freeStorageGB: 8 }), [
  "qwen-2.5-0.5b",
  "llama-3.2-1b",
  "llama-3.2-3b",
  "qwen-2.5-3b"
]);
assert.deepEqual(compatibleCatalogIds({ ...capableAndroid, memoryGB: 16, freeStorageGB: 40 }), [
  "qwen-2.5-0.5b",
  "llama-3.2-1b",
  "llama-3.2-3b",
  "qwen-2.5-3b",
  "qwen3-4b",
  "phi-4-mini-gguf",
  "qwen-2.5-7b",
  "qwen3-8b",
  "qwen3-14b"
]);
assert.deepEqual(compatibleCatalogIds({ ...capableAndroid, lowMemory: true }), []);
assert.deepEqual(
  compatibleCatalogIds({ ...capableAndroid, platform: "ios", supportedAbis: ["arm64"], architecture: "arm64", lowMemory: false }),
  ["qwen-2.5-0.5b", "llama-3.2-1b", "llama-3.2-3b", "qwen-2.5-3b", "qwen3-4b", "phi-4-mini-gguf"]
);

const openClCandidates = executionCandidatesForHardware({
  ...capableAndroid,
  backendDevices: ["cpu:Android CPU", "opencl:Adreno GPU"]
});
assert.equal(openClCandidates[0]?.backend, "cpu");
assert.equal(openClCandidates[1]?.backend, "opencl");
assert.deepEqual(openClCandidates[1]?.initOptions.devices, ["Adreno GPU"]);
assert.equal(executionCandidatesForHardware({
  ...capableAndroid,
  platform: "ios",
  supportedAbis: ["arm64"],
  architecture: "arm64"
})[1]?.backend, "metal");

const baselineProfile: LocalModelPerformanceProfile = {
  version: 1,
  modelKey: "sample",
  executionBackend: "cpu",
  accelerationStatus: "unavailable",
  availableBackends: ["cpu:Android CPU"],
  loadTimeMs: 100,
  firstTokenTimeMs: 90,
  decodeTokensPerSecond: 10,
  thermalStateBefore: "nominal",
  thermalStateAfter: "nominal",
  benchmarkedAt: "2026-05-24T00:00:00.000Z",
  failureReason: null
};
assert.equal(
  chooseExecutionProfile(baselineProfile, {
    ...baselineProfile,
    executionBackend: "opencl",
    decodeTokensPerSecond: 12
  }).executionBackend,
  "opencl"
);
assert.equal(
  chooseExecutionProfile(baselineProfile, {
    ...baselineProfile,
    executionBackend: "opencl",
    decodeTokensPerSecond: 12,
    thermalStateAfter: "serious"
  }).executionBackend,
  "cpu"
);

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

assert.equal(
  validateImportedModel({
    fileName: "gemma-4-E4B-it.litertlm",
    role: "chat",
    metadata: deriveModelMetadata({ originalName: "gemma-4-E4B-it.litertlm" }),
    sizeBytes: 2800 * 1024 ** 2,
    hardware: { ...capableAndroid, memoryGB: 7.2, freeStorageGB: 20 },
    runtimeFormat: "litert-lm",
    activationPolicy: "auto-after-smoke-test",
    minimumRamGB: 8,
    minimumFreeStorageGB: 7
  }).some((reason) => /requires at least 8GB RAM/.test(reason)),
  false
);

assert.match(
  validateImportedModel({
    fileName: "Qwen3-0.6B-Q4_K_M.gguf",
    role: "chat",
    metadata,
    sizeBytes: 512 * 1024 * 1024,
    hardware: { ...capableAndroid, supportedAbis: ["armeabi-v7a"], architecture: "armeabi-v7a" }
  }).join("\n"),
  /arm64/
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
assert.equal(modelPerformanceKey(manifest), "abc123");
assert.equal(modelPerformanceKey({ ...manifest, fileHash: null }), `${manifest.uri}:${manifest.sizeBytes}`);

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

const localModelManagerFacadeSource = readFileSync(new URL("../src/ai/localModelManager.ts", import.meta.url), "utf8");
assert.match(localModelManagerFacadeSource, /export \* from "\.\/local-models\/manager"/);
assert.ok(localModelManagerFacadeSource.split(/\r?\n/).filter(Boolean).length <= 2);

const localModelManagerSource = readFileSync(new URL("../src/ai/local-models/manager.ts", import.meta.url), "utf8");
assert.equal(/FileSystem\.makeDirectoryAsync|FileSystem\.copyAsync|FileSystem\.deleteAsync|FileSystem\.getInfoAsync/.test(localModelManagerSource), false);
assert.match(localModelManagerSource, /expo-file-system\/legacy/);
assert.match(localModelManagerSource, /cleanupPartialGgufDownloads/);
assert.match(localModelManagerSource, /migrateLegacyChatModel/);
assert.match(localModelManagerSource, /activateChatModel/);
assert.match(localModelManagerSource, /recoverInterruptedModelOperation/);
assert.match(localModelManagerSource, /phase: "verifying"/);
assert.match(localModelManagerSource, /phase: "waiting_for_chat"/);
assert.match(localModelManagerSource, /MANAGED_DOWNLOAD_RUNTIME_AVAILABILITY/);
assert.match(localModelManagerSource, /getManagedDownloadRuntimeAvailability/);
assert.match(localModelManagerSource, /getLiteRtLmNativeModule/);
assert.match(localModelManagerSource, /probeLiteRtLmActivation/);
assert.match(localModelManagerSource, /LiteRT-LM activation probe returned an empty response/);
assert.match(localModelManagerSource, /artifactFileName/);
assert.match(localModelManagerSource, /runtimeFormat === "litert-lm"/);
assert.match(localModelManagerSource, /model\.runtimeFormat !== "litert-lm"/);
assert.match(localModelManagerSource, /model\.runtimeFormat === "gguf"/);
assert.match(localModelManagerSource, /manifest\.activationPolicy !== "manual"/);
assert.doesNotMatch(localModelManagerSource, /ensureBundledDefaultChatModel/);

const localModelPathsSource = readFileSync(new URL("../src/ai/local-models/paths.ts", import.meta.url), "utf8");
assert.match(localModelPathsSource, /library\.json/);
assert.match(localModelPathsSource, /TEMP_DOWNLOAD_MARKER/);
assert.match(localModelPathsSource, /safeArtifactFileName/);

const localModelManifestStoreSource = readFileSync(new URL("../src/ai/local-models/manifestStore.ts", import.meta.url), "utf8");
assert.match(localModelManifestStoreSource, /parseManifest/);
assert.match(localModelManifestStoreSource, /statusFromManifest/);
assert.match(localModelManifestStoreSource, /filePathFromUri/);

const localModelOperationStoreSource = readFileSync(new URL("../src/ai/local-models/operationStore.ts", import.meta.url), "utf8");
assert.match(localModelOperationStoreSource, /emitOperation/);
assert.match(localModelOperationStoreSource, /patchOperation/);
assert.match(localModelOperationStoreSource, /subscribeModelOperation/);

const modelCatalogSource = readFileSync(new URL("../src/ai/modelCatalog.ts", import.meta.url), "utf8");
assert.match(modelCatalogSource, /catalogDownloadFitsHardware/);
assert.match(modelCatalogSource, /catalogDownloadFitsHardwareForDownload/);
assert.match(modelCatalogSource, /groupCatalogByRecommendation/);
assert.doesNotMatch(modelCatalogSource, /react-native/);

const localModelTierRulesSource = readFileSync(new URL("../src/ai/localModelTierRules.ts", import.meta.url), "utf8");
assert.match(localModelTierRulesSource, /ANDROID_LOCAL_MODEL_TIERS/);
assert.match(localModelTierRulesSource, /recommendedAndroidLocalModelTier/);
assert.doesNotMatch(localModelTierRulesSource, /react-native/);

const settingsSource = readFileSync(new URL("../src/components/settings/SettingsScreen.tsx", import.meta.url), "utf8");
assert.doesNotMatch(settingsSource, /downloadGgufModel/);
assert.doesNotMatch(settingsSource, /removeImportedModel/);
assert.doesNotMatch(settingsSource, /SettingsModelsSection/);
assert.match(settingsSource, /loadSettings\(true\)/);
assert.doesNotMatch(settingsSource, /ModelDownloader/);

const modelsScreenSource = readFileSync(new URL("../app/models.tsx", import.meta.url), "utf8");
assert.match(modelsScreenSource, /Recommended for this phone/);
assert.match(modelsScreenSource, /Compatible alternatives/);
assert.match(modelsScreenSource, /Experimental high-RAM/);
assert.match(modelsScreenSource, /If Haki feels slow/);
assert.doesNotMatch(modelsScreenSource, /Requires LiteRT-LM runtime before use/);
assert.doesNotMatch(modelsScreenSource, /Use runs an on-device check first/);
assert.doesNotMatch(modelsScreenSource, /catalogRuntimeNotices/);
assert.match(modelsScreenSource, /groupCatalogByRecommendation/);
assert.match(modelsScreenSource, /ModelCatalogSection/);
assert.match(modelsScreenSource, /ModelActionButton/);
assert.match(modelsScreenSource, /useModelManagerState/);
assert.doesNotMatch(modelsScreenSource, /getChatModelLibrary/);
assert.doesNotMatch(modelsScreenSource, /activateChatModel/);
assert.doesNotMatch(modelsScreenSource, /removeChatModel/);
assert.doesNotMatch(modelsScreenSource, /resumePausedModelDownload/);
assert.match(modelsScreenSource, /Campus Haki/);
assert.match(modelsScreenSource, /Friendly Haki/);

const modelCatalogSectionSource = readFileSync(new URL("../src/components/models/ModelCatalogSection.tsx", import.meta.url), "utf8");
assert.match(modelCatalogSectionSource, /activationPolicy === "manual"/);
assert.match(modelCatalogSectionSource, /catalogOperationLabel/);
assert.match(modelCatalogSectionSource, /Downloading\.\.\./);

const modelActionButtonSource = readFileSync(new URL("../src/components/models/ModelActionButton.tsx", import.meta.url), "utf8");
assert.match(modelActionButtonSource, /inProgressButton/);

const modelManagerStateHookSource = readFileSync(new URL("../src/hooks/useModelManagerState.ts", import.meta.url), "utf8");
assert.match(modelManagerStateHookSource, /subscribeModelOperation/);
assert.match(modelManagerStateHookSource, /recoverInterruptedModelOperation/);
assert.match(modelManagerStateHookSource, /refreshDeviceCapabilities/);
assert.match(modelManagerStateHookSource, /activateChatModel/);
assert.match(modelManagerStateHookSource, /removeChatModel/);
assert.match(modelManagerStateHookSource, /resumePausedModelDownload/);
assert.match(modelManagerStateHookSource, /downloadCatalogModel/);
assert.match(modelManagerStateHookSource, /pickAndImportGgufModel/);

const localProviderSource = readFileSync(new URL("../src/ai/LocalAIProvider.ts", import.meta.url), "utf8");
assert.match(localProviderSource, /"litert-lm"/);
assert.match(localProviderSource, /"onnx-genai"/);
assert.match(localProviderSource, /runtimeFormat/);

const nativeModulesSource = readFileSync(new URL("../src/ai/nativeModules.ts", import.meta.url), "utf8");
assert.match(nativeModulesSource, /getLiteRtLmNativeModule/);
assert.match(nativeModulesSource, /getOnnxGenAiNativeModule/);
assert.match(nativeModulesSource, /isRuntimeAvailable/);
assert.match(nativeModulesSource, /modelPath/);

const nativeRuntimeAdaptersSource = readFileSync(new URL("../src/ai/nativeRuntimeAdapters.ts", import.meta.url), "utf8");
assert.match(nativeRuntimeAdaptersSource, /liteRtLmRuntime/);
assert.match(nativeRuntimeAdaptersSource, /onnxGenAiRuntime/);
assert.match(nativeRuntimeAdaptersSource, /isRuntimeAvailable/);
assert.match(nativeRuntimeAdaptersSource, /release/);

const liteRtProviderSource = readFileSync(new URL("../src/ai/LiteRtLmProvider.ts", import.meta.url), "utf8");
assert.match(liteRtProviderSource, /liteRtLmRuntime/);
assert.doesNotMatch(liteRtProviderSource, /getLiteRtLmNativeModule/);

const onnxProviderSource = readFileSync(new URL("../src/ai/OnnxGenAiProvider.ts", import.meta.url), "utf8");
assert.match(onnxProviderSource, /onnxGenAiRuntime/);
assert.doesNotMatch(onnxProviderSource, /getOnnxGenAiNativeModule/);

const providerRegistrySource = readFileSync(new URL("../src/ai/providerRegistry.ts", import.meta.url), "utf8");
assert.match(providerRegistrySource, /LiteRtLmProvider/);
assert.match(providerRegistrySource, /OnnxGenAiProvider/);
assert.match(providerRegistrySource, /liteRtLm/);
assert.match(providerRegistrySource, /onnxGenAi/);

const localModelEvaluationSource = readFileSync(new URL("../src/ai/localModelEvaluation.ts", import.meta.url), "utf8");
assert.match(localModelEvaluationSource, /runLocalModelSmokeTest/);
assert.match(localModelEvaluationSource, /thermalStateBefore/);
assert.match(localModelEvaluationSource, /thermalStateAfter/);
assert.match(localModelEvaluationSource, /grounded-summary-citation/);
assert.match(localModelEvaluationSource, /unsupported-campus-facts/);
assert.match(localModelEvaluationSource, /english-only/);
assert.match(localModelEvaluationSource, /ambiguous-actor-clarification/);

const androidBuildSource = readFileSync(new URL("../android/app/build.gradle", import.meta.url), "utf8");
assert.match(androidBuildSource, /com\.google\.ai\.edge\.litertlm:litertlm-android:0\.10\.2/);
assert.match(androidBuildSource, /runtimeOnly\("com\.google\.ai\.edge\.litertlm:litertlm-android:0\.10\.2"\)/);

const androidProguardSource = readFileSync(new URL("../android/app/proguard-rules.pro", import.meta.url), "utf8");
assert.match(androidProguardSource, /-keep class com\.google\.ai\.edge\.litertlm\.\*\* \{ \*; \}/);
assert.match(androidProguardSource, /-keepclassmembers class com\.google\.ai\.edge\.litertlm\.\*\* \{ \*; \}/);

const androidManifestSource = readFileSync(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
assert.match(androidManifestSource, /libvndksupport\.so/);
assert.match(androidManifestSource, /libOpenCL\.so/);

const liteRtModuleSource = readFileSync(new URL("../android/app/src/main/java/com/tupt/haki/HakiLiteRtLmModule.kt", import.meta.url), "utf8");
assert.match(liteRtModuleSource, /class HakiLiteRtLmModule/);
assert.match(liteRtModuleSource, /EngineConfig/);
assert.match(liteRtModuleSource, /ConversationConfig/);
assert.match(liteRtModuleSource, /sendMessage/);
assert.match(liteRtModuleSource, /isRuntimeAvailable/);
assert.match(liteRtModuleSource, /messageText/);
assert.match(liteRtModuleSource, /getContents/);
assert.doesNotMatch(liteRtModuleSource, /response\?\.toString\(\)\?\.trim\(\)/);

const deviceInfoPackageSource = readFileSync(new URL("../android/app/src/main/java/com/tupt/haki/HakiDeviceInfoPackage.kt", import.meta.url), "utf8");
assert.match(deviceInfoPackageSource, /HakiLiteRtLmModule/);

const orgChartSource = readFileSync(new URL("../app/org-chart.tsx", import.meta.url), "utf8");
assert.doesNotMatch(orgChartSource, /SHOW_UNVERIFIED_ORG_CHART/);
assert.match(orgChartSource, /Preview seeded data for UI\/UX review/);

const hakiStatusSource = readFileSync(new URL("../src/components/models/ModelOperationHaki.tsx", import.meta.url), "utf8");
assert.match(hakiStatusSource, /The download is complete\. I'm checking the file before using it\./);
assert.match(hakiStatusSource, /Campus Haki is still available\./);
assert.match(hakiStatusSource, /interrupted download cannot be resumed/);
assert.match(hakiStatusSource, /HakiMascot/);

const apkInspectionSource = readFileSync(new URL("../scripts/inspect-apk-assets.ps1", import.meta.url), "utf8");
assert.match(apkInspectionSource, /Production builds must let users download compatible models into app-private storage/);
assert.match(apkInspectionSource, /librnllama/);
assert.doesNotMatch(apkInspectionSource, /missing the bundled default GGUF/);

console.log("Local model manager tests passed.");
