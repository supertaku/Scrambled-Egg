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
import { catalogDownloadFitsHardwareForDownload } from "../src/ai/modelCatalog";
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
assert.ok(GGUF_MODELS.every((model) => model.runtimeFormat === "litert-lm" || Boolean(model.chatTemplateFamily)));
assert.equal(GGUF_MODELS.find((model) => model.id === "gemma-4-e2b-litert-lm")?.recommendationGroup, "recommended");
assert.equal(GGUF_MODELS.find((model) => model.id === "gemma-4-e4b-litert-lm")?.recommendationGroup, "recommended");
assert.deepEqual(GGUF_MODELS.find((model) => model.id === "gemma-4-e2b-litert-lm")?.supportedPlatforms, ["android"]);
assert.ok(GGUF_MODELS.every((model) => model.lifecycleChannel === "supported" || model.lifecycleChannel === "evaluation"));
assert.equal(GGUF_MODELS.find((model) => model.id === "qwen3-4b")?.generationPolicy?.thinkingMode, "disabled");
assert.equal(GGUF_MODELS.find((model) => model.id === "phi-4-mini-gguf")?.chatTemplateFamily, "phi");
assert.equal(GGUF_MODELS.find((model) => model.id === "phi-4-mini-gguf")?.recommendedRamGB, 12);
assert.equal(GGUF_MODELS.find((model) => model.id === "qwen3-8b")?.minimumRamGB, 12);
assert.ok(GGUF_MODELS.every((model) => /\/resolve\/[0-9a-f]{40}\//.test(model.url)));
assert.ok(GGUF_MODELS.every((model) => /^[0-9a-f]{40}$/.test(model.artifactRevision)));
assert.ok(GGUF_MODELS.every((model) => /^[0-9a-f]{64}$/.test(model.sha256Hex)));
assert.ok(GGUF_MODELS.every((model) => !model.id.includes("onnx") && !model.runtimeFormat.includes("onnx")));

function compatibleCatalogIds(hardware: DeviceHardwareProfile): string[] {
  return GGUF_MODELS.filter((model) => catalogDownloadFitsHardwareForDownload(model, hardware)).map((model) => model.id);
}

assert.deepEqual(compatibleCatalogIds({ ...capableAndroid, memoryGB: 4 }), [
  "qwen-2.5-0.5b",
  "llama-3.2-1b",
  "gemma-4-e2b-litert-lm"
]);
assert.deepEqual(compatibleCatalogIds({ ...capableAndroid, memoryGB: 8 }), [
  "qwen-2.5-0.5b",
  "llama-3.2-1b",
  "gemma-4-e2b-litert-lm",
  "gemma-4-e4b-litert-lm",
  "llama-3.2-3b",
  "qwen-2.5-3b",
  "qwen3-4b",
  "phi-4-mini-gguf"
]);
assert.deepEqual(compatibleCatalogIds({ ...capableAndroid, memoryGB: 7.1 }), [
  "qwen-2.5-0.5b",
  "llama-3.2-1b",
  "gemma-4-e2b-litert-lm",
  "gemma-4-e4b-litert-lm",
  "llama-3.2-3b"
]);
assert.deepEqual(compatibleCatalogIds({ ...capableAndroid, memoryGB: 12 }), [
  "qwen-2.5-0.5b",
  "llama-3.2-1b",
  "gemma-4-e2b-litert-lm",
  "gemma-4-e4b-litert-lm",
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
  "gemma-4-e2b-litert-lm",
  "llama-3.2-3b",
  "qwen-2.5-3b"
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
const manifest = buildLocalModelManifest({
  ...manifestInput,
  artifactRevision: "7ff82c2aaa4dde30121698a973765f39be5288c0",
  artifactSha256: "01999f17c39cc3074afae5e9c539bc82d45f2dd7faa3917c66cbef76fce8c0c2",
  minimumRamGB: 8,
  recommendedRamGB: 12,
  minimumFreeStorageGB: 6,
  requiredArchitecture: "arm64",
  fallbackModelIds: ["qwen3-4b"]
} as BuildManifestInput & Record<string, unknown>);
assert.equal(manifest.fileHashAlgorithm, "md5");
assert.equal(manifest.runtimeFormat, "gguf");
assert.equal(manifest.activationPolicy, "auto-after-smoke-test");
assert.equal(manifest.source, "downloaded");
assert.equal(manifest.downloadId, "qwen3-0.6b");
assert.equal(manifest.chatTemplate?.status, "unknown");
assert.equal(manifest.rejectionReasons.length, 0);
assert.equal(manifest.recommendedModelTier, "good");
assert.equal(manifest.artifactRevision, "7ff82c2aaa4dde30121698a973765f39be5288c0");
assert.equal(manifest.artifactSha256, "01999f17c39cc3074afae5e9c539bc82d45f2dd7faa3917c66cbef76fce8c0c2");
assert.equal(manifest.minimumRamGB, 8);
assert.equal(manifest.recommendedRamGB, 12);
assert.equal(manifest.minimumFreeStorageGB, 6);
assert.equal(manifest.requiredArchitecture, "arm64");
assert.deepEqual(manifest.fallbackModelIds, ["qwen3-4b"]);
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

const localModelManagerSource = readFileSync(new URL("../src/ai/localModelManager.ts", import.meta.url), "utf8");
const modelOperationCoordinatorSource = readFileSync(
  new URL("../src/ai/modelOperationCoordinator.ts", import.meta.url),
  "utf8"
);
assert.equal(/FileSystem\.makeDirectoryAsync|FileSystem\.copyAsync|FileSystem\.deleteAsync|FileSystem\.getInfoAsync/.test(localModelManagerSource), false);
assert.match(localModelManagerSource, /expo-file-system\/legacy/);
assert.match(localModelManagerSource, /cleanupPartialGgufDownloads/);
assert.match(localModelManagerSource, /library\.json/);
assert.match(localModelManagerSource, /migrateLegacyChatModel/);
assert.match(localModelManagerSource, /activateChatModel/);
assert.match(localModelManagerSource, /recoverInterruptedModelOperation/);
assert.match(localModelManagerSource, /phase: "verifying"/);
assert.match(localModelManagerSource, /modelOperationCoordinator/);
assert.match(modelOperationCoordinatorSource, /phase: "waiting_for_chat"/);
assert.match(modelOperationCoordinatorSource, /withInferenceLease/);
assert.doesNotMatch(localModelManagerSource, /ensureBundledDefaultChatModel/);

const settingsSource = readFileSync(new URL("../src/components/settings/SettingsScreen.tsx", import.meta.url), "utf8");
assert.doesNotMatch(settingsSource, /downloadGgufModel/);
assert.doesNotMatch(settingsSource, /removeImportedModel/);
assert.doesNotMatch(settingsSource, /SettingsModelsSection/);
assert.match(settingsSource, /loadSettings\(true\)/);
assert.doesNotMatch(settingsSource, /ModelDownloader/);

const modelsScreenSource = readFileSync(new URL("../app/models.tsx", import.meta.url), "utf8");
assert.match(modelsScreenSource, /Haki Models/);
assert.match(modelsScreenSource, /Recommended for this phone/);
assert.match(modelsScreenSource, /Other compatible models/);
assert.match(modelsScreenSource, /Campus Haki/);
assert.match(modelsScreenSource, /Friendly Haki/);
assert.match(modelsScreenSource, /activateChatModel/);
assert.match(modelsScreenSource, /removeChatModel/);
assert.match(modelsScreenSource, /resumePausedModelDownload/);
assert.match(modelsScreenSource, /ModelCatalogSection/);

assert.match(localModelManagerSource, /probeLiteRtLmActivation/);
assert.match(localModelManagerSource, /evaluationStatus/);
assert.match(localModelManagerSource, /runtimeAvailability/);
assert.match(localModelManagerSource, /catalogModel \? \{ modelTier: catalogModel\.tier \} : \{\}/);
const liteRtActivationProbeSource = localModelManagerSource.slice(
  localModelManagerSource.indexOf("async function probeLiteRtLmActivation"),
  localModelManagerSource.indexOf("async function probeGgufActivation")
);
assert.match(liteRtActivationProbeSource, /cleanupLiteRtActivationProbe/);
const modelActivationProbeSource = readFileSync(new URL("../src/ai/modelActivationProbe.ts", import.meta.url), "utf8");
assert.match(modelActivationProbeSource, /cancelGeneration/);
assert.match(modelActivationProbeSource, /release/);

const liteRtNativeSource = readFileSync(
  new URL("../android/app/src/main/java/com/tupt/haki/HakiLiteRtLmModule.kt", import.meta.url),
  "utf8"
);
assert.match(liteRtNativeSource, /fun cancelProcess\(/);
assert.match(liteRtNativeSource, /fun release\(/);
const proguardSource = readFileSync(new URL("../android/app/proguard-rules.pro", import.meta.url), "utf8");
assert.match(proguardSource, /-keep class com\.google\.ai\.edge\.litertlm\.\*\*/);

const liteRtProviderSource = readFileSync(new URL("../src/ai/LiteRtLmProvider.ts", import.meta.url), "utf8");
const liteRtSummarySource = liteRtProviderSource.slice(
  liteRtProviderSource.indexOf("async summarizeFromSources"),
  liteRtProviderSource.indexOf("async answerSafeChat")
);
assert.match(liteRtSummarySource, /requestId/);
assert.match(liteRtSummarySource, /createLiteRtGenerationGuard/);

const hakiStatusSource = readFileSync(new URL("../src/components/models/ModelOperationHaki.tsx", import.meta.url), "utf8");
assert.match(hakiStatusSource, /The download is complete\. I'm checking the file before using it\./);
assert.match(hakiStatusSource, /Campus Haki is still available\./);
assert.match(hakiStatusSource, /interrupted download cannot be resumed/);
assert.match(hakiStatusSource, /HakiMascotCompat/);

const apkInspectionSource = readFileSync(new URL("../scripts/inspect-apk-assets.ps1", import.meta.url), "utf8");
assert.match(apkInspectionSource, /Production builds must let users download compatible models into app-private storage/);
assert.match(apkInspectionSource, /librnllama/);
assert.match(apkInspectionSource, /liblitertlm_jni/);
assert.match(apkInspectionSource, /arm64-v8a/);
assert.match(apkInspectionSource, /com\/google\/ai\/edge\/litertlm\/Engine/);
assert.match(apkInspectionSource, /sendMessageAsync/);
assert.match(apkInspectionSource, /cancelProcess/);
assert.doesNotMatch(apkInspectionSource, /missing the bundled default GGUF/);

console.log("Local model manager tests passed.");
