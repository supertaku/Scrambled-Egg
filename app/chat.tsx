import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ChatMessageBubble, type ChatMessage } from "@/components/chat/ChatMessageBubble";
import { ChatInputBar } from "@/components/chat/ChatInputBar";
import { SuggestedQuestions } from "@/components/SuggestedQuestions";
import { getDatabase } from "@/db/database";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import type { DeviceCapabilityReport, ProviderCapabilityReport } from "@/ai/CapabilityDetector";
import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import { getDeviceCapabilityReport } from "@/services/modeSelectionService";
import { colors } from "@/theme/colors";
import { metrics } from "@/theme/metrics";

function getProvider(report: DeviceCapabilityReport | null, id: ProviderCapabilityReport["id"]) {
  return report?.providers.find((provider) => provider.id === id) ?? null;
}

function formatModelTier(mode: DeviceAIMode): string | null {
  const tier = mode.capabilities.modelTier;
  if (tier === "tiny") return "Tiny";
  if (tier === "enhanced") return "Enhanced";
  if (tier === "minimum") return "Minimum";
  if (tier === "good") return "Good";
  if (tier === "flagship") return "Flagship";
  if (tier === "apple-intelligence") return "Apple";
  return null;
}

function getExecuTorchUnavailableLabel(report: DeviceCapabilityReport | null): string | null {
  if (!report || report.platform !== "android") {
    return null;
  }

  const execuTorch = getProvider(report, "executorch");
  if (!execuTorch) {
    return "ExecuTorch not checked";
  }

  const reasonText = execuTorch.unavailableReasons.join(" ").toLowerCase();
  if (reasonText.includes("native module")) return "ExecuTorch bridge missing";
  if (
    reasonText.includes("model loading is disabled") ||
    reasonText.includes("load disabled") ||
    reasonText.includes("native runtime is disabled") ||
    reasonText.includes("llmmodule.load")
  ) {
    return "ExecuTorch load disabled";
  }
  if (!execuTorch.runtimeAvailable) return "ExecuTorch runtime off";
  if (execuTorch.modelAssetsAvailable === false || reasonText.includes("model assets")) return "Model assets missing";
  if (reasonText.includes("arm64")) return "arm64 not reported";
  if (reasonText.includes("ram")) return "RAM not reported";
  if (reasonText.includes("free storage")) return "Storage not reported";
  if (reasonText.includes("quantized")) return "Quantized model missing";
  if (reasonText.includes("safe chat")) return "Safe chat bridge missing";
  if (reasonText.includes("summarization")) return "Summary bridge missing";
  return "ExecuTorch unavailable";
}

function getModelIndicator(mode: DeviceAIMode | null, report: DeviceCapabilityReport | null): string {
  if (!mode) return "Detecting Model...";
  const providerId = mode.summaryProviderId ?? mode.embeddingProviderId;
  const tier = formatModelTier(mode);

  if (providerId === "apple-foundation-models") return "Apple Intelligence";
  if (providerId === "llama-rn") return tier ? `llama.rn - ${tier}` : "llama.rn";
  if (providerId === "executorch") return tier ? `ExecuTorch - ${tier}` : "ExecuTorch";
  if (mode.id === "fts5-only" || mode.id === "fallback-fts5-only") {
    const unavailableLabel = getExecuTorchUnavailableLabel(report);
    return unavailableLabel ? `FTS5 - ${unavailableLabel}` : "FTS5 Search";
  }

  return mode.label;
}

export default function ChatScreen() {
  const [draft, setDraft] = useState("");
  const [aiMode, setAiMode] = useState<DeviceAIMode | null>(null);
  const [capabilityReport, setCapabilityReport] = useState<DeviceCapabilityReport | null>(null);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const {
    messages,
    loading,
    streaming,
    initializing,
    error,
    lastFailedQuestion,
    pendingQuestion,
    inFlightRef,
    mountedRef,
    sendMessage,
    setInitializing,
    setError
  } = useChatMessages();

  const {
    voiceState,
    speechSupport,
    isListening,
    handleVoicePress,
    abortVoiceSession
  } = useVoiceInput();

  // Database initialization

  useEffect(() => {
    mountedRef.current = true;

    async function initialize() {
      try {
        await getDatabase();
        const report = await getDeviceCapabilityReport();
        if (mountedRef.current) {
          setAiMode(report.selectedMode);
          setCapabilityReport(report);
        }
      } catch (err) {
        if (mountedRef.current) {
          const message = err instanceof Error ? err.message : "Haki had trouble opening the guide.";
          setError(message);
        }
      } finally {
        if (mountedRef.current) {
          setInitializing(false);
        }
      }
    }

    void initialize();
    return () => {
      mountedRef.current = false;
      abortVoiceSession();
    };
  }, [mountedRef, setError, setInitializing, abortVoiceSession]);

  // Auto-scroll

  useEffect(() => {
    const id = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(id);
  }, [messages, loading]);

  // Input helpers

  const trimmedDraft = draft.trim();
  const canSend = trimmedDraft.length >= 3 && !loading && !initializing;
  const showSuggestedQuestions = messages.length === 1 && !loading && !initializing;

  const handleDraftChange = useCallback((value: string) => {
    setDraft(value);
    if (error) setError(null);
  }, [error, setError]);

  const handleSend = useCallback(() => {
    void sendMessage(draft);
    setDraft("");
  }, [draft, sendMessage]);

  const handleSuggestedQuestion = useCallback((question: string) => {
    void sendMessage(question);
  }, [sendMessage]);

  const handleRetry = useCallback(() => {
    if (lastFailedQuestion) void sendMessage(lastFailedQuestion);
  }, [lastFailedQuestion, sendMessage]);

  const handleVoice = useCallback(() => {
    void handleVoicePress(
      draft,
      (value) => {
        setDraft(value);
        if (error) setError(null);
      },
      () => setError(null),
      loading,
      initializing,
      inFlightRef.current
    );
  }, [draft, error, handleVoicePress, initializing, inFlightRef, loading, setError]);

  // Entry animation

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: metrics.animation.fadeDurationMs, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: metrics.animation.springFriction, tension: metrics.animation.springTension, useNativeDriver: true })
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Render

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.headerArea}>
        <Text style={styles.headerTitle}>Chat</Text>
        <View style={styles.modelIndicator}>
          <Text numberOfLines={1} style={styles.modelIndicatorText}>
            {getModelIndicator(aiMode, capabilityReport)}
          </Text>
        </View>
      </View>
      <View style={styles.sheetContainer}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={metrics.keyboard.chatVerticalOffset}
            style={styles.screen}
          >
            <View style={styles.chatBackgroundWrapper} pointerEvents="none">
              <Image
                source={require("../assets/images/tup-logo-bg.png")}
                style={styles.chatBackground}
                resizeMode="contain"
              />
            </View>

            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.messages}
              renderItem={({ item }) => <ChatMessageBubble message={item} />}
              ListFooterComponent={
                <>
                  {showSuggestedQuestions ? (
                    <View style={styles.suggestedQuestionsWrap}>
                      <SuggestedQuestions onSelect={handleSuggestedQuestion} />
                    </View>
                  ) : null}
                  {loading && !streaming ? (
                    <View style={styles.hakiRow}>
                      <View style={[styles.bubble, styles.hakiBubble, styles.typingBubble]}>
                        <ActivityIndicator color={colors.maroon} size="small" />
                        <Text style={styles.typingText}>
                          {pendingQuestion ? "Warming up Haki and checking sources..." : "Haki is getting ready..."}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </>
              }
            />

            <ChatInputBar
              draft={draft}
              onDraftChange={handleDraftChange}
              onSend={handleSend}
              canSend={canSend}
              loading={loading}
              initializing={initializing}
              error={error}
              lastFailedQuestion={lastFailedQuestion}
              onRetry={handleRetry}
              voiceState={voiceState}
              isListening={isListening}
              speechSupport={speechSupport}
              onVoicePress={handleVoice}
            />
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.maroon, flex: 1 },
  headerArea: {
    alignItems: "center",
    backgroundColor: colors.maroon,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12
  },
  headerTitle: { color: colors.white, fontSize: 20, fontWeight: "900" },
  modelIndicator: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    maxWidth: "92%",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginTop: 4
  },
  modelIndicatorText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.9,
    textAlign: "center"
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flex: 1,
    overflow: "hidden"
  },
  screen: { backgroundColor: "transparent", flex: 1 },
  chatBackgroundWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: -1
  },
  chatBackground: {
    width: 300,
    height: 300,
    opacity: 0.05
  },
  messages: { gap: 10, padding: 16, paddingTop: 24, paddingBottom: 110 },
  suggestedQuestionsWrap: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginLeft: 44,
    padding: 14
  },
  hakiRow: { justifyContent: "flex-start", flexDirection: "row", alignItems: "flex-end", marginBottom: 16, gap: 8 },
  bubble: { borderRadius: 20, maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 10 },
  hakiBubble: { backgroundColor: colors.white, borderBottomLeftRadius: 6, borderColor: colors.border, borderWidth: 1 },
  typingBubble: { alignItems: "center", flexDirection: "row", gap: 8 },
  typingText: { color: colors.muted, fontSize: 13, fontWeight: "700" }
});
