import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import * as Crypto from "expo-crypto";

import { getRelatedConversationContext, saveConversationMemory, saveRecentQuestion } from "@/services/historyService";
import { answerStudentQuestion } from "@/services/answerService";
import { getSelectedAIMode } from "@/services/modeSelectionService";
import { normalizeQuery } from "@/retrieval/queryNormalizer";
import type { ChatContextTurn, SearchResponse } from "@/types/search";
import type { ChatMessage } from "@/types/chat";
import { sanitizeAssistantDisplayText } from "@/ai/sanitizeAssistantText";
import { classifyStudentQuestionIntent } from "@/services/questionIntentService";
import { buildConversationState } from "@/services/conversationStateService";
import { buildArithmeticFollowUpAnswer } from "@/services/chatArithmeticShortcut";
import { buildConversationContext, mergeChatContext } from "@/services/chatConversationContext";
import { needsContinuation, stitchContinuation } from "@/services/chatContinuation";
import { isFollowUpQuestion } from "@/services/chatFollowUpDetection";
import { buildAnswerMessage } from "@/services/searchResultText";
import { saveChatFeedback } from "@/services/chatFeedbackService";
import type { ChatFeedbackRating } from "@/types/chat";

/** Generates a collision-resistant unique ID for chat messages. */
function createId(): string {
  return Crypto.randomUUID();
}

function createOpeningMessage(): ChatMessage {
  return {
    id: "opening",
    sender: "haki",
    text: "Ask me about campus offices, enrollment, rules, student life, study help, or safe general questions."
  };
}

function appendStreamingToken(params: {
  token: string;
  mountedRef: MutableRefObject<boolean>;
  requestRef: MutableRefObject<number>;
  requestId: number;
  abortSignal: AbortSignal;
  streamedMessageId: string | null;
  setStreaming: (v: boolean) => void;
  streamedTextRef: MutableRefObject<string>;
  streamFlushTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  flushStreamingText: (messageId: string) => void;
}): string | null {
  const {
    token,
    mountedRef,
    requestRef,
    requestId,
    abortSignal,
    streamedMessageId,
    setStreaming,
    streamedTextRef,
    streamFlushTimeoutRef,
    flushStreamingText
  } = params;

  if (!token || !mountedRef.current || requestRef.current !== requestId || abortSignal.aborted) {
    return streamedMessageId;
  }

  let nextId = streamedMessageId;
  if (!nextId) {
    nextId = createId();
    setStreaming(true);
  }

  streamedTextRef.current = `${streamedTextRef.current}${token}`;
  if (!streamFlushTimeoutRef.current) {
    const messageIdForFlush = nextId;
    streamFlushTimeoutRef.current = setTimeout(() => flushStreamingText(messageIdForFlush), 50);
  }
  return nextId;
}

export interface UseChatMessagesResult {
  messages: ChatMessage[];
  /** Live token stream for the assistant; not part of `messages` (render outside `FlatList`). */
  streamingMessage: ChatMessage | null;
  loading: boolean;
  streaming: boolean;
  initializing: boolean;
  error: string | null;
  lastFailedQuestion: string | null;
  pendingQuestion: string | null;
  inFlightRef: MutableRefObject<boolean>;
  mountedRef: MutableRefObject<boolean>;
  sendMessage: (overrideQuestion?: string) => Promise<void>;
  stopResponse: () => void;
  submitFeedback: (messageId: string, rating: ChatFeedbackRating) => Promise<void>;
  setInitializing: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
}

export function useChatMessages(profileContext?: string | null): UseChatMessagesResult {
  const [messages, setMessagesState] = useState<ChatMessage[]>(() => [createOpeningMessage()]);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const profileContextRef = useRef<string | null>(profileContext ?? null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const answerAbortRef = useRef<AbortController | null>(null);
  const streamedTextRef = useRef("");
  const streamFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  messagesRef.current = messages;
  profileContextRef.current = profileContext ?? null;

  const setMessages = useCallback((action: SetStateAction<ChatMessage[]>) => {
    setMessagesState((current) => {
      const next = typeof action === "function" ? action(current) : action;
      messagesRef.current = next;
      return next;
    });
  }, []);

  const clearPendingStreamFlush = useCallback(() => {
    if (streamFlushTimeoutRef.current) {
      clearTimeout(streamFlushTimeoutRef.current);
      streamFlushTimeoutRef.current = null;
    }
  }, []);

  const flushStreamingText = useCallback((messageId: string) => {
    streamFlushTimeoutRef.current = null;
    const text = sanitizeAssistantDisplayText(streamedTextRef.current);
    setStreamingMessage({ id: messageId, sender: "haki", text });
  }, []);

  useEffect(() => () => {
    clearPendingStreamFlush();
    answerAbortRef.current?.abort();
  }, [clearPendingStreamFlush]);

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
    requestRef.current = requestId;
    inFlightRef.current = true;
    answerAbortRef.current?.abort();
    answerAbortRef.current = new AbortController();
    const abortSignal = answerAbortRef.current.signal;
    setError(null);
    setLastFailedQuestion(null);
    setLoading(true);
    setStreaming(false);
    setStreamingMessage(null);
    streamedTextRef.current = "";
    clearPendingStreamFlush();
    setPendingQuestion(question);

    const intent = classifyStudentQuestionIntent(question);
    const messageSnapshot = messagesRef.current;
    const hasPriorTurns = messageSnapshot.some((m) => m.id !== "opening" && m.text.trim().length > 0);
    const isFollowUp = isFollowUpQuestion(question, hasPriorTurns);
    const localConversationContext = isFollowUp ? buildConversationContext(messageSnapshot) : [];
    const conversationState = buildConversationState({ intent, messages: messageSnapshot, question });
    let streamedMessageId: string | null = null;

    const onToken = (token: string) => {
      streamedMessageId = appendStreamingToken({
        token,
        mountedRef,
        requestRef,
        requestId,
        abortSignal,
        streamedMessageId,
        setStreaming,
        streamedTextRef,
        streamFlushTimeoutRef,
        flushStreamingText
      });
    };

    setMessages((current) => [
      ...current,
      { id: userMessageId, sender: "user", status: "sent", text: question }
    ]);

    void saveRecentQuestion(question).catch(() => undefined);

    try {
      const relatedConversationContext = await getRelatedConversationContext(question, intent).catch(() => []);
      const conversationContext = mergeChatContext(relatedConversationContext, localConversationContext);
      const arithmeticAnswer = buildArithmeticFollowUpAnswer(question, messageSnapshot);
      let response: SearchResponse;

      if (arithmeticAnswer) {
        const mode = (await getSelectedAIMode()).mode;
        response = {
          question,
          normalizedQuestion: normalizeQuery(question),
          responseType: "general_advice",
          results: [],
          confidence: "high",
          reliable: true,
          answerText: arithmeticAnswer,
          citationsUsed: [],
          provenance: "Answered with safe student guidance",
          activeMode: mode
        };
      } else {
        response = await answerStudentQuestion(question, {
          conversationContext,
          conversationState,
          intent,
          profileContext: profileContextRef.current ?? undefined,
          abortSignal,
          onToken
        });
      }

      if (!mountedRef.current || requestRef.current !== requestId) return;
      clearPendingStreamFlush();

      if (abortSignal.aborted) {
        const stoppedText = sanitizeAssistantDisplayText(streamedTextRef.current).trim() || "Response stopped.";
        setMessages((current) => {
          const withSentUser = current.map((m) => (m.id === userMessageId ? { ...m, status: "sent" as const } : m));
          return [...withSentUser, { id: streamedMessageId ?? createId(), question, sender: "haki", text: stoppedText }];
        });
        setStreamingMessage(null);
        streamedTextRef.current = "";
        return;
      }

      const topResult = response.topResult ?? response.results[0];
      let answerText =
        arithmeticAnswer ??
        (response.reliable && topResult
          ? buildAnswerMessage(response, topResult)
          : response.answerText?.trim() ||
            "I don't have a solid saved answer for that yet. Try adding one more detail, or verify official requirements with the relevant office.");

      let continuationAttempts = 0;
      while (!arithmeticAnswer && needsContinuation(response, answerText) && continuationAttempts < 2) {
        continuationAttempts += 1;
        const continuationContext = mergeChatContext(conversationContext, [
          { sender: "user", text: question },
          { sender: "haki", text: answerText }
        ]);
        const continuation = await answerStudentQuestion(
          "Continue the previous answer from where it stopped. Do not restart, and finish the sentence.",
          {
            conversationContext: continuationContext,
            conversationState,
            intent,
            continuation: true,
            profileContext: profileContextRef.current ?? undefined,
            abortSignal,
            onToken
          }
        );
        const nextText = continuation.answerText?.trim();
        if (!nextText) break;

        const merged = stitchContinuation(answerText, nextText);

        response = {
          ...response,
          answerText: merged,
          ...(continuation.isIncomplete !== undefined ? { isIncomplete: continuation.isIncomplete } : {})
        };
        answerText = response.answerText ?? answerText;
      }

      const hakiMessage: ChatMessage = {
        id: streamedMessageId ?? createId(),
        question,
        response,
        sender: "haki",
        text: answerText
      };
      if (topResult) hakiMessage.result = topResult;

      setMessages((current) => {
        const withSentUser = current.map((m) => (m.id === userMessageId ? { ...m, status: "sent" as const } : m));
        return [...withSentUser, hakiMessage];
      });
      void saveConversationMemory({ question, answer: answerText, intent }).catch(() => undefined);
      setStreamingMessage(null);
      streamedTextRef.current = "";
    } catch (err) {
      if (mountedRef.current && requestRef.current === requestId) {
        clearPendingStreamFlush();
        const message = err instanceof Error ? err.message : "Haki had trouble answering.";
        setError(message);
        setLastFailedQuestion(question);
        setMessages((current) => [
          ...current.map((m) => (m.id === userMessageId ? { ...m, status: "failed" as const } : m)),
          {
            id: createId(),
            question,
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
        setStreamingMessage(null);
        streamedTextRef.current = "";
        clearPendingStreamFlush();
        setPendingQuestion(null);
      }
    }
  }, [clearPendingStreamFlush, flushStreamingText, initializing, setMessages]);

  const stopResponse = useCallback(() => {
    if (!inFlightRef.current) return;
    answerAbortRef.current?.abort();
  }, []);

  const submitFeedback = useCallback(async (messageId: string, rating: ChatFeedbackRating) => {
    const snapshot = messagesRef.current;
    const index = snapshot.findIndex((message) => message.id === messageId);
    const message = snapshot[index];
    if (!message || message.sender !== "haki" || message.id === "opening") return;

    const previousUserMessage = [...snapshot.slice(0, index)].reverse().find((item) => item.sender === "user");
    const question = message.question?.trim() || previousUserMessage?.text.trim() || "";
    if (!question) return;

    setMessages((current) =>
      current.map((item) => (item.id === messageId ? { ...item, feedbackRating: rating } : item))
    );

    try {
      await saveChatFeedback({ ...message, feedbackRating: rating }, question, rating);
    } catch {
      setError("Haki couldn't save that feedback locally.");
    }
  }, [setMessages]);

  return {
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
  };
}
