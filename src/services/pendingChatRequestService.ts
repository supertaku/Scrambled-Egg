import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ChatRole } from "@/types/search";
import { STORAGE_KEYS } from "@/utils/constants";

export interface PendingChatRequest {
  chatRole: ChatRole;
  question: string;
  startedAt: string;
}

export async function savePendingChatRequest(request: PendingChatRequest): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.PENDING_CHAT_REQUEST, JSON.stringify(request));
}

export async function loadPendingChatRequest(): Promise<PendingChatRequest | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_CHAT_REQUEST);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PendingChatRequest>;
    if (typeof parsed.question !== "string" || typeof parsed.startedAt !== "string") return null;
    if (!["haki", "information_officer", "friendly_buddy", "researcher"].includes(parsed.chatRole ?? "")) {
      return null;
    }
    return parsed as PendingChatRequest;
  } catch {
    return null;
  }
}

export async function clearPendingChatRequest(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_CHAT_REQUEST);
}
