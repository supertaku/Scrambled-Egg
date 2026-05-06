export interface NativeVoiceHostModules {
  RCTVoice?: unknown;
  Voice?: unknown;
}

interface NativeVoiceExportObject {
  Voice?: unknown;
  default?: unknown;
}

export function hasLinkedNativeVoiceModule(nativeModules: NativeVoiceHostModules): boolean {
  return Boolean(nativeModules.Voice || nativeModules.RCTVoice);
}

export function resolveNativeVoiceExport(voiceModule: unknown): unknown {
  if (!voiceModule || typeof voiceModule !== "object") {
    return voiceModule;
  }

  const exported = voiceModule as NativeVoiceExportObject;

  if (exported.default) {
    return exported.default;
  }

  if (exported.Voice) {
    return exported.Voice;
  }

  return voiceModule;
}

export function isNativeVoiceModuleCandidate(candidate: unknown): boolean {
  return Boolean(
    candidate &&
      typeof candidate === "object" &&
      "start" in candidate &&
      "stop" in candidate &&
      "isAvailable" in candidate
  );
}
