import { memo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { RefreshCw, ThumbsDown, ThumbsUp, User as UserIcon } from "lucide-react-native";

import { colors } from "@/theme/colors";
import type { ChatFeedbackRating, ChatMessage } from "@/types/chat";
import { ChatSourceCard } from "./ChatSourceCard";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  userAvatarUri?: string | null;
  onContinue?: () => void;
  onFeedback?: (messageId: string, rating: ChatFeedbackRating) => void;
  onRetry?: () => void;
}

/** Renders a single chat message bubble with avatar and optional source card. */
function ChatMessageBubbleComponent({ message, userAvatarUri, onContinue, onFeedback, onRetry }: ChatMessageBubbleProps) {
  const fromUser = message.sender === "user";
  const { response } = message;
  const result = message.result ?? response?.topResult ?? response?.results[0];
  const canRetry = fromUser && message.status === "failed" && Boolean(onRetry);
  const canGiveFeedback = !fromUser && message.id !== "opening" && Boolean(onFeedback);
  const helpfulSelected = message.feedbackRating === "helpful";
  const wrongSelected = message.feedbackRating === "wrong";

  return (
    <View style={[styles.messageRow, fromUser ? styles.userRow : styles.hakiRow]}>
      {!fromUser && (
        <View style={styles.hakiAvatarContainer}>
          <Image
            source={require("../../../assets/images/mascot/haki-chat-head.png")}
            style={styles.hakiAvatar}
            resizeMode="contain"
          />
        </View>
      )}

      <View style={styles.bubbleContent}>
        <View style={[styles.bubble, fromUser ? styles.userBubble : styles.hakiBubble]}>
          {!fromUser ? <Text style={styles.senderName}>Haki</Text> : null}
          <Text style={[styles.messageText, fromUser ? styles.userMessageText : styles.hakiMessageText]}>
            {message.text}
          </Text>
          {response && !fromUser ? (
            <ChatSourceCard response={response} result={result} />
          ) : null}
          {onContinue ? (
            <View style={styles.continueContainer}>
              <Text style={styles.continueText}>Response stopped. Continue?</Text>
              <Pressable
                accessibilityLabel="Continue the response"
                accessibilityRole="button"
                onPress={onContinue}
                style={({ pressed }) => [styles.continueButton, pressed ? styles.continueButtonPressed : undefined]}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </Pressable>
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
            <Pressable
              accessibilityLabel={helpfulSelected ? "Marked as helpful" : "Mark Haki response as helpful"}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onFeedback?.(message.id, "helpful")}
              style={({ pressed }) => [
                styles.feedbackButton,
                helpfulSelected ? styles.feedbackButtonSelected : undefined,
                pressed ? styles.feedbackButtonPressed : undefined
              ]}
            >
              <ThumbsUp color={helpfulSelected ? colors.maroon : colors.muted} size={14} />
            </Pressable>
            <Pressable
              accessibilityLabel={wrongSelected ? "Marked as wrong" : "Mark Haki response as wrong"}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onFeedback?.(message.id, "wrong")}
              style={({ pressed }) => [
                styles.feedbackButton,
                wrongSelected ? styles.feedbackButtonSelected : undefined,
                pressed ? styles.feedbackButtonPressed : undefined
              ]}
            >
              <ThumbsDown color={wrongSelected ? colors.maroon : colors.muted} size={14} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {fromUser && (
        <View style={styles.userAvatarContainer}>
          {userAvatarUri ? (
            <Image resizeMode="cover" source={{ uri: userAvatarUri }} style={styles.userAvatarImage} />
          ) : (
            <UserIcon color={colors.white} size={18} />
          )}
        </View>
      )}
    </View>
  );
}

export const ChatMessageBubble = memo(ChatMessageBubbleComponent);

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 16,
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
    overflow: "hidden"
  },
  hakiAvatar: {
    width: 34,
    height: 34
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
    maxWidth: "82%",
    alignItems: "flex-end"
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  hakiBubble: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    alignSelf: "flex-start"
  },
  userBubble: {
    backgroundColor: colors.maroon,
    alignSelf: "flex-end"
  },
  senderName: {
    color: colors.maroon,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 3
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
    fontWeight: "800",
  },
  feedbackRow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    marginLeft: 4,
    marginTop: 6
  },
  feedbackButton: {
    alignItems: "center",
    borderRadius: 999,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  feedbackButtonPressed: {
    opacity: 0.65
  },
  feedbackButtonSelected: {
    backgroundColor: colors.maroonSoft
  },
  continueContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
    gap: 6
  },
  continueText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600"
  },
  continueButton: {
    backgroundColor: colors.maroonSoft,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 14
  },
  continueButtonPressed: {
    opacity: 0.7
  },
  continueButtonText: {
    color: colors.maroon,
    fontSize: 13,
    fontWeight: "800"
  }
});
