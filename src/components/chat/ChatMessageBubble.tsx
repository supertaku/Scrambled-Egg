import { memo, useEffect, useRef } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { RefreshCw, ThumbsDown, ThumbsUp, User as UserIcon } from "lucide-react-native";

import { colors } from "@/theme/colors";
import type { ChatFeedbackRating, ChatMessage } from "@/types/chat";
import type { SuggestedModeAction } from "@/types/search";
import { PixelHakiPortrait } from "../mascot/PixelHaki";
import { ChatSourceCard } from "./ChatSourceCard";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  userAvatarUri?: string | null;
  onContinue?: () => void;
  onFeedback?: (messageId: string, rating: ChatFeedbackRating) => void;
  onHakiAvatarPress?: () => void;
  onRetry?: () => void;
  onSuggestedModeAction?: (action: SuggestedModeAction) => void;
}

/** Renders a single chat message bubble with avatar and optional source card. */
function ChatMessageBubbleComponent({ message, userAvatarUri, onContinue, onFeedback, onHakiAvatarPress, onRetry, onSuggestedModeAction }: ChatMessageBubbleProps) {
  const fromUser = message.sender === "user";
  const { response } = message;
  const result = message.result ?? response?.topResult ?? response?.results[0];
  const canRetry = fromUser && message.status === "failed" && Boolean(onRetry);
  const canGiveFeedback = !fromUser && message.id !== "opening" && Boolean(onFeedback);
  const helpfulSelected = message.feedbackRating === "helpful";
  const wrongSelected = message.feedbackRating === "wrong";

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
            <PixelHakiPortrait size={34} style={styles.hakiAvatar} />
          </Animated.View>
        </Pressable>
      )}

      <View style={[styles.bubbleContent, fromUser ? styles.userBubbleContent : styles.hakiBubbleContent]}>
        <View style={[styles.bubble, fromUser ? styles.userBubble : styles.hakiBubble]}>
          {!fromUser ? (
            <>
              <View pointerEvents="none" style={styles.hakiBubbleTailBorder} />
              <View pointerEvents="none" style={styles.hakiBubbleTail} />
            </>
          ) : null}
          {!fromUser ? <Text style={styles.senderName}>Haki</Text> : null}
          <Text selectable style={[styles.messageText, fromUser ? styles.userMessageText : styles.hakiMessageText]}>
            {message.text}
          </Text>
          {response && !fromUser ? (
            <ChatSourceCard response={response} result={result} />
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

const styles = StyleSheet.create({
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
    backgroundColor: colors.white,
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
    backgroundColor: colors.white,
    borderBottomLeftRadius: 9,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    alignSelf: "flex-start",
    shadowColor: "#000",
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
    borderColor: "#E8C7D0"
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
    borderColor: "#E8C7D0"
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
    borderColor: "#E8C7D0",
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
  }
});
