import { memo, useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { AlertCircle, Bookmark, Flag, RefreshCw, Share2, ThumbsDown, ThumbsUp, User as UserIcon } from "lucide-react-native";

import { HakiHdAvatar } from "@/mascot";
import { addBookmark, findBookmarkId, removeBookmark, type BookmarkCitation } from "@/services/bookmarkService";
import { shareAnswer } from "@/services/shareAnswerService";
import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/themes";
import type { ChatFeedbackRating, ChatMessage } from "@/types/chat";
import type { SuggestedModeAction } from "@/types/search";
import { hapticTap } from "@/utils/haptics";
import { logger } from "@/utils/logger";
import { ChatMarkdownText } from "./ChatMarkdownText";
import { ChatSourceCard } from "./ChatSourceCard";

function citationsForMessage(message: ChatMessage): BookmarkCitation[] {
  const response = message.response;
  if (!response) {
    return [];
  }
  const used = new Set(response.citationsUsed);
  const cited = response.results.filter((result) => used.size === 0 || used.has(result.chunkId));
  const source = cited.length ? cited : response.topResult ? [response.topResult] : [];
  return source.slice(0, 4).map((result) => ({
    citationId: result.chunkId,
    ...(result.citation ? { citation: result.citation } : {}),
    documentTitle: result.documentTitle
  }));
}

interface ChatMessageBubbleProps {
  message: ChatMessage;
  /** Only the most recent Haki bubble should animate its avatar (blinks/glances). */
  avatarAnimated?: boolean | undefined;
  userAvatarUri?: string | null;
  onContinue?: () => void;
  onFeedback?: (messageId: string, rating: ChatFeedbackRating) => void;
  onHakiAvatarPress?: () => void;
  onRetry?: () => void;
  onSuggestedModeAction?: (action: SuggestedModeAction) => void;
}

/** Renders a single chat message bubble with avatar and optional source card. */
function ChatMessageBubbleComponent({ avatarAnimated = false, message, userAvatarUri, onContinue, onFeedback, onHakiAvatarPress, onRetry, onSuggestedModeAction }: ChatMessageBubbleProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const fromUser = message.sender === "user";
  const { response } = message;
  const result = message.result ?? response?.topResult ?? response?.results[0];
  const canRetry = fromUser && message.status === "failed" && Boolean(onRetry);
  const canGiveFeedback = !fromUser && message.id !== "opening" && Boolean(onFeedback);
  const helpfulSelected = message.feedbackRating === "helpful";
  const wrongSelected = message.feedbackRating === "wrong";
  const showMissingSourceReport = !fromUser && response?.answerBasis === "campus_sources_unavailable" && Boolean(onFeedback);

  // Entry animation per bubble
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;
  const avatarScale = useRef(new Animated.Value(1)).current;
  const avatarTurn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 120, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 100, useNativeDriver: true })
    ]).start();
  }, [fadeAnim, scaleAnim, slideAnim]);

  const handleHakiAvatarPress = () => {
    Animated.parallel([
      Animated.sequence([
        Animated.spring(avatarScale, { toValue: 0.88, friction: 7, tension: 200, useNativeDriver: true }),
        Animated.spring(avatarScale, { toValue: 1.08, friction: 6, tension: 180, useNativeDriver: true }),
        Animated.spring(avatarScale, { toValue: 1, friction: 6, tension: 150, useNativeDriver: true })
      ]),
      Animated.sequence([
        Animated.timing(avatarTurn, { duration: 90, toValue: 1, useNativeDriver: true }),
        Animated.timing(avatarTurn, { duration: 150, toValue: -1, useNativeDriver: true }),
        Animated.timing(avatarTurn, { duration: 100, toValue: 0, useNativeDriver: true })
      ])
    ]).start();
    onHakiAvatarPress?.();
  };

  return (
    <Animated.View
      style={[
        styles.messageRow,
        fromUser ? styles.userRow : styles.hakiRow,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }, { translateY: slideAnim }] }
      ]}
    >
      {!fromUser && (
        <Pressable
          accessibilityHint="Opens Haki answer mode choices."
          accessibilityLabel="Choose Haki answer mode"
          accessibilityRole="button"
          onPress={handleHakiAvatarPress}
          style={styles.hakiAvatarContainer}
        >
          <Animated.View
            style={{
              transform: [
                { scale: avatarScale },
                { rotate: avatarTurn.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-7deg", "0deg", "7deg"] }) }
              ]
            }}
          >
            <HakiHdAvatar animated={avatarAnimated} size={34} style={styles.hakiAvatar} />
          </Animated.View>
        </Pressable>
      )}

      <View style={[styles.bubbleContent, fromUser ? styles.userBubbleContent : styles.hakiBubbleContent]}>
        <View
          {...(fromUser ? {} : { accessibilityLiveRegion: "polite" as const })}
          style={[styles.bubble, fromUser ? styles.userBubble : styles.hakiBubble]}
        >
          {!fromUser ? (
            <>
              <View pointerEvents="none" style={styles.hakiBubbleTailBorder} />
              <View pointerEvents="none" style={styles.hakiBubbleTail} />
            </>
          ) : null}
          {!fromUser ? <Text style={styles.senderName}>Haki</Text> : null}
          {fromUser ? (
            <Text selectable style={[styles.messageText, styles.userMessageText]}>
              {message.text}
            </Text>
          ) : (
            <ChatMarkdownText style={[styles.messageText, styles.hakiMessageText]} text={message.text} />
          )}
          {response && !fromUser ? (
            <ChatSourceCard response={response} result={result} />
          ) : null}
          {response && !fromUser ? <ResponseNoticeStack response={response} /> : null}
          {showMissingSourceReport ? (
            <Pressable
              accessibilityLabel="Report missing campus source"
              accessibilityRole="button"
              onPress={() => onFeedback?.(message.id, "wrong")}
              style={({ pressed }) => [styles.missingSourceButton, pressed ? styles.modeActionPressed : undefined]}
            >
              <Flag color={colors.maroon} size={13} />
              <Text style={styles.missingSourceText}>Report missing source</Text>
            </Pressable>
          ) : null}
          {onContinue ? (
            <View style={styles.continueContainer}>
              <Text style={styles.continueText}>Response stopped. Continue?</Text>
              <ContinueButton onPress={onContinue} />
            </View>
          ) : null}
          {!fromUser && response?.suggestedModeActions?.length && onSuggestedModeAction ? (
            <View style={styles.modeActions}>
              {response.suggestedModeActions.map((action) => (
                <Pressable
                  accessibilityLabel={action.label}
                  accessibilityRole="button"
                  key={action.mode}
                  onPress={() => onSuggestedModeAction(action)}
                  style={({ pressed }) => [styles.modeActionButton, pressed ? styles.modeActionPressed : undefined]}
                >
                  <Text style={styles.modeActionText}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {canRetry ? (
          <Pressable
            accessibilityLabel="Retry sending this message"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onRetry}
            style={({ pressed }) => [styles.statusIndicator, pressed ? styles.statusIndicatorPressed : undefined]}
          >
            <RefreshCw color={colors.goldSoft} size={14} />
            <Text style={styles.userMessageError}>Tap to retry</Text>
          </Pressable>
        ) : null}

        {canGiveFeedback ? (
          <View style={styles.feedbackRow}>
            <FeedbackButton
              label={helpfulSelected ? "Marked as helpful" : "Mark Haki response as helpful"}
              selected={helpfulSelected}
              onPress={() => onFeedback?.(message.id, "helpful")}
              icon={<ThumbsUp color={helpfulSelected ? colors.maroon : colors.muted} size={13} />}
            />
            <FeedbackButton
              label={wrongSelected ? "Marked as wrong" : "Mark Haki response as wrong"}
              selected={wrongSelected}
              onPress={() => onFeedback?.(message.id, "wrong")}
              icon={<ThumbsDown color={wrongSelected ? colors.maroon : colors.muted} size={13} />}
            />
            <AnswerActions message={message} />
          </View>
        ) : null}
      </View>

      {fromUser && (
        <View style={styles.userAvatarContainer}>
          {userAvatarUri ? (
            <Image resizeMode="cover" source={{ uri: userAvatarUri }} style={styles.userAvatarImage} />
          ) : (
            <UserIcon color={colors.white} size={17} />
          )}
        </View>
      )}
    </Animated.View>
  );
}

function memoryNoticeText(response: NonNullable<ChatMessage["response"]>): string | null {
  const usage = response.contextUsage;
  if (!usage) return null;
  if (usage.historyPruned || usage.sourcesPruned) {
    return "Older context was trimmed for this local model.";
  }
  if (usage.contextFillRatio >= 0.8) {
    return "Memory is getting full. Start fresh for the clearest answer.";
  }
  return null;
}

function ResponseNoticeStack({ response }: { response: NonNullable<ChatMessage["response"]> }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const notices = [
    response.verificationNote,
    response.factCheckNotice,
    memoryNoticeText(response)
  ].filter((notice): notice is string => Boolean(notice?.trim()));

  if (notices.length === 0) {
    return null;
  }

  return (
    <View style={styles.noticeStack}>
      {notices.map((notice) => (
        <View key={notice} style={styles.noticePill}>
          <AlertCircle color={colors.maroon} size={13} />
          <Text selectable style={styles.noticeText}>{notice}</Text>
        </View>
      ))}
    </View>
  );
}

/** Save-for-later and share actions on completed Haki answers. */
function AnswerActions({ message }: { message: ChatMessage }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [bookmarkId, setBookmarkId] = useState<number | null>(null);
  const question = message.question ?? message.response?.question ?? null;

  useEffect(() => {
    let mounted = true;
    void findBookmarkId(question, message.text).then((id) => {
      if (mounted) {
        setBookmarkId(id);
      }
    });
    return () => {
      mounted = false;
    };
  }, [message.text, question]);

  const toggleBookmark = () => {
    hapticTap();
    if (bookmarkId !== null) {
      const removedId = bookmarkId;
      setBookmarkId(null);
      void removeBookmark(removedId).catch((error) => {
        setBookmarkId(removedId);
        logger.ui.warn("Bookmark removal failed.", {
          error: error instanceof Error ? error.message : String(error)
        });
      });
      return;
    }
    void addBookmark({ answerText: message.text, citations: citationsForMessage(message), question })
      .then(setBookmarkId)
      .catch((error) => {
        logger.ui.warn("Bookmark save failed.", {
          error: error instanceof Error ? error.message : String(error)
        });
      });
  };

  const handleShare = () => {
    hapticTap();
    void shareAnswer({ answerText: message.text, citations: citationsForMessage(message), question }).catch(
      (error) => {
        logger.ui.warn("Answer share failed.", {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    );
  };

  const saved = bookmarkId !== null;
  return (
    <>
      <FeedbackButton
        icon={<Bookmark color={saved ? colors.maroon : colors.muted} fill={saved ? colors.maroon : "transparent"} size={13} />}
        label={saved ? "Remove this answer from saved answers" : "Save this answer for later"}
        onPress={toggleBookmark}
        selected={saved}
      />
      <FeedbackButton
        icon={<Share2 color={colors.muted} size={13} />}
        label="Share this answer"
        onPress={handleShare}
        selected={false}
      />
    </>
  );
}

function FeedbackButton({
  label,
  selected,
  onPress,
  icon
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon: React.ReactNode;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.85, useNativeDriver: true, friction: 6, tension: 200 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.feedbackButton,
          selected ? styles.feedbackButtonSelected : undefined,
          { transform: [{ scale }] }
        ]}
      >
        {icon}
      </Animated.View>
    </Pressable>
  );
}

function ContinueButton({ onPress }: { onPress: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, friction: 7, tension: 200 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();

  return (
    <Pressable
      accessibilityLabel="Continue the response"
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.continueButton, { transform: [{ scale }] }]}>
        <Text style={styles.continueButtonText}>Continue</Text>
      </Animated.View>
    </Pressable>
  );
}

export const ChatMessageBubble = memo(ChatMessageBubbleComponent);

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 14,
    gap: 8
  },
  hakiRow: {
    justifyContent: "flex-start"
  },
  userRow: {
    justifyContent: "flex-end"
  },
  hakiAvatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3
  },
  hakiAvatar: {
    marginTop: 2
  },
  userAvatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.maroon,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  userAvatarImage: {
    height: "100%",
    width: "100%"
  },
  bubbleContent: {
    maxWidth: "82%"
  },
  hakiBubbleContent: {
    alignItems: "flex-start"
  },
  userBubbleContent: {
    alignItems: "flex-end"
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
    position: "relative"
  },
  hakiBubble: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 9,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    alignSelf: "flex-start",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2
  },
  hakiBubbleTailBorder: {
    borderBottomColor: "transparent",
    borderBottomWidth: 8,
    borderRightColor: colors.borderStrong,
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
  userBubble: {
    backgroundColor: colors.maroon,
    alignSelf: "flex-end",
    shadowColor: colors.maroon,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3
  },
  senderName: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 3,
    letterSpacing: 0.5
  },
  messageText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20
  },
  hakiMessageText: {
    color: colors.ink
  },
  userMessageText: {
    color: colors.white
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginRight: 4,
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6
  },
  statusIndicatorPressed: {
    opacity: 0.6
  },
  userMessageError: {
    color: colors.goldSoft,
    fontSize: 11,
    fontWeight: "800"
  },
  feedbackRow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    marginLeft: 4,
    marginTop: 8
  },
  feedbackButton: {
    alignItems: "center",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    width: 30,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  feedbackButtonSelected: {
    backgroundColor: colors.maroonSoft,
    borderColor: colors.maroonBorder
  },
  continueContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
    gap: 8
  },
  continueText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600"
  },
  continueButton: {
    backgroundColor: colors.maroonSoft,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.maroonBorder
  },
  continueButtonText: {
    color: colors.maroon,
    fontSize: 13,
    fontWeight: "800"
  },
  modeActions: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 7,
    marginTop: 12,
    paddingTop: 10
  },
  modeActionButton: {
    backgroundColor: colors.maroonSoft,
    borderColor: colors.maroonBorder,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8
  },
  modeActionPressed: {
    opacity: 0.72
  },
  modeActionText: {
    color: colors.maroon,
    fontSize: 12,
    fontWeight: "800"
  },
  noticeStack: {
    gap: 6,
    marginTop: 10
  },
  noticePill: {
    alignItems: "flex-start",
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  noticeText: {
    color: colors.ink,
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16
  },
  missingSourceButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.maroonSoft,
    borderColor: colors.maroonBorder,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  missingSourceText: {
    color: colors.maroon,
    fontSize: 12,
    fontWeight: "800"
  }
});
