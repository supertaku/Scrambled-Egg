export const NEXT_SPEECH_RECOGNITION_TARGET = "expo-speech-recognition";

export interface SpeechRecognitionAdapter<TSupport, TCallbacks, TOptions, TSession> {
  readonly id: string;
  readonly migrationTarget?: string;
  createSession(callbacks: TCallbacks, options?: TOptions): TSession | null;
  getSupport(): TSupport;
}
