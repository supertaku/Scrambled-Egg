import { useCallback, useRef, useState } from "react";

import {
  createSpeechToTextSession,
  getSpeechToTextSupport,
  type SpeechToTextSession
} from "@/services/speechToTextService";
import { detectReplyLanguage, speechLocaleForReplyLanguage } from "@/services/replyLanguageService";
import { logger } from "@/utils/logger";

export type VoiceStatus = "error" | "idle" | "listening" | "processing" | "unsupported";

export interface VoiceState {
  message: string | null;
  status: VoiceStatus;
}

export interface UseVoiceInputResult {
  voiceState: VoiceState;
  speechSupport: ReturnType<typeof getSpeechToTextSupport>;
  isListening: boolean;
  handleVoicePress: (
    currentDraft: string,
    onDraftChange: (value: string) => void,
    onErrorClear: () => void,
    isLoading: boolean,
    isInitializing: boolean,
    isInFlight: boolean,
    abortOnPress?: () => void
  ) => Promise<void>;
  abortVoiceSession: () => void;
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
  const speechSupport = getSpeechToTextSupport();

  const isListening = voiceState.status === "listening";

  const abortVoiceSession = useCallback(() => {
    voiceSessionRef.current?.abort();
    voiceSessionRef.current = null;
  }, []);

  const handleVoicePress = useCallback(async (
    currentDraft: string,
    onDraftChange: (value: string) => void,
    onErrorClear: () => void,
    isLoading: boolean,
    isInitializing: boolean,
    isInFlight: boolean,
    abortOnPress?: () => void
  ) => {
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
      onFinalResult: (transcript) => {
        const nextDraft = mergeTranscript(voiceBaseDraftRef.current, transcript);
        voiceBaseDraftRef.current = nextDraft;
        voiceHadResultRef.current = true;
        onDraftChange(nextDraft);
        onErrorClear();
        setVoiceState({ message: "Voice captured. Review it, then send when ready.", status: "idle" });
      },
      onInterimResult: (transcript) => {
        voiceHadResultRef.current = true;
        onDraftChange(mergeTranscript(voiceBaseDraftRef.current, transcript));
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

  return { voiceState, speechSupport, isListening, handleVoicePress, abortVoiceSession };
}
