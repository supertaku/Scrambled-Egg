import AsyncStorage from "@react-native-async-storage/async-storage";

import { MAX_RECENT_QUESTIONS, STORAGE_KEYS } from "@/utils/constants";

/** Returns the student's most recently asked questions from local storage. */
export async function getRecentQuestions(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_QUESTIONS);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Prepends a new question to the history, deduplicates (case-insensitive),
 * and trims the list to MAX_RECENT_QUESTIONS.
 */
export async function saveRecentQuestion(question: string): Promise<string[]> {
  const trimmed = question.trim();
  if (!trimmed) {
    return getRecentQuestions();
  }

  const current = await getRecentQuestions();
  const next = [trimmed, ...current.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(
    0,
    MAX_RECENT_QUESTIONS
  );
  await AsyncStorage.setItem(STORAGE_KEYS.RECENT_QUESTIONS, JSON.stringify(next));
  return next;
}
