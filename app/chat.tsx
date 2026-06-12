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
  Text,
  useWindowDimensions,
  View
} from "react-native";
import type { ListRenderItemInfo } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView, useKeyboardState } from "react-native-keyboard-controller";
import { RefreshCw } from "lucide-react-native";

import { FeatherLoader } from "@/components/chat/FeatherLoader";
import { ChatMessageBubble } from "@/components/chat/ChatMessageBubble";
import { ChatInputBar } from "@/components/chat/ChatInputBar";
import { createChatScreenStyles } from "@/components/chat/chatScreenStyles";
import { ChatRoleSelector } from "@/components/chat/ChatRoleSelector";
import { HakiHdAvatar, HakiMascotCompat } from "@/mascot";
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
import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import { chatListeningPalette } from "@/theme/featurePalettes";
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
    return "Campus Only answers strictly from saved campus information. Verify important details with the relevant office.";
  }

  if (chatRole === "friendly_buddy") {
    return "Listener offers kind support only. It is not a therapist and does not provide campus facts.";
  }

  if (chatRole === "researcher") {
    return "Study Helper covers non-campus topics. Always double-check important facts because Haki can make mistakes.";
  }

  return "All-Around Haki uses saved sources for campus information. Verify important details because Haki can make mistakes.";
}

function getMemoryIndicatorText(messages: ChatMessage[]): string | null {
  const usage = [...messages].reverse().find((message) => message.response?.contextUsage)?.response?.contextUsage;
  if (!usage) return null;
  if (usage.historyPruned || usage.sourcesPruned) return "Older context trimmed";
  if (usage.contextFillRatio >= 0.8) return "Memory getting full";
  return "Fresh memory";
}

// Original Haki "humming" lines (lyrics from real songs are copyrighted,
// so these are house-made earworms in different moods).
const HAKI_LOADING_LINES = [
  "Hmm hmm hm-hmm...",
  "Flipping through my notes...",
  "La-la-la, looking it up...",
  "Sweet answers coming up...",
  "Doo-doo-doo, searching on...",
  "Counting all the stars... I mean sources...",
  "Once upon a time, in a library far away...",
  "You're amazing, just hang on...",
  "Whistling a study tune...",
  "Little wings, big answers...",
  "Turning pages, taking flight...",
  "Feather by feather, almost there...",
  "Hatching the perfect reply...",
  "Soaring through the campus guide...",
  "One more verse and it's ready...",
  "Drumming my talons on the desk...",
  "Shuffling my song of sources...",
  "Hold my perch, found something..."
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
  const colors = useThemeColors();
  const styles = useThemedStyles(createChatScreenStyles);
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
    startFresh,
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
  const memoryIndicatorText = useMemo(() => getMemoryIndicatorText(displayedMessages), [displayedMessages]);
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

  const handleStartFresh = useCallback(() => {
    if (loading || initializing) return;
    startFresh();
    setRoleMenuVisible(false);
  }, [initializing, loading, startFresh]);

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
          avatarAnimated={isLast && item.sender === "haki"}
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
        <View style={styles.headerTopRow}>
          <View style={styles.headerGap} />
          <Text style={styles.headerTitle}>Chat</Text>
          <Pressable
            accessibilityLabel="Start fresh chat"
            accessibilityRole="button"
            disabled={loading || initializing}
            onPress={handleStartFresh}
            style={({ pressed }) => [
              styles.startFreshButton,
              pressed ? styles.startFreshButtonPressed : undefined,
              (loading || initializing) ? styles.startFreshButtonDisabled : undefined
            ]}
          >
            <RefreshCw color={colors.white} size={15} />
            <Text style={styles.startFreshText}>Fresh</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Manage Haki models" onPress={() => router.push("/models" as never)} style={styles.modelIndicator}>
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
              {memoryIndicatorText ? (
                <View
                  accessibilityLabel={memoryIndicatorText}
                  style={[
                    styles.memoryIndicator,
                    memoryIndicatorText === "Fresh memory" ? styles.memoryFresh : styles.memoryWarn
                  ]}
                >
                  {memoryIndicatorText === "Fresh memory" ? (
                    <RefreshCw color={colors.success} size={12} strokeWidth={2.5} />
                  ) : (
                    <Text style={styles.memoryIndicatorText}>{memoryIndicatorText}</Text>
                  )}
                </View>
              ) : null}
              {showHelpListeningHaki ? (
                <View style={styles.listeningPanel} pointerEvents="none">
                  <View style={styles.branchScene}>
                    <View style={styles.branchLine} />
                    <View style={styles.branchOffshoot} />
                    <View style={styles.branchLeaf} />
                    <HakiMascotCompat height={60} status="teaching" style={styles.listeningMascot} />
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
                          <HakiHdAvatar animated size={34} style={styles.hakiAvatar} />
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
