import { useEffect, useRef, useState } from "react";
import { Mic, RefreshCw, SendHorizontal, Square } from "lucide-react-native";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from "react-native";

import { colors } from "@/theme/colors";

interface VoiceState {
  message: string | null;
  status: "idle" | "listening" | "processing" | "error" | "unsupported" | "sending_countdown";
}

interface ChatInputBarProps {
  draft: string;
  onDraftChange: (text: string) => void;
  onSend: () => void;
  onStopResponse: () => void;
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
  onCancelVoice: () => void;
  bottomPadding: number;
  onLayout?: (event: LayoutChangeEvent) => void;
}

export function ChatInputBar({
  draft,
  onDraftChange,
  onSend,
  onStopResponse,
  canSend,
  loading,
  initializing,
  error,
  lastFailedQuestion,
  onRetry,
  voiceState,
  isListening,
  speechSupport,
  onVoicePress,
  onCancelVoice,
  bottomPadding,
  onLayout
}: ChatInputBarProps) {
  // Animated send button scale
  const sendScale = useRef(new Animated.Value(1)).current;

  // Voice pulse ring animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;

  // Error banner slide-in
  const [prevError, setPrevError] = useState<string | null>(null);
  const errorSlide = useRef(new Animated.Value(-40)).current;
  const errorOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error && error !== prevError) {
      setPrevError(error);
      errorSlide.setValue(-40);
      errorOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(errorSlide, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
        Animated.timing(errorOpacity, { toValue: 1, duration: 220, useNativeDriver: true })
      ]).start();
    }
    if (!error) {
      setPrevError(null);
    }
  }, [error, prevError, errorSlide, errorOpacity]);

  // Voice pulsing ring while listening
  useEffect(() => {
    if (isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, { toValue: 1.55, duration: 700, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0, duration: 700, useNativeDriver: true })
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0.5, duration: 0, useNativeDriver: true })
          ])
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0.6);
    }
  }, [isListening, pulseAnim, pulseOpacity]);

  const handleSendPressIn = () => {
    Animated.spring(sendScale, { toValue: 0.88, useNativeDriver: true, friction: 6, tension: 200 }).start();
  };

  const handleSendPressOut = () => {
    Animated.spring(sendScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();
  };

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.inputBarWrapper,
        { paddingBottom: bottomPadding }
      ]}
    >
      {initializing || error || voiceState.message ? (
        <View style={styles.statusStack}>
          {initializing ? (
            <View style={styles.inlineStatus}>
              <ActivityIndicator color={colors.maroon} size="small" />
              <Text style={styles.inlineStatusText}>Opening campus guide...</Text>
            </View>
          ) : null}

          {error ? (
            <Animated.View
              style={[
                styles.errorBanner,
                { transform: [{ translateY: errorSlide }], opacity: errorOpacity }
              ]}
            >
              <Text selectable style={styles.errorBannerText}>{error}</Text>
              {lastFailedQuestion ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={loading || initializing}
                  onPress={onRetry}
                  style={[styles.retryButton, loading || initializing ? styles.retryButtonDisabled : undefined]}
                >
                  <RefreshCw color={colors.maroon} size={13} />
                  <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
              ) : null}
            </Animated.View>
          ) : null}

          {voiceState.message ? (
            <View style={styles.voiceStatusContainer}>
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
              {voiceState.status === "sending_countdown" ? (
                <Pressable accessibilityRole="button" onPress={onCancelVoice} style={styles.cancelVoiceButton}>
                  <Text style={styles.cancelVoiceText}>Cancel</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.inputBar}>
        {/* Voice button with pulse ring */}
        <View style={styles.voiceButtonWrap}>
          {isListening && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.voicePulseRing,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseOpacity
                }
              ]}
            />
          )}
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
        </View>

        <TextInput
          accessibilityLabel="Message Haki"
          editable={!loading && !initializing}
          multiline
          onChangeText={onDraftChange}
          onSubmitEditing={onSend}
          placeholder={
            initializing ? "Opening guide..." : isListening ? "Listening..." : "Message Haki..."
          }
          placeholderTextColor={colors.mutedLight}
          returnKeyType="send"
          style={[styles.input, loading || initializing ? styles.inputDisabled : undefined]}
          textAlignVertical="center"
          value={draft}
        />

        <Pressable
          accessibilityLabel={loading ? "Stop Haki's response" : "Send message"}
          accessibilityRole="button"
          accessibilityState={{ disabled: !loading && !canSend }}
          disabled={!loading && !canSend}
          onPress={loading ? onStopResponse : onSend}
          onPressIn={handleSendPressIn}
          onPressOut={handleSendPressOut}
        >
          <Animated.View
            style={[
              styles.sendButton,
              loading ? styles.stopButton : undefined,
              !loading && !canSend ? styles.sendButtonDisabled : undefined,
              { transform: [{ scale: sendScale }] }
            ]}
          >
            {loading ? (
              <Square color={colors.white} fill={colors.white} size={15} />
            ) : (
              <SendHorizontal color={colors.white} size={19} />
            )}
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputBarWrapper: {
    backgroundColor: colors.white,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 6
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
  voiceStatusContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  voiceStatusText: { color: colors.grayhawkDark, fontSize: 12, fontWeight: "800", lineHeight: 17, flex: 1 },
  voiceStatusWarning: { color: colors.warning },
  cancelVoiceButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  cancelVoiceText: { color: colors.maroon, fontSize: 11, fontWeight: "800" },
  inputBar: {
    alignItems: "flex-end",
    backgroundColor: colors.white,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  voiceButtonWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44
  },
  voicePulseRing: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.maroon,
    zIndex: 0
  },
  voiceButton: {
    alignItems: "center",
    backgroundColor: colors.maroonSoft,
    borderColor: "#E8C7D0",
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
    zIndex: 1
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
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  inputDisabled: { color: colors.grayhawk, opacity: 0.8 },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.maroon,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
    shadowColor: colors.maroon,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4
  },
  stopButton: {
    backgroundColor: colors.danger,
    shadowColor: colors.danger
  },
  sendButtonDisabled: {
    backgroundColor: colors.grayhawk,
    shadowOpacity: 0
  }
});
