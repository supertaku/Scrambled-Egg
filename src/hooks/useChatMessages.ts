import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import * as Crypto from "expo-crypto";
import { AppState } from "react-native";

import { getRelatedConversationContext, saveConversationMemory, saveRecentQuestion } from "@/services/historyService";
import { answerStudentQuestion } from "@/services/answerService";
import { getSelectedAIMode } from "@/services/modeSelectionService";
import { normalizeQuery } from "@/retrieval/queryNormalizer";
import type { ChatContextTurn, ChatRole, SearchResponse } from "@/types/search";
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
import {
  clearPendingChatRequest,
  loadPendingChatRequest,
  savePendingChatRequest
} from "@/services/pendingChatRequestService";
import type { ChatFeedbackRating } from "@/types/chat";

/** Generates a collision-resistant unique ID for chat messages. */
function createId(): string {
  return Crypto.randomUUID();
}

const OPENING_MESSAGE_BY_ROLE: Record<ChatRole, string> = {
  haki: "What would you like help with today?",
  information_officer: "Ask about a campus office, requirement, or process.",
  friendly_buddy: "Tell me what is on your mind.",
  researcher: "Ask about facts outside campus."
};

function createOpeningMessage(chatRole: ChatRole): ChatMessage {
  return {
    id: "opening",
    sender: "haki",
    text: OPENING_MESSAGE_BY_ROLE[chatRole]
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
  sendMessage: (overrideQuestion?: string, requestOptions?: ChatSendOptions) => Promise<void>;
  startFresh: () => void;
  stopResponse: () => void;
  submitFeedback: (messageId: string, rating: ChatFeedbackRating) => Promise<void>;
  setInitializing: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
}

export interface ChatSendOptions {
  chatRole?: ChatRole;
  continuation?: boolean;
  intentQuestion?: string;
}

export function useChatMessages(
  profileContext?: string | null,
  chatRole: ChatRole = "haki",
  useRelatedHistory = false
): UseChatMessagesResult {
  const [messages, setMessagesState] = useState<ChatMessage[]>(() => [createOpeningMessage(chatRole)]);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const profileContextRef = useRef<string | null>(profileContext ?? null);
  const useRelatedHistoryRef = useRef(useRelatedHistory);
  const chatRoleRef = useRef<ChatRole>(chatRole);
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
  const interruptedByBackgroundRef = useRef(false);
  const streamedTextRef = useRef("");
  const streamFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  messagesRef.current = messages;
  profileContextRef.current = profileContext ?? null;
  useRelatedHistoryRef.current = useRelatedHistory;
  chatRoleRef.current = chatRole;

  const setMessages = useCallback((action: SetStateAction<ChatMessage[]>) => {
    setMessagesState((current) => {
      const next = typeof action === "function" ? action(current) : action;
      messagesRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    setMessages((current) => (
      current.length === 1 && current[0]?.id === "opening"
        ? [createOpeningMessage(chatRole)]
        : current
    ));
  }, [chatRole, setMessages]);

  useEffect(() => {
    let mounted = true;
    void loadPendingChatRequest().then((pending) => {
      if (!mounted || !pending || inFlightRef.current) return;
      setLastFailedQuestion(pending.question);
      setError("A previous answer paused when the app left the foreground. Tap Retry to continue.");
    });

    const subscription = AppState.addEventListener("change", (nextState) => {
      if ((nextState === "inactive" || nextState === "background") && inFlightRef.current) {
        interruptedByBackgroundRef.current = true;
        answerAbortRef.current?.abort();
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
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

  const sendMessage = useCallback(async (overrideQuestion?: string, requestOptions: ChatSendOptions = {}) => {
    const question = (overrideQuestion ?? "").trim();

    if (initializing) {
      setError("Haki is still getting ready. Try again in a moment.");
      return;
    }

    if (inFlightRef.current) return;

    if (question.length < 3) {
      setError("Type at least 3 characters so Haki has enough context.");
      return;
    }

    const requestedChatRole = requestOptions.chatRole ?? chatRoleRef.current;
    const intentQuestion = requestOptions.intentQuestion?.trim() || question;
    const requestId = requestRef.current + 1;
    const userMessageId = createId();
    requestRef.current = requestId;
    inFlightRef.current = true;
    answerAbortRef.current?.abort();
    answerAbortRef.current = new AbortController();
    interruptedByBackgroundRef.current = false;
    const abortSignal = answerAbortRef.current.signal;
    setError(null);
    setLastFailedQuestion(null);
    setLoading(true);
    setStreaming(false);
    setStreamingMessage(null);
    streamedTextRef.current = "";
    clearPendingStreamFlush();
    setPendingQuestion(question);
    void savePendingChatRequest({
      chatRole: requestedChatRole,
      question,
      startedAt: new Date().toISOString()
    }).catch(() => undefined);

    const intent = classifyStudentQuestionIntent(intentQuestion);
    const messageSnapshot = messagesRef.current;
    const hasPriorTurns = messageSnapshot.some((m) => m.id !== "opening" && m.text.trim().length > 0);
    const isFollowUp = Boolean(requestOptions.continuation) || isFollowUpQuestion(question, hasPriorTurns);
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
      const relatedConversationContext = useRelatedHistoryRef.current
        ? await getRelatedConversationContext(intentQuestion, intent).catch(() => [])
        : [];
      const conversationContext = mergeChatContext(relatedConversationContext, localConversationContext);
      const arithmeticAnswer = buildArithmeticFollowUpAnswer(question, messageSnapshot);
      let response: SearchResponse;

      if (arithmeticAnswer) {
        const mode = (await getSelectedAIMode()).mode;
        response = {
          question,
          requestedChatRole,
          answerBasis: "safety_or_app_guidance",
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
          chatRole: requestedChatRole,
          conversationContext,
          conversationState,
          intent,
          ...(requestOptions.continuation ? { continuation: true } : {}),
          profileContext: profileContextRef.current ?? undefined,
          abortSignal,
          onToken
        });
      }

      if (!mountedRef.current || requestRef.current !== requestId) return;
      clearPendingStreamFlush();

      if (abortSignal.aborted) {
        const backgroundInterrupted = interruptedByBackgroundRef.current;
        const stoppedText = backgroundInterrupted
          ? "I paused this answer while the app was in the background. Tap Retry when you return."
          : sanitizeAssistantDisplayText(streamedTextRef.current).trim() || "Response stopped.";
        setMessages((current) => {
          const withSentUser = current.map((m) => (m.id === userMessageId ? { ...m, status: "sent" as const } : m));
          return [...withSentUser, { id: streamedMessageId ?? createId(), question, sender: "haki", text: stoppedText }];
        });
        setStreamingMessage(null);
        streamedTextRef.current = "";
        if (backgroundInterrupted) {
          setLastFailedQuestion(question);
          setError("Answer paused while the app was in the background. Tap Retry to continue.");
        } else {
          void clearPendingChatRequest().catch(() => undefined);
        }
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
            chatRole: requestedChatRole,
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
      void clearPendingChatRequest().catch(() => undefined);
      setStreamingMessage(null);
      streamedTextRef.current = "";
    } catch {
      if (mountedRef.current && requestRef.current === requestId) {
        clearPendingStreamFlush();
        if (abortSignal.aborted) {
          const backgroundInterrupted = interruptedByBackgroundRef.current;
          const stoppedText = backgroundInterrupted
            ? "I paused this answer while the app was in the background. Tap Retry when you return."
            : sanitizeAssistantDisplayText(streamedTextRef.current).trim() || "Response stopped.";
          setMessages((current) => [
            ...current.map((m) => (m.id === userMessageId ? { ...m, status: "sent" as const } : m)),
            { id: streamedMessageId ?? createId(), question, sender: "haki", text: stoppedText }
          ]);
          if (backgroundInterrupted) {
            setLastFailedQuestion(question);
            setError("Answer paused while the app was in the background. Tap Retry to continue.");
          } else {
            void clearPendingChatRequest().catch(() => undefined);
          }
        } else {
          setError("Haki had trouble answering. Please try again.");
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
          void clearPendingChatRequest().catch(() => undefined);
        }
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

  const startFresh = useCallback(() => {
    answerAbortRef.current?.abort();
    requestRef.current += 1;
    inFlightRef.current = false;
    streamedTextRef.current = "";
    clearPendingStreamFlush();
    setLoading(false);
    setStreaming(false);
    setStreamingMessage(null);
    setPendingQuestion(null);
    setLastFailedQuestion(null);
    setError(null);
    setMessages([createOpeningMessage(chatRoleRef.current)]);
    void clearPendingChatRequest().catch(() => undefined);
  }, [clearPendingStreamFlush, setMessages]);

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
      setError("Haki couldn't save that feedback on your phone.");
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
    startFresh,
    stopResponse,
    submitFeedback,
    setInitializing,
    setError
  };
}
