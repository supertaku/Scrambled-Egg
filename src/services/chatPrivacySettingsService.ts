import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "@/utils/constants";

export interface ChatPrivacySettings {
  useProfileContext: boolean;
  useRelatedHistory: boolean;
}

export async function getChatPrivacySettings(): Promise<ChatPrivacySettings> {
  const [profileValue, historyValue] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.CHAT_USE_PROFILE_CONTEXT),
    AsyncStorage.getItem(STORAGE_KEYS.CHAT_USE_RELATED_HISTORY)
  ]);

  return {
    useProfileContext: profileValue === "true",
    useRelatedHistory: historyValue === "true"
  };
}

export async function setUseProfileContext(value: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.CHAT_USE_PROFILE_CONTEXT, value ? "true" : "false");
}

export async function setUseRelatedHistory(value: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.CHAT_USE_RELATED_HISTORY, value ? "true" : "false");
}
