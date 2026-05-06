import assert from "node:assert/strict";

import {
  buildLocalModelManifest,
  deriveModelMetadata,
  getLlamaContextSettingsForTier,
  validateImportedModel,
  type BuildManifestInput,
  type DeviceHardwareProfile
} from "../src/ai/localModelMetadata";
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

console.log("Local model manager tests passed.");
