import { Image, StyleSheet, Text, View } from "react-native";
import { User as UserIcon } from "lucide-react-native";

import { colors } from "@/theme/colors";
import type { SearchResponse, SearchResult } from "@/types/search";
import { ChatSourceCard } from "./ChatSourceCard";

export type ChatSender = "user" | "haki";
export type ChatMessageStatus = "failed" | "sending" | "sent";

export interface ChatMessage {
  id: string;
  response?: SearchResponse;
  result?: SearchResult;
  sender: ChatSender;
  status?: ChatMessageStatus;
  text: string;
}

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

/** Renders a single chat message bubble with avatar and optional source card. */
export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const fromUser = message.sender === "user";
  const { response } = message;
  const result = message.result ?? response?.topResult ?? response?.results[0];

  return (
    <View style={[styles.messageRow, fromUser ? styles.userRow : styles.hakiRow]}>
      {!fromUser && (
        <View style={styles.hakiAvatarContainer}>
          <Image
            source={require("../../../assets/images/mascot/grayhawk-idle.png")}
            style={styles.hakiAvatar}
            resizeMode="contain"
          />
        </View>
      )}

      <View style={[styles.bubble, fromUser ? styles.userBubble : styles.hakiBubble]}>
        {!fromUser ? <Text style={styles.senderName}>Haki</Text> : null}
        <Text style={[styles.messageText, fromUser ? styles.userMessageText : styles.hakiMessageText]}>
          {message.text}
        </Text>
        {fromUser && message.status === "sending" ? (
          <Text style={styles.messageStatus}>Sending...</Text>
        ) : null}
        {fromUser && message.status === "failed" ? (
          <Text style={styles.userMessageError}>Not sent</Text>
        ) : null}
        {response && !fromUser ? (
          <ChatSourceCard response={response} result={result} />
        ) : null}
      </View>

      {fromUser && (
        <View style={styles.userAvatarContainer}>
          <UserIcon color={colors.white} size={18} />
        </View>
      )}
    </View>
  );
}

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
    width: 32,
    height: 32,
    marginTop: 4
  },
  userAvatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.maroon,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center"
  },
  bubble: {
    borderRadius: 20,
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  hakiBubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 6,
    borderColor: colors.border,
    borderWidth: 1
  },
  userBubble: {
    backgroundColor: colors.maroon,
    borderBottomRightRadius: 6
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
  messageStatus: {
    color: colors.maroonSoft,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 5
  },
  userMessageError: {
    color: colors.goldSoft,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 5
  }
});
