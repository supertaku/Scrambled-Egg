import { NativeModules, PermissionsAndroid, Platform } from "react-native";
import type {
  SpeechErrorEvent,
  SpeechResultsEvent
} from "@react-native-voice/voice";
import {
  hasLinkedNativeVoiceModule,
  isNativeVoiceModuleCandidate,
  resolveNativeVoiceExport
} from "./nativeVoiceModuleGuard";
import {
  NEXT_SPEECH_RECOGNITION_TARGET,
  type SpeechRecognitionAdapter
} from "./speechRecognitionAdapter";

type SpeechRecognitionErrorCode =
  | "aborted"
  | "audio-capture"
  | "bad-grammar"
  | "language-not-supported"
  | "network"
  | "no-speech"
  | "not-allowed"
  | "phrases-not-supported"
  | "service-not-allowed";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike | undefined;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike | undefined;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  readonly error: SpeechRecognitionErrorCode;
  readonly message?: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onstart: (() => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface BrowserSpeechWindow {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export interface SpeechToTextSupport {
  message: string;
  reason?: "browser_unsupported" | "native_module_missing" | "ready";
  supported: boolean;
}

export interface SpeechToTextCallbacks {
  onEnd?: () => void;
  onError?: (message: string) => void;
  onFinalResult?: (transcript: string) => void;
  onInterimResult?: (transcript: string) => void;
  onStart?: () => void;
}

export interface SpeechToTextSession {
  abort: () => Promise<void> | void;
  start: () => Promise<void> | void;
  stop: () => Promise<void> | void;
}

export interface SpeechToTextSessionOptions {
  locale?: string;
}

interface NativeVoiceModule {
  cancel: () => Promise<unknown>;
  destroy: () => Promise<unknown>;
  isAvailable: () => Promise<0 | 1 | boolean | "0" | "1">;
  removeAllListeners: () => void;
  start: (locale: string, options?: Record<string, unknown>) => Promise<unknown>;
  stop: () => Promise<unknown>;
  onSpeechEnd: (event: unknown) => void;
  onSpeechError: (event: SpeechErrorEvent) => void;
  onSpeechPartialResults: (event: SpeechResultsEvent) => void;
  onSpeechResults: (event: SpeechResultsEvent) => void;
  onSpeechStart: (event: unknown) => void;
}

const DEFAULT_SPEECH_LOCALE = "en-PH";

const CUSTOM_BUILD_REQUIRED_MESSAGE =
  "Voice typing needs the custom Haki APK or development build. Expo Go cannot load this native speech module, so rebuild and install the custom app.";

const NO_RECOGNIZER_MESSAGE =
  "No speech recognition service is available on this device. Install or enable Google Speech Services, then try voice typing again.";

const MICROPHONE_PERMISSION_MESSAGE =
  "Microphone permission is blocked. Allow microphone access in Android app settings to use voice typing.";

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (Platform.OS !== "web" || typeof globalThis === "undefined") {
    return null;
  }

  const speechWindow = globalThis as unknown as BrowserSpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function getNativeVoiceModule(): NativeVoiceModule | null {
  if (Platform.OS === "web") {
    return null;
  }

  if (!hasLinkedNativeVoiceModule(NativeModules)) {
    return null;
  }

  try {
    const voiceModule = require("@react-native-voice/voice") as unknown;
    const candidate = resolveNativeVoiceExport(voiceModule);

    if (isNativeVoiceModuleCandidate(candidate)) {
      return candidate as NativeVoiceModule;
    }

    return hasLinkedNativeVoiceModule(NativeModules) ? (candidate as NativeVoiceModule) : null;
  } catch {
    return null;
  }
}

export function getSpeechToTextSupport(): SpeechToTextSupport {
  if (Platform.OS !== "web") {
    if (getNativeVoiceModule()) {
      return {
        reason: "ready",
        supported: true,
        message: "Voice typing is ready."
      };
    }

    return {
      reason: "native_module_missing",
      supported: false,
      message: CUSTOM_BUILD_REQUIRED_MESSAGE
    };
  }

  if (!getSpeechRecognitionConstructor()) {
    return {
      reason: "browser_unsupported",
      supported: false,
      message: "This browser does not support built-in speech recognition."
    };
  }

  return {
    reason: "ready",
    supported: true,
    message: "Voice typing is ready."
  };
}

function getTranscriptFromEvent(event: SpeechRecognitionEventLike): { finalTranscript: string; interimTranscript: string } {
  let finalTranscript = "";
  let interimTranscript = "";

  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index];
    const transcript = result?.[0]?.transcript.trim();

    if (!result || !transcript) {
      continue;
    }

    if (result.isFinal) {
      finalTranscript = `${finalTranscript} ${transcript}`.trim();
    } else {
      interimTranscript = `${interimTranscript} ${transcript}`.trim();
    }
  }

  return { finalTranscript, interimTranscript };
}

function formatSpeechRecognitionError(error: SpeechRecognitionErrorCode, fallback?: string): string {
  switch (error) {
    case "audio-capture":
      return "No microphone was detected. Check your browser or device microphone settings.";
    case "language-not-supported":
      return "Voice typing is not available for the selected speech language.";
    case "network":
      return "Voice recognition could not connect. Check your connection and try again.";
    case "no-speech":
      return "I did not catch anything. Try the mic again and speak after it starts listening.";
    case "not-allowed":
    case "service-not-allowed":
      return Platform.OS === "web"
        ? "Microphone permission is blocked. Allow microphone access in your browser to use voice typing."
        : MICROPHONE_PERMISSION_MESSAGE;
    case "aborted":
      return "Voice typing stopped.";
    default:
      return fallback?.trim() || "Voice typing stopped unexpectedly.";
  }
}

export function createSpeechToTextSession(
  callbacks: SpeechToTextCallbacks,
  options: SpeechToTextSessionOptions = {}
): SpeechToTextSession | null {
  if (Platform.OS !== "web") {
    return createNativeSpeechToTextSession(callbacks, options);
  }

  const Recognition = getSpeechRecognitionConstructor();

  if (!Recognition) {
    return null;
  }

  const recognition = new Recognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = options.locale ?? DEFAULT_SPEECH_LOCALE;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    callbacks.onStart?.();
  };

  recognition.onresult = (event) => {
    const { finalTranscript, interimTranscript } = getTranscriptFromEvent(event);

    if (interimTranscript) {
      callbacks.onInterimResult?.(interimTranscript);
    }

    if (finalTranscript) {
      callbacks.onFinalResult?.(finalTranscript);
    }
  };

  recognition.onerror = (event) => {
    callbacks.onError?.(formatSpeechRecognitionError(event.error, event.message));
  };

  recognition.onend = () => {
    callbacks.onEnd?.();
  };

  return {
    abort: () => recognition.abort(),
    start: () => recognition.start(),
    stop: () => recognition.stop()
  };
}

export const speechRecognitionAdapter: SpeechRecognitionAdapter<
  SpeechToTextSupport,
  SpeechToTextCallbacks,
  SpeechToTextSessionOptions,
  SpeechToTextSession
> = {
  id: "react-native-voice",
  migrationTarget: NEXT_SPEECH_RECOGNITION_TARGET,
  getSupport: getSpeechToTextSupport,
  createSession: createSpeechToTextSession
};

function getNativeTranscript(event: SpeechResultsEvent): string {
  return event.value?.find((value) => value.trim().length > 0)?.trim() ?? "";
}

function formatNativeSpeechError(event: SpeechErrorEvent): string {
  const message = event.error?.message?.trim();
  const code = event.error?.code?.trim();

  if (message && /permission|not.?allowed|denied/i.test(message)) {
    return MICROPHONE_PERMISSION_MESSAGE;
  }

  if (message && /not.?linked|native module|cannot be null|voice.*null/i.test(message)) {
    return CUSTOM_BUILD_REQUIRED_MESSAGE;
  }

  if (message && /not available|recognition service|speech service|no recognizer/i.test(message)) {
    return NO_RECOGNIZER_MESSAGE;
  }

  if (message) {
    return message;
  }

  if (code) {
    return `Voice typing stopped (${code}).`;
  }

  return "Voice typing stopped unexpectedly.";
}

function isAvailableResultReady(value: Awaited<ReturnType<NativeVoiceModule["isAvailable"]>>): boolean {
  return value === true || value === 1 || value === "1";
}

function nativeStartErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/permission|not.?allowed|denied/i.test(message)) {
    return MICROPHONE_PERMISSION_MESSAGE;
  }

  if (/not.?linked|native module|cannot be null|voice.*null|undefined is not an object/i.test(message)) {
    return CUSTOM_BUILD_REQUIRED_MESSAGE;
  }

  if (/not available|recognition service|speech service|no recognizer/i.test(message)) {
    return NO_RECOGNIZER_MESSAGE;
  }

  return message || "Voice typing could not start.";
}

async function ensureNativeMicrophonePermission(): Promise<void> {
  if (Platform.OS !== "android") return;

  const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
  const alreadyGranted = await PermissionsAndroid.check(permission);
  if (alreadyGranted) return;

  const result = await PermissionsAndroid.request(permission, {
    title: "Microphone permission",
    message: "Haki needs microphone access for voice typing.",
    buttonPositive: "Allow",
    buttonNegative: "Cancel"
  });

  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error(MICROPHONE_PERMISSION_MESSAGE);
  }
}

function createNativeSpeechToTextSession(
  callbacks: SpeechToTextCallbacks,
  options: SpeechToTextSessionOptions = {}
): SpeechToTextSession | null {
  const Voice = getNativeVoiceModule();

  if (!Voice) {
    return null;
  }

  const nativeVoice = Voice;
  let cleanedUp = false;

  function cleanup(destroy = false) {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    nativeVoice.removeAllListeners();
    if (destroy) {
      void nativeVoice.destroy().catch(() => undefined);
    }
  }

  nativeVoice.onSpeechStart = () => {
    callbacks.onStart?.();
  };

  nativeVoice.onSpeechPartialResults = (event) => {
    const transcript = getNativeTranscript(event);
    if (transcript) {
      callbacks.onInterimResult?.(transcript);
    }
  };

  nativeVoice.onSpeechResults = (event) => {
    const transcript = getNativeTranscript(event);
    if (transcript) {
      callbacks.onFinalResult?.(transcript);
    }
  };

  nativeVoice.onSpeechError = (event) => {
    callbacks.onError?.(formatNativeSpeechError(event));
    cleanup(true);
  };

  nativeVoice.onSpeechEnd = () => {
    callbacks.onEnd?.();
    cleanup(true);
  };

  return {
    abort: async () => {
      try {
        await nativeVoice.cancel();
      } finally {
        cleanup();
        await nativeVoice.destroy().catch(() => undefined);
      }
    },
    start: async () => {
      try {
        await ensureNativeMicrophonePermission();

        const available = await nativeVoice.isAvailable();
        if (!isAvailableResultReady(available)) {
          throw new Error(NO_RECOGNIZER_MESSAGE);
        }

        await nativeVoice.start(options.locale ?? DEFAULT_SPEECH_LOCALE, {
          EXTRA_LANGUAGE_MODEL: "LANGUAGE_MODEL_FREE_FORM",
          EXTRA_PARTIAL_RESULTS: true,
          REQUEST_PERMISSIONS_AUTO: false
        });
      } catch (error) {
        throw new Error(nativeStartErrorMessage(error));
      }
    },
    stop: async () => {
      try {
        await nativeVoice.stop();
      } finally {
        cleanup();
        await nativeVoice.destroy().catch(() => undefined);
      }
    }
  };
}
