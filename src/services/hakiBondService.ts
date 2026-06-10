import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DEFAULT_HAKI_BOND_STATE,
  nextBondState,
  type HakiBondEvent,
  type HakiBondState,
  type HakiMascotMood
} from "@/components/mascot/hakiMascotState";

export const HAKI_BOND_STORAGE_KEY = "haki.mascotBond.v1";

interface HakiBondStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface HakiBondStore {
  getBondState(): Promise<HakiBondState>;
  recordBondEvent(event: HakiBondEvent): Promise<HakiBondState>;
}

const MOODS = new Set<HakiMascotMood>(["calm", "curious", "happy", "sleepy", "dizzy", "concerned", "annoyed", "focused"]);

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseBondState(value: string | null): HakiBondState {
  if (!value) return DEFAULT_HAKI_BOND_STATE;

  try {
    const parsed = JSON.parse(value) as Partial<HakiBondState>;
    const parsedMood = parsed.mood as HakiMascotMood;
    const mood = MOODS.has(parsedMood) ? parsedMood : DEFAULT_HAKI_BOND_STATE.mood;
    return {
      familiarity: Math.max(0, Math.min(20, finiteNumber(parsed.familiarity, 0))),
      interactionCount: Math.max(0, finiteNumber(parsed.interactionCount, 0)),
      lastInteractionAt: typeof parsed.lastInteractionAt === "string" ? parsed.lastInteractionAt : null,
      mood,
      recentPositiveEvents: Math.max(0, Math.min(5, finiteNumber(parsed.recentPositiveEvents, 0))),
      recentNegativeEvents: Math.max(0, Math.min(5, finiteNumber(parsed.recentNegativeEvents, 0)))
    };
  } catch {
    return DEFAULT_HAKI_BOND_STATE;
  }
}

export function createHakiBondStore(
  storage: HakiBondStorage = AsyncStorage,
  now: () => string = () => new Date().toISOString()
): HakiBondStore {
  async function getBondState(): Promise<HakiBondState> {
    return parseBondState(await storage.getItem(HAKI_BOND_STORAGE_KEY));
  }

  async function recordBondEvent(event: HakiBondEvent): Promise<HakiBondState> {
    const current = await getBondState();
    const next = nextBondState(current, event, now());
    await storage.setItem(HAKI_BOND_STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  return {
    getBondState,
    recordBondEvent
  };
}

export const hakiBondStore = createHakiBondStore();
