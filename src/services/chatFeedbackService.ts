import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "@/utils/constants";
import type {
  ChatFeedbackEntry,
  ChatFeedbackRating,
  ChatFeedbackSourceSnapshot,
  ChatMessage
} from "@/types/chat";
import type { SearchResponse, SearchResult } from "@/types/search";

const MAX_CHAT_FEEDBACK_ENTRIES = 100;
let feedbackWriteQueue: Promise<void> = Promise.resolve();

function sourceSnapshot(result: SearchResult): ChatFeedbackSourceSnapshot {
  return {
    category: result.category,
    chunkId: result.chunkId,
    citation: result.citation,
    documentId: result.documentId,
    documentTitle: result.documentTitle,
    lastUpdated: result.lastUpdated,
    office: result.office,
    processName: result.processName,
    sectionTitle: result.sectionTitle
  };
}

function responseSources(response: SearchResponse | undefined, result: SearchResult | undefined): ChatFeedbackSourceSnapshot[] {
  const seen = new Set<string>();
  const sources: ChatFeedbackSourceSnapshot[] = [];
  const candidates = [result, response?.topResult, ...(response?.results ?? [])].filter(Boolean) as SearchResult[];
  const citedIds = response ? new Set(response.citationsUsed) : null;

  for (const candidate of candidates) {
    if (citedIds && !citedIds.has(candidate.chunkId)) continue;
    if (seen.has(candidate.chunkId)) continue;
    seen.add(candidate.chunkId);
    sources.push(sourceSnapshot(candidate));
    if (sources.length >= 5) break;
  }

  return sources;
}

function buildFeedbackEntry(message: ChatMessage, question: string, rating: ChatFeedbackRating): ChatFeedbackEntry {
  const response = message.response;
  return {
    answer: message.text,
    ...(response?.answerBasis ? { answerBasis: response.answerBasis } : {}),
    citationsUsed: response?.citationsUsed ?? [],
    ...(response?.confidence ? { confidence: response.confidence } : {}),
    createdAt: new Date().toISOString(),
    messageId: message.id,
    ...(response?.activeMode?.id ? { modeId: response.activeMode.id } : {}),
    ...(response?.activeMode?.label ? { modeLabel: response.activeMode.label } : {}),
    modelTier: response?.activeMode?.capabilities?.modelTier ?? null,
    ...(response?.provenance ? { provenance: response.provenance } : {}),
    question,
    ...(response?.requestedChatRole ? { requestedChatRole: response.requestedChatRole } : {}),
    rating,
    ...(typeof response?.reliable === "boolean" ? { reliable: response.reliable } : {}),
    ...(response?.responseType ? { responseType: response.responseType } : {}),
    sources: responseSources(response, message.result)
  };
}

async function readFeedbackEntries(): Promise<ChatFeedbackEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_FEEDBACK);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is ChatFeedbackEntry => Boolean(entry?.messageId)) : [];
  } catch {
    return [];
  }
}

export async function saveChatFeedback(
  message: ChatMessage,
  question: string,
  rating: ChatFeedbackRating
): Promise<ChatFeedbackEntry> {
  const entry = buildFeedbackEntry(message, question, rating);
  feedbackWriteQueue = feedbackWriteQueue
    .catch(() => undefined)
    .then(async () => {
      const existing = await readFeedbackEntries();
      const withoutCurrent = existing.filter((item) => item.messageId !== message.id);
      const bounded = [entry, ...withoutCurrent].slice(0, MAX_CHAT_FEEDBACK_ENTRIES);
      await AsyncStorage.setItem(STORAGE_KEYS.CHAT_FEEDBACK, JSON.stringify(bounded));
    });

  await feedbackWriteQueue;
  return entry;
}
