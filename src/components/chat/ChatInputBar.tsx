import { RefreshCw, SendHorizontal, Mic } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors } from "@/theme/colors";

interface VoiceState {
  message: string | null;
  status: "idle" | "listening" | "processing" | "error" | "unsupported";
}

interface ChatInputBarProps {
  draft: string;
  onDraftChange: (text: string) => void;
  onSend: () => void;
  canSend: boolean;
  loading: boolean;
  initializing: boolean;
  error: string | null;
  lastFailedQuestion: string | null;
  onRetry: () => void;
  voiceState: VoiceState;
  isListening: boolean;
  speechSupport: { supported: boolean };
  onVoicePress: () => void;
}

export function ChatInputBar({
  draft,
  onDraftChange,
  onSend,
  canSend,
  loading,
  initializing,
  error,
  lastFailedQuestion,
  onRetry,
  voiceState,
  isListening,
  speechSupport,
  onVoicePress
}: ChatInputBarProps) {
  return (
    <View style={styles.inputBarWrapper}>
      {initializing || error || voiceState.message ? (
        <View style={styles.statusStack}>
          {initializing ? (
            <View style={styles.inlineStatus}>
              <ActivityIndicator color={colors.maroon} size="small" />
              <Text style={styles.inlineStatusText}>Opening campus guide...</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
              {lastFailedQuestion ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={loading || initializing}
                  onPress={onRetry}
                  style={[styles.retryButton, loading || initializing ? styles.retryButtonDisabled : undefined]}
                >
                  <RefreshCw color={colors.maroon} size={14} />
                  <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {voiceState.message ? (
            <Text
              style={[
                styles.voiceStatusText,
                voiceState.status === "error" || voiceState.status === "unsupported"
                  ? styles.voiceStatusWarning
                  : undefined
              ]}
            >
              {voiceState.message}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.inputBar}>
        <Pressable
          accessibilityLabel={isListening ? "Stop voice typing" : "Start voice typing"}
          accessibilityRole="button"
          accessibilityState={{ selected: isListening }}
          onPress={onVoicePress}
          style={[
            styles.voiceButton,
            isListening ? styles.voiceButtonListening : undefined,
            !speechSupport.supported ? styles.voiceButtonUnsupported : undefined
          ]}
        >
          <Mic
            color={
              isListening
                ? colors.white
                : speechSupport.supported
                ? colors.maroon
                : colors.grayhawkDark
            }
            size={20}
          />
        </Pressable>

        <TextInput
          accessibilityLabel="Message Haki"
          editable={!loading && !initializing}
          multiline
          onChangeText={onDraftChange}
          onSubmitEditing={onSend}
          placeholder={
            initializing ? "Opening guide..." : isListening ? "Listening..." : "Message Haki..."
          }
          placeholderTextColor={colors.muted}
          returnKeyType="send"
          style={[styles.input, loading || initializing ? styles.inputDisabled : undefined]}
          textAlignVertical="center"
          value={draft}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={onSend}
          style={[styles.sendButton, !canSend ? styles.sendButtonDisabled : undefined]}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <SendHorizontal color={colors.white} size={20} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputBarWrapper: {
    backgroundColor: colors.white,
    paddingBottom: 88,
    borderTopColor: colors.border,
    borderTopWidth: 1
  },
  statusStack: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  inlineStatus: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  inlineStatusText: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  errorBanner: {
    alignItems: "center",
    backgroundColor: colors.maroonSoft,
    borderColor: "#E8C7D0",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10
  },
  errorBannerText: {
    color: colors.danger,
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  retryButtonDisabled: { opacity: 0.55 },
  retryButtonText: { color: colors.maroon, fontSize: 12, fontWeight: "900" },
  voiceStatusText: { color: colors.grayhawkDark, fontSize: 12, fontWeight: "800", lineHeight: 17 },
  voiceStatusWarning: { color: colors.warning },
  inputBar: {
    alignItems: "flex-end",
    backgroundColor: colors.white,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  voiceButton: {
    alignItems: "center",
    backgroundColor: colors.maroonSoft,
    borderColor: "#E8C7D0",
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  voiceButtonListening: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  voiceButtonUnsupported: { backgroundColor: colors.surface, borderColor: colors.border },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    maxHeight: 110,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  inputDisabled: { color: colors.grayhawk, opacity: 0.8 },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.maroon,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  sendButtonDisabled: { backgroundColor: colors.grayhawk }
});
