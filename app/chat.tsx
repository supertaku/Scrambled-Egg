import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Animated,
  FlatList,
  Image,
  type LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import type { ListRenderItemInfo } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView, useKeyboardState } from "react-native-keyboard-controller";

import { FeatherLoader } from "@/components/chat/FeatherLoader";
import { ChatMessageBubble } from "@/components/chat/ChatMessageBubble";
import { ChatInputBar } from "@/components/chat/ChatInputBar";
import { ChatRoleSelector } from "@/components/chat/ChatRoleSelector";
import { PixelHaki, PixelHakiPortrait } from "@/components/mascot/PixelHaki";
import { SuggestedQuestions } from "@/components/SuggestedQuestions";
import { getAppDatabase } from "@/data/appRepository";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import type { DeviceCapabilityReport } from "@/ai/CapabilityDetector";
import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import { getActiveChatModelStatus } from "@/ai/localModelManager";
import {
  getCurrentAIMode,
  getDeviceCapabilityReport,
  prewarmLocalAIForChat,
  refreshDeviceCapabilities
} from "@/services/modeSelectionService";
import { getChatPrivacySettings } from "@/services/chatPrivacySettingsService";
import { classifyStudentQuestionIntent } from "@/services/questionIntentService";
import { getStudentAvatarUri, getStudentProfile, studentProfileToChatContext } from "@/services/studentProfileService";
import { colors } from "@/theme/colors";
import { metrics } from "@/theme/metrics";
import type { ChatMessage } from "@/types/chat";
import type { ChatRole, SuggestedModeAction } from "@/types/search";
import { logger } from "@/utils/logger";

function getModelIndicator(mode: DeviceAIMode | null, _report: DeviceCapabilityReport | null): string {
  if (!mode) return "Getting ready...";
  return mode.capabilities.safeChat ? "All Haki modes ready" : "Campus information ready";
}

function getChatRoleSessionNotice(chatRole: ChatRole): string {
  if (chatRole === "information_officer") {
    return "Information Officer answers only from saved campus information. Verify important details with the relevant office.";
  }

  if (chatRole === "friendly_buddy") {
    return "Friendly Buddy offers empathetic support only. It is not a therapist and does not provide campus facts.";
  }

  if (chatRole === "researcher") {
    return "Researcher discusses non-campus facts. Always verify important information because Haki can make mistakes.";
  }

  return "Haki uses saved sources for campus information. Verify important details because Haki can make mistakes.";
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
  "Ay mahal ng Diyos (ay mahal ng Diyos)",
  "Hindi kumukupas (hindi kumukupas)",
  "Ang mga isda na lumalangoy",
  "Ay mahal ng Diyos 'di kumukupas",
  "'Wag ka nang malungkot",
  "Oh praise the Lord",
  "Ang mga bata (ang mga bata)",
  "Na naglalaro (na naglalaro)",
  "Ay mahal ng Diyos",
  "Hindi kumukupas",
  "Ang mga bata na naglalaro",
  "Ay mahal ng Diyos 'di kumukupas",
  "'Wag ka nang malungkot",
  "Oh praise the Lord"
];

const HELP_LISTENING_SCENARIOS = new Set([
  "clarification",
  "creative_brainstorm",
  "relationship_advice",
  "study_advice",
  "unknown_general"
]);

const HELP_LISTENING_PATTERN =
  /\b(help|advice|advise|opinion|suggest|recommend|decide|what should i do|how do i handle|better grades|study plan|confess|awkward)\b/i;

function shouldShowHelpListeningHaki(question: string | null): boolean {
  if (!question || !HELP_LISTENING_PATTERN.test(question)) return false;

  const intent = classifyStudentQuestionIntent(question);
  if (intent.type !== "safe_question") return false;

  return intent.route === "obvious_general" && HELP_LISTENING_SCENARIOS.has(intent.scenario);
}

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const keyboardHeight = useKeyboardState((state) => state.height);
  const [draft, setDraft] = useState("");
  const [aiMode, setAiMode] = useState<DeviceAIMode | null>(null);
  const [capabilityReport, setCapabilityReport] = useState<DeviceCapabilityReport | null>(null);
  const [userAvatarUri, setUserAvatarUri] = useState<string | null>(null);
  const [profileContext, setProfileContext] = useState<string | null>(null);
  const [useRelatedHistory, setUseRelatedHistory] = useState(false);
  const [chatRole, setChatRole] = useState<ChatRole>("haki");
  const [chatRoleNotice, setChatRoleNotice] = useState<string | null>(null);
  const [roleMenuVisible, setRoleMenuVisible] = useState(false);
  const [composerHeight, setComposerHeight] = useState(0);
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
  } = useChatMessages(profileContext, chatRole, useRelatedHistory);

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
      } catch {
        if (mountedRef.current) {
          setError("Haki had trouble getting ready. Please try again.");
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
      void getChatPrivacySettings()
        .then(async (privacy) => {
          const [avatarUri, profile] = await Promise.all([
            getStudentAvatarUri(),
            privacy.useProfileContext ? getStudentProfile() : Promise.resolve(null)
          ]);
          if (!active) return;
          setUserAvatarUri(avatarUri || null);
          setProfileContext(profile ? studentProfileToChatContext(profile) : null);
          setUseRelatedHistory(privacy.useRelatedHistory);
        })
        .catch(() => {
          if (!active) return;
          setUserAvatarUri(null);
          setProfileContext(null);
          setUseRelatedHistory(false);
        });

      void (async () => {
        try {
          await getActiveChatModelStatus();
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
  const generatedModesAvailable = Boolean(aiMode?.capabilities.safeChat);
  const showSuggestedQuestions = messages.length === 1 && !loading && !initializing;
  const displayedMessages = useMemo(
    () => (streamingMessage ? [...messages, streamingMessage] : messages),
    [messages, streamingMessage]
  );
  const loadingLine = HAKI_LOADING_LINES[loadingLineIndex % HAKI_LOADING_LINES.length] ?? HAKI_LOADING_LINES[0];
  const showHelpListeningHaki = loading && (
    chatRole === "friendly_buddy" || shouldShowHelpListeningHaki(pendingQuestion)
  );
  const composerBottomPadding = keyboardVisible
    ? Math.max(insets.bottom, metrics.navigation.composerGap)
    : metrics.navigation.floatingTabBarBottom
      + metrics.navigation.floatingTabBarHeight
      + metrics.navigation.composerGap
      + insets.bottom;

  const handleComposerLayout = useCallback((event: LayoutChangeEvent) => {
    setComposerHeight(event.nativeEvent.layout.height);
  }, []);

  useEffect(() => {
    if (!__DEV__ || !keyboardVisible) return;
    logger.ui.log("Chat composer keyboard geometry.", {
      keyboardBehavior: Platform.OS === "ios" ? "padding" : "height",
      composerBottomPadding,
      composerHeight,
      keyboardVisible,
      keyboardHeight,
      platform: Platform.OS,
      safeAreaBottom: insets.bottom,
      viewportHeight
    });
  }, [composerBottomPadding, composerHeight, insets.bottom, keyboardHeight, keyboardVisible, viewportHeight]);

  useEffect(() => {
    if (!loading || streaming || !pendingQuestion) {
      setLoadingLineIndex(0);
      return;
    }

    const intervalId = setInterval(() => {
      setLoadingLineIndex((current) => (current + 1) % HAKI_LOADING_LINES.length);
    }, 2000);

    return () => clearInterval(intervalId);
  }, [loading, pendingQuestion, streaming]);

  const handleDraftChange = useCallback((value: string) => {
    setDraft(value);
    if (error) setError(null);
  }, [error, setError]);

  const handleChatRoleChange = useCallback((role: ChatRole) => {
    if (loading || initializing) return;
    setChatRole(role);
    setChatRoleNotice(null);
    setRoleMenuVisible(false);
  }, [initializing, loading]);

  const handleSuggestedModeAction = useCallback((action: SuggestedModeAction, question: string) => {
    if (loading || initializing) return;
    setChatRole(action.mode);
    setChatRoleNotice(null);
    setRoleMenuVisible(false);
    void sendMessage(question, { chatRole: action.mode });
  }, [initializing, loading, sendMessage]);

  const handleOpenModels = useCallback(() => {
    setRoleMenuVisible(false);
    router.push("/models" as never);
  }, [router]);

  const toggleRoleMenu = useCallback(() => {
    setRoleMenuVisible((current) => !current);
  }, []);

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

  const handleContinue = useCallback((message: ChatMessage) => {
    void sendMessage("Continue", {
      chatRole: message.response?.requestedChatRole ?? "haki",
      continuation: true,
      ...(message.question ? { intentQuestion: message.question } : {})
    });
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
          {...(showContinue ? { onContinue: () => handleContinue(item) } : {})}
          {...(item.sender === "haki" && !isStreamingMessage ? { onHakiAvatarPress: toggleRoleMenu } : {})}
          {...(item.sender === "haki" && !isStreamingMessage ? { onFeedback: submitFeedback } : {})}
          {...(item.sender === "haki" && item.question && item.response?.suggestedModeActions?.length
            ? { onSuggestedModeAction: (action: SuggestedModeAction) => handleSuggestedModeAction(action, item.question!) }
            : {})}
          {...(isFailedUserMessage ? { onRetry: handleRetry } : {})}
        />
      );
    },
    [userAvatarUri, displayedMessages.length, loading, streamingMessage, handleContinue, handleRetry, submitFeedback, toggleRoleMenu, handleSuggestedModeAction]
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
        <Pressable accessibilityRole="button" accessibilityLabel="Manage chat options" onPress={() => router.push("/models" as never)} style={styles.modelIndicator}>
          <Text numberOfLines={1} style={styles.modelIndicatorText}>
            {getModelIndicator(aiMode, capabilityReport)}
          </Text>
        </Pressable>
      </View>
      <View style={styles.sheetContainer}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
          <KeyboardAvoidingView
            automaticOffset
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
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
              <View style={styles.sessionNotice}>
                <Text style={styles.sessionNoticeText}>
                  {getChatRoleSessionNotice(chatRole)}
                </Text>
              </View>
              {showHelpListeningHaki ? (
                <View style={styles.listeningPanel} pointerEvents="none">
                  <View style={styles.branchScene}>
                    <View style={styles.branchLine} />
                    <View style={styles.branchOffshoot} />
                    <View style={styles.branchLeaf} />
                    <PixelHaki height={60} state="helping" style={styles.listeningMascot} width={40} />
                  </View>
                  <View style={styles.listeningBubble}>
                    <View style={styles.listeningBubbleTailBorder} />
                    <View style={styles.listeningBubbleTail} />
                    <Text style={styles.listeningName}>Haki</Text>
                    <Text style={styles.listeningText}>I'm listening.</Text>
                  </View>
                </View>
              ) : null}
              <FlatList
                ref={flatListRef}
                data={displayedMessages}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                showsVerticalScrollIndicator={false}
                style={styles.messageList}
                contentContainerStyle={styles.messages}
                renderItem={renderMessage}
                onScroll={handleMessageScroll}
                scrollEventThrottle={16}
                onContentSizeChange={scrollToLatestMessage}
                ListFooterComponent={
                  <>
                    {showSuggestedQuestions ? (
                      <View style={styles.suggestedQuestionsWrap}>
                        <SuggestedQuestions chatRole={chatRole} onSelect={handleSuggestedQuestion} />
                      </View>
                    ) : null}
                    {loading && !streaming ? (
                      <View style={styles.hakiRow}>
                        <View style={styles.hakiAvatarContainer}>
                          <PixelHakiPortrait size={34} style={styles.hakiAvatar} />
                        </View>
                        <View style={[styles.bubble, styles.hakiBubble, styles.typingBubble]}>
                          <View pointerEvents="none" style={styles.hakiBubbleTailBorder} />
                          <View pointerEvents="none" style={styles.hakiBubbleTail} />
                          <FeatherLoader />
                          <Text style={styles.typingText}>
                            {pendingQuestion ? loadingLine : "Haki is getting ready..."}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </>
                }
              />
              {roleMenuVisible ? (
                <View style={styles.roleDropdown}>
                  <ChatRoleSelector
                    disabled={loading || initializing}
                    modesAvailable={generatedModesAvailable}
                    notice={chatRoleNotice}
                    onChange={handleChatRoleChange}
                    onClose={() => setRoleMenuVisible(false)}
                    onOpenModels={handleOpenModels}
                    value={chatRole}
                  />
                </View>
              ) : null}
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
              bottomPadding={composerBottomPadding}
              onLayout={handleComposerLayout}
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
  roleDropdown: {
    left: 14,
    position: "absolute",
    right: 54,
    top: 12,
    zIndex: 20
  },
  listeningPanel: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderBottomColor: "rgba(122,0,25,0.08)",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 82,
    paddingBottom: 6,
    paddingHorizontal: 18,
    paddingTop: 8
  },
  branchScene: {
    height: 66,
    justifyContent: "flex-end",
    position: "relative",
    width: 104
  },
  branchLine: {
    backgroundColor: "#7B4E2D",
    borderRadius: 999,
    bottom: 12,
    height: 8,
    left: 4,
    position: "absolute",
    right: 2,
    transform: [{ rotate: "-5deg" }]
  },
  branchOffshoot: {
    backgroundColor: "#7B4E2D",
    borderRadius: 999,
    bottom: 22,
    height: 6,
    left: 65,
    position: "absolute",
    transform: [{ rotate: "-28deg" }],
    width: 30
  },
  branchLeaf: {
    backgroundColor: "#3E8A4B",
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 12,
    bottom: 36,
    height: 14,
    left: 88,
    position: "absolute",
    transform: [{ rotate: "18deg" }],
    width: 20
  },
  listeningMascot: {
    bottom: 9,
    left: 30,
    position: "absolute",
  },
  listeningBubble: {
    backgroundColor: colors.white,
    borderColor: colors.ink,
    borderRadius: 18,
    borderTopLeftRadius: 8,
    borderWidth: 1.5,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: "relative",
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 0
  },
  listeningBubbleTailBorder: {
    borderBottomColor: "transparent",
    borderBottomWidth: 10,
    borderRightColor: colors.ink,
    borderRightWidth: 15,
    borderTopColor: "transparent",
    borderTopWidth: 10,
    height: 0,
    left: -15,
    position: "absolute",
    top: 25,
    width: 0,
    zIndex: 1
  },
  listeningBubbleTail: {
    borderBottomColor: "transparent",
    borderBottomWidth: 8,
    borderRightColor: colors.white,
    borderRightWidth: 13,
    borderTopColor: "transparent",
    borderTopWidth: 8,
    height: 0,
    left: -11,
    position: "absolute",
    top: 27,
    width: 0,
    zIndex: 2
  },
  listeningName: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  listeningText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2
  },
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
    elevation: 2,
    marginLeft: 44,
    padding: 14,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 0
  },
  sessionNotice: {
    alignSelf: "center",
    backgroundColor: colors.maroonSoft,
    borderColor: "#E8C7D0",
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
    marginHorizontal: 16,
    marginTop: 14,
    maxWidth: "92%",
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
  hakiAvatarContainer: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.gold,
    borderRadius: 18,
    borderWidth: 1.5,
    height: 36,
    justifyContent: "center",
    overflow: "hidden",
    width: 36
  },
  hakiAvatar: {
    marginTop: 2
  },
  bubble: { borderRadius: 20, maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 10, position: "relative" },
  hakiBubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 9,
    borderColor: colors.ink,
    borderWidth: 1,
    elevation: 1,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 0
  },
  hakiBubbleTailBorder: {
    borderBottomColor: "transparent",
    borderBottomWidth: 8,
    borderRightColor: colors.ink,
    borderRightWidth: 12,
    borderTopColor: "transparent",
    borderTopWidth: 8,
    bottom: 9,
    height: 0,
    left: -12,
    position: "absolute",
    width: 0,
    zIndex: 1
  },
  hakiBubbleTail: {
    borderBottomColor: "transparent",
    borderBottomWidth: 7,
    borderRightColor: colors.white,
    borderRightWidth: 10,
    borderTopColor: "transparent",
    borderTopWidth: 7,
    bottom: 10,
    height: 0,
    left: -9,
    position: "absolute",
    width: 0,
    zIndex: 2
  },
  typingBubble: { alignItems: "center", flexDirection: "row", gap: 8 },
  typingText: { color: colors.muted, fontSize: 13, fontWeight: "700" }
});
