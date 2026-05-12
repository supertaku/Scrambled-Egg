import { useCallback, useEffect, useRef, useState } from "react";

import {
  createSpeechToTextSession,
  getSpeechToTextSupport,
  type SpeechToTextSession
} from "@/services/speechToTextService";
import { detectReplyLanguage, speechLocaleForReplyLanguage } from "@/services/replyLanguageService";
import { logger } from "@/utils/logger";

import { getVoiceAutoSend } from "@/services/voiceSettingsService";

export type VoiceStatus = "error" | "idle" | "listening" | "processing" | "unsupported" | "sending_countdown";

export interface VoiceState {
  message: string | null;
  status: VoiceStatus;
}

const AUTO_SEND_COUNTDOWN_MS = 300;

export interface UseVoiceInputResult {
  voiceState: VoiceState;
  speechSupport: ReturnType<typeof getSpeechToTextSupport>;
  isListening: boolean;
  handleVoicePress: (
    currentDraft: string,
    onDraftChange: (value: string) => void,
    onErrorClear: () => void,
    onAutoSend: (finalText: string) => void,
    isLoading: boolean,
    isInitializing: boolean,
    isInFlight: boolean,
    abortOnPress?: () => void
  ) => Promise<void>;
  abortVoiceSession: () => void;
  cancelAutoSend: () => void;
}

function mergeTranscript(baseDraft: string, transcript: string): string {
  const cleanTranscript = transcript.trim();
  if (!cleanTranscript) return baseDraft.trim();
  const cleanBase = baseDraft.trim();
  return cleanBase ? `${cleanBase} ${cleanTranscript}` : cleanTranscript;
}

export function useVoiceInput(): UseVoiceInputResult {
  const [voiceState, setVoiceState] = useState<VoiceState>({ message: null, status: "idle" });
  const voiceSessionRef = useRef<SpeechToTextSession | null>(null);
  const voiceBaseDraftRef = useRef("");
  const voiceHadResultRef = useRef(false);
  const autoSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors voiceState.status so callbacks/closures always see the latest value
  // without forcing handleVoicePress to recreate on every status change.
  const voiceStatusRef = useRef<VoiceStatus>("idle");
  // Mirrors the live draft text. The auto-send timeout reads from this so it
  // dispatches the user's latest edits (not the transcript captured 300ms ago).
  const currentDraftRef = useRef("");
  const speechSupport = getSpeechToTextSupport();

  const isListening = voiceState.status === "listening";

  useEffect(() => {
    voiceStatusRef.current = voiceState.status;
  }, [voiceState.status]);

  const abortVoiceSession = useCallback(() => {
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
    }
    voiceSessionRef.current?.abort();
    voiceSessionRef.current = null;
  }, []);

  const cancelAutoSend = useCallback(() => {
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
      setVoiceState({ message: "Auto-send canceled.", status: "idle" });
    }
  }, []);

  const handleVoicePress = useCallback(async (
    currentDraft: string,
    onDraftChange: (value: string) => void,
    onErrorClear: () => void,
    onAutoSend: (finalText: string) => void,
    isLoading: boolean,
    isInitializing: boolean,
    isInFlight: boolean,
    abortOnPress?: () => void
  ) => {
    currentDraftRef.current = currentDraft;

    if (voiceStatusRef.current === "sending_countdown") {
      cancelAutoSend();
      return;
    }

    if (isListening) {
      try {
        await voiceSessionRef.current?.stop();
      } catch (err) {
        await voiceSessionRef.current?.abort();
        setVoiceState({
          message: err instanceof Error ? err.message : "Voice typing could not stop cleanly.",
          status: "error"
        });
      }
      voiceSessionRef.current = null;
      setVoiceState((current) =>
        current.status === "error" ? current : { message: "Voice typing stopped.", status: "idle" }
      );
      abortOnPress?.();
      return;
    }

    if (isInitializing || isLoading || isInFlight) {
      setVoiceState({ message: "Wait for Haki to finish before starting voice typing.", status: "error" });
      return;
    }

    const support = getSpeechToTextSupport();
    if (!support.supported) {
      setVoiceState({ message: support.message, status: "unsupported" });
      return;
    }

    voiceBaseDraftRef.current = currentDraft.trim();
    voiceHadResultRef.current = false;
    const voiceLocale = speechLocaleForReplyLanguage(detectReplyLanguage(currentDraft));

    // Wrap onDraftChange so we always know what's currently in the input
    // even if the user types after the final transcript arrives.
    const handleDraftChange = (value: string) => {
      currentDraftRef.current = value;
      onDraftChange(value);
    };

    const session = createSpeechToTextSession({
      onEnd: () => {
        voiceSessionRef.current = null;
        setVoiceState((current) => {
          if (current.status !== "listening") return current;
          return {
            message: voiceHadResultRef.current
              ? "Voice captured. Review it, then send when ready."
              : "Voice typing ended without speech.",
            status: "idle"
          };
        });
      },
      onError: (message) => {
        logger.voice.warn("Speech recognition error", { message });
        setVoiceState({ message, status: "error" });
      },
      onFinalResult: async (transcript) => {
        const nextDraft = mergeTranscript(voiceBaseDraftRef.current, transcript);
        voiceBaseDraftRef.current = nextDraft;
        voiceHadResultRef.current = true;
        handleDraftChange(nextDraft);
        onErrorClear();

        const autoSendEnabled = await getVoiceAutoSend();
        if (autoSendEnabled) {
          setVoiceState({ message: "Sending voice message...", status: "sending_countdown" });
          autoSendTimeoutRef.current = setTimeout(() => {
            // Clear the ref BEFORE firing so cancelAutoSend after this point
            // is a no-op rather than racing with the in-flight send.
            autoSendTimeoutRef.current = null;
            setVoiceState({ message: null, status: "idle" });
            // Read the latest draft so edits during the countdown are respected.
            const latestDraft = currentDraftRef.current.trim();
            onAutoSend(latestDraft || nextDraft);
          }, AUTO_SEND_COUNTDOWN_MS);
        } else {
          setVoiceState({ message: "Voice captured. Review it, then send when ready.", status: "idle" });
        }
      },
      onInterimResult: (transcript) => {
        voiceHadResultRef.current = true;
        handleDraftChange(mergeTranscript(voiceBaseDraftRef.current, transcript));
        onErrorClear();
      },
      onStart: () => {
        setVoiceState({ message: "Listening... speak your question now.", status: "listening" });
      }
    }, {
      locale: voiceLocale
    });

    if (!session) {
      setVoiceState({ message: support.message, status: "unsupported" });
      return;
    }

    voiceSessionRef.current = session;
    try {
      setVoiceState({ message: "Starting voice typing...", status: "processing" });
      await session.start();
    } catch (err) {
      voiceSessionRef.current = null;
      setVoiceState({
        message: err instanceof Error ? err.message : "Voice typing could not start.",
        status: "error"
      });
    }
  }, [isListening]);

  return { voiceState, speechSupport, isListening, handleVoicePress, abortVoiceSession, cancelAutoSend };
}
