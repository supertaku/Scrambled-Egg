import AsyncStorage from "@react-native-async-storage/async-storage";

import { campusFeathers } from "@/data/campusMapCollectibles";
import { logger } from "@/utils/logger";

const FEATHERS_KEY = "haki.campusFeathers";

/** Collected feather ids, pruned to feathers that still exist. */
export async function loadCollectedFeathers(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(FEATHERS_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    const validIds = new Set(campusFeathers.map((feather) => feather.id));
    return new Set(parsed.filter((id): id is string => typeof id === "string" && validIds.has(id)));
  } catch (error) {
    logger.ui.warn("Could not load campus feather progress.", {
      error: error instanceof Error ? error.message : String(error)
    });
    return new Set();
  }
}

export function saveCollectedFeathers(collected: ReadonlySet<string>): void {
  void AsyncStorage.setItem(FEATHERS_KEY, JSON.stringify([...collected])).catch((error) => {
    logger.ui.warn("Could not save campus feather progress.", {
      error: error instanceof Error ? error.message : String(error)
    });
  });
}

export function resetCollectedFeathers(): void {
  void AsyncStorage.removeItem(FEATHERS_KEY).catch(() => undefined);
}
