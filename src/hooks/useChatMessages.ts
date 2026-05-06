import { useCallback, useRef, useState } from "react";
import * as Crypto from "expo-crypto";

import { saveRecentQuestion } from "@/services/historyService";
import { answerStudentQuestion } from "@/services/answerService";
import type { ChatContextTurn, SearchResponse, SearchResult } from "@/types/search";

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

/** Generates a collision-resistant unique ID for chat messages. */
function createId(): string {
  return Crypto.randomUUID();
}

function getHakiGreeting(): string {
  return "Hi TUPian, Haki here. Ask me about campus offices, enrollment, rules, student life, or study help.";
}

function getDirectAnswer(result: SearchResult): string {
  return result.answer?.trim() || result.content;
}

function buildAnswerMessage(response: SearchResponse, topResult: SearchResult): string {
  const answer = response.answerText?.trim() || getDirectAnswer(topResult);
  return response.verificationNote ? `${answer}\n\n${response.verificationNote}` : answer;
}

function buildConversationContext(messages: ChatMessage[]): ChatContextTurn[] {
  return messages
    .filter((message) => message.id !== "opening" && message.text.trim().length > 0)
    .slice(-6)
    .map((message) => ({
      sender: message.sender === "user" ? "user" : "haki",
      text: message.text.trim()
    }));
}

export interface UseChatMessagesResult {
  messages: ChatMessage[];
  loading: boolean;
  streaming: boolean;
  initializing: boolean;
  error: string | null;
  lastFailedQuestion: string | null;
  pendingQuestion: string | null;
  inFlightRef: React.MutableRefObject<boolean>;
  mountedRef: React.MutableRefObject<boolean>;
  sendMessage: (overrideQuestion?: string) => Promise<void>;
  setInitializing: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useChatMessages(): UseChatMessagesResult {
  const [messages, setMessagesState] = useState<ChatMessage[]>(() => [
    { id: "opening", sender: "haki", text: getHakiGreeting() }
  ]);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  messagesRef.current = messages;

  const setMessages = useCallback((action: React.SetStateAction<ChatMessage[]>) => {
    setMessagesState((current) => {
      const next = typeof action === "function" ? action(current) : action;
      messagesRef.current = next;
      return next;
    });
  }, []);

  const sendMessage = useCallback(async (overrideQuestion?: string) => {
    const question = (overrideQuestion ?? "").trim();

    if (initializing) {
      setError("Haki is still opening the saved campus guide. Try again in a moment.");
      return;
    }

    if (inFlightRef.current) return;

    if (question.length < 3) {
      setError("Type at least 3 characters so Haki has enough context.");
      return;
    }

    const requestId = requestRef.current + 1;
    const userMessageId = createId();
    const conversationContext = buildConversationContext(messagesRef.current);
    let streamedMessageId: string | null = null;
    requestRef.current = requestId;
    inFlightRef.current = true;
    setError(null);
    setLastFailedQuestion(null);
    setLoading(true);
    setStreaming(false);
    setPendingQuestion(question);
    setMessages((current) => [
      ...current,
      { id: userMessageId, sender: "user", status: "sending", text: question }
    ]);

    void saveRecentQuestion(question).catch(() => undefined);

    try {
      const response = await answerStudentQuestion(question, {
        conversationContext,
        onToken: (token) => {
          if (!token || !mountedRef.current || requestRef.current !== requestId) {
            return;
          }

          if (!streamedMessageId) {
            streamedMessageId = createId();
            const nextStreamedMessageId = streamedMessageId;
            setStreaming(true);
            setMessages((current) => [
              ...current,
              {
                id: nextStreamedMessageId,
                sender: "haki",
                text: token
              }
            ]);
            return;
          }

          const nextStreamedMessageId = streamedMessageId;
          setMessages((current) =>
            current.map((message) =>
              message.id === nextStreamedMessageId
                ? { ...message, text: `${message.text}${token}` }
                : message
            )
          );
        }
      });

      if (!mountedRef.current || requestRef.current !== requestId) return;

      const topResult = response.topResult ?? response.results[0];
      const answerText =
        response.reliable && topResult
          ? buildAnswerMessage(response, topResult)
          : response.answerText?.trim() ||
            "I don't have a solid saved answer for that yet. Try adding one more detail, or verify official requirements with the relevant office.";

      const hakiMessage: ChatMessage = {
        id: streamedMessageId ?? createId(),
        response,
        sender: "haki",
        text: answerText
      };
      if (topResult) hakiMessage.result = topResult;

      setMessages((current) => {
        const withSentUser = current.map((m) => (m.id === userMessageId ? { ...m, status: "sent" as const } : m));
        if (!streamedMessageId) {
          return [...withSentUser, hakiMessage];
        }

        return withSentUser.map((message) =>
          message.id === streamedMessageId ? hakiMessage : message
        );
      });
    } catch (err) {
      if (mountedRef.current && requestRef.current === requestId) {
        const message = err instanceof Error ? err.message : "Haki had trouble answering.";
        setError(message);
        setLastFailedQuestion(question);
        setMessages((current) => [
          ...current.map((m) => (m.id === userMessageId ? { ...m, status: "failed" as const } : m)),
          {
            id: createId(),
            sender: "haki",
            text: "I had trouble checking that just now. Try again in a bit, or add one more detail so I can answer better."
          }
        ]);
      }
    } finally {
      if (mountedRef.current && requestRef.current === requestId) {
        inFlightRef.current = false;
        setLoading(false);
        setStreaming(false);
        setPendingQuestion(null);
      }
    }
  }, [initializing, setMessages]);

  return {
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
  };
}
