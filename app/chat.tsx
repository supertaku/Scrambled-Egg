import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { ListRenderItemInfo } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";

import { ChatMessageBubble } from "@/components/chat/ChatMessageBubble";
import { ChatInputBar } from "@/components/chat/ChatInputBar";
import { SuggestedQuestions } from "@/components/SuggestedQuestions";
import { getAppDatabase } from "@/data/appRepository";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import type { DeviceCapabilityReport } from "@/ai/CapabilityDetector";
import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import { ensureBundledDefaultChatModel } from "@/ai/localModelManager";
import {
  getCurrentAIMode,
  getDeviceCapabilityReport,
  prewarmLocalAIForChat,
  refreshDeviceCapabilities
} from "@/services/modeSelectionService";
import { getStudentProfile, studentProfileToChatContext } from "@/services/studentProfileService";
import { colors } from "@/theme/colors";
import { metrics } from "@/theme/metrics";
import type { ChatMessage } from "@/types/chat";

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

function getModelIndicator(mode: DeviceAIMode | null, _report: DeviceCapabilityReport | null): string {
  if (!mode) return "Detecting Model...";
  const providerId = mode.summaryProviderId ?? mode.embeddingProviderId;
  const tier = formatModelTier(mode);

  if (providerId === "apple-foundation-models") return "Apple Intelligence";
  if (providerId === "llama-rn") return tier ? `llama.rn - ${tier}` : "llama.rn";
  if (mode.id === "fts5-only" || mode.id === "fallback-fts5-only") {
    return "FTS5 Search";
  }

  return mode.label;
}

const HAKI_LOADING_LINES = [
  "Ang mga ibon",
  "Na lumilipad",
  "Ay mahal ng Diyos",
  "Hindi kumukupas",
  "Ang mga ibon na lumilipad",
  "Ay mahal ng Diyos 'di kumukupas",
  "'Wag ka nang malungkot",
  "Oh praise the Lord",
  "Ang mga isda",
  "Na lumalangoy",
  "Ay mahal ng Diyos",
  "Hindi kumukupas",
  "Ang mga bata na naglalaro",
  "Ay mahal ng Diyos 'di kumukupas",
  "'Wag ka nang malungkot",
  "Oh praise the Lord"
];

export default function ChatScreen() {
  const [draft, setDraft] = useState("");
  const [aiMode, setAiMode] = useState<DeviceAIMode | null>(null);
  const [capabilityReport, setCapabilityReport] = useState<DeviceCapabilityReport | null>(null);
  const [userAvatarUri, setUserAvatarUri] = useState<string | null>(null);
  const [profileContext, setProfileContext] = useState<string | null>(null);
  const [loadingLineIndex, setLoadingLineIndex] = useState(0);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const shouldAutoScrollRef = useRef(true);

  const {
    messages,
    streamingMessage,
    loading,
    streaming,
    initializing,
    error,
    lastFailedQuestion,
    pendingQuestion,
    inFlightRef,
    mountedRef,
    sendMessage,
    stopResponse,
    submitFeedback,
    setInitializing,
    setError
  } = useChatMessages(profileContext);

  const {
    voiceState,
    speechSupport,
    isListening,
    handleVoicePress,
    abortVoiceSession,
    cancelAutoSend
  } = useVoiceInput();

  // Database initialization

  useEffect(() => {
    mountedRef.current = true;

    async function initialize() {
      try {
        await getAppDatabase();
        const report = await getDeviceCapabilityReport();
        if (mountedRef.current) {
          setAiMode(report.selectedMode);
          setCapabilityReport(report);
        }
        // Eagerly load the local model while the chat screen is mounting so
        // the first send doesn't pay the cold-start cost. Errors are swallowed
        // inside prewarmLocalAIForChat; the real request will retry / fall back.
        void prewarmLocalAIForChat();
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

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getStudentProfile()
        .then((profile) => {
          if (!active) return;
          setUserAvatarUri(profile.avatarUri?.trim() || null);
          setProfileContext(studentProfileToChatContext(profile));
        })
        .catch(() => {
          if (!active) return;
          setUserAvatarUri(null);
          setProfileContext(null);
        });

      void (async () => {
        try {
          await ensureBundledDefaultChatModel();
          if (!active) return;
          let mode = await getCurrentAIMode();
          if (!mode.capabilities.safeChat) {
            mode = await refreshDeviceCapabilities();
            if (!active) return;
          }
          const report = await getDeviceCapabilityReport();
          if (!active) return;
          setAiMode(mode);
          setCapabilityReport(report);
          if (mode.capabilities.safeChat) {
            void prewarmLocalAIForChat();
          }
        } catch {
          /* Keep existing header; chat still works on FTS5. */
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  // Input helpers

  const trimmedDraft = draft.trim();
  const canSend = trimmedDraft.length >= 3 && !loading && !initializing;
  const showSuggestedQuestions = messages.length === 1 && !loading && !initializing;
  const displayedMessages = useMemo(
    () => (streamingMessage ? [...messages, streamingMessage] : messages),
    [messages, streamingMessage]
  );
  const loadingLine = HAKI_LOADING_LINES[loadingLineIndex % HAKI_LOADING_LINES.length] ?? HAKI_LOADING_LINES[0];

  useEffect(() => {
    if (!loading || streaming || !pendingQuestion) {
      setLoadingLineIndex(0);
      return;
    }

    const intervalId = setInterval(() => {
      setLoadingLineIndex((current) => (current + 1) % HAKI_LOADING_LINES.length);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [loading, pendingQuestion, streaming]);

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

  const handleContinue = useCallback(() => {
    void sendMessage("Continue");
  }, [sendMessage]);

  const handleVoice = useCallback(() => {
    void handleVoicePress(
      draft,
      (value) => {
        setDraft(value);
        if (error) setError(null);
      },
      () => setError(null),
      (finalText) => {
        void sendMessage(finalText);
        setDraft("");
      },
      loading,
      initializing,
      inFlightRef.current
    );
  }, [draft, error, handleVoicePress, initializing, inFlightRef, loading, setError, sendMessage]);

  // Debounce auto-scroll: while the model is streaming, onContentSizeChange
  // fires ~once per flushed token batch (every 50ms). Animating scrollToEnd
  // every time stutters the bubble layout. Coalesce to one scroll per ~120ms.
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollToLatestMessage = useCallback(() => {
    if (!shouldAutoScrollRef.current) return;
    if (scrollDebounceRef.current) return;
    scrollDebounceRef.current = setTimeout(() => {
      scrollDebounceRef.current = null;
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }, []);

  useEffect(
    () => () => {
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current);
        scrollDebounceRef.current = null;
      }
    },
    []
  );

  const handleMessageScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    shouldAutoScrollRef.current = distanceFromBottom < 80;
  }, []);

  const renderMessage = useCallback(
    ({ item, index }: ListRenderItemInfo<ChatMessage>) => {
      const isLast = index === displayedMessages.length - 1;
      const showContinue = isLast && item.response?.isIncomplete && !loading;
      const isStreamingMessage = Boolean(streamingMessage && item.id === streamingMessage.id);
      const isFailedUserMessage = item.sender === "user" && item.status === "failed";
      return (
        <ChatMessageBubble
          message={item}
          userAvatarUri={userAvatarUri}
          {...(showContinue ? { onContinue: handleContinue } : {})}
          {...(item.sender === "haki" && !isStreamingMessage ? { onFeedback: submitFeedback } : {})}
          {...(isFailedUserMessage ? { onRetry: handleRetry } : {})}
        />
      );
    },
    [userAvatarUri, displayedMessages.length, loading, streamingMessage, handleContinue, handleRetry, submitFeedback]
  );

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

            <View style={styles.listAndStreamColumn}>
              <FlatList
                ref={flatListRef}
                data={displayedMessages}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={styles.messageList}
                contentContainerStyle={styles.messages}
                renderItem={renderMessage}
                onScroll={handleMessageScroll}
                scrollEventThrottle={16}
                onContentSizeChange={scrollToLatestMessage}
                ListHeaderComponent={
                  <View style={styles.sessionNotice}>
                    <Text style={styles.sessionNoticeText}>
                      {aiMode?.capabilities.safeChat
                        ? "Haki keeps this chat until you restart the app. Replies combine the offline campus guide with on-device AI when available."
                        : "Haki keeps this chat until you restart the app. Without local safe chat, answers use offline search over the saved campus guide - open Settings > AI status to see whether full on-device replies can activate."}
                    </Text>
                  </View>
                }
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
                          <LottieView
                            autoPlay
                            loop
                            source={require("../assets/animations/haki-feathers.json")}
                            style={styles.loadingAnimation}
                          />
                          <Text style={styles.typingText}>
                            {pendingQuestion ? loadingLine : "Haki is getting ready..."}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </>
                }
              />
            </View>

            <ChatInputBar
              draft={draft}
              onDraftChange={handleDraftChange}
              onSend={handleSend}
              onStopResponse={stopResponse}
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
              onCancelVoice={cancelAutoSend}
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
  listAndStreamColumn: { flex: 1 },
  messageList: { flex: 1 },
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
  messages: { gap: 10, padding: 16, paddingTop: 24, paddingBottom: 160 },
  suggestedQuestionsWrap: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginLeft: 44,
    padding: 14
  },
  sessionNotice: {
    alignSelf: "center",
    backgroundColor: colors.maroonSoft,
    borderColor: "#E8C7D0",
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  sessionNoticeText: {
    color: colors.maroonDark,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center"
  },
  hakiRow: { justifyContent: "flex-start", flexDirection: "row", alignItems: "flex-end", marginBottom: 16, gap: 8 },
  bubble: { borderRadius: 20, maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 10 },
  hakiBubble: { backgroundColor: colors.white, borderBottomLeftRadius: 6, borderColor: colors.border, borderWidth: 1 },
  typingBubble: { alignItems: "center", flexDirection: "row", gap: 8 },
  loadingAnimation: { height: 32, width: 32 },
  typingText: { color: colors.muted, fontSize: 13, fontWeight: "700" }
});
