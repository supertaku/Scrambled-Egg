import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

import { STORAGE_KEYS } from "@/utils/constants";

// SHA-256 of the deployment-time admin code. The plaintext code is NEVER
// shipped in the JS bundle. When rotating, regenerate with:
//   PowerShell: [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes("YOUR_CODE"))) -replace '-',''
//   Node:       require('crypto').createHash('sha256').update('YOUR_CODE').digest('hex')
// and replace the constant below.
const ADMIN_CODE_HASH = "ed8effff543751d1751f3f6886821b67daf6d4847f337da3b8e5fb8eabce327d";

const ATTEMPTS_KEY = "tupt_wiki_admin_attempts";
const LOCK_UNTIL_KEY = "tupt_wiki_admin_lock_until";
const MAX_ATTEMPTS_BEFORE_LOCK = 5;
const BASE_LOCK_MS = 30_000; // 30s after 5 failures
const MAX_LOCK_MS = 30 * 60_000; // cap at 30 minutes

type AdminModeListener = (enabled: boolean) => void;

const listeners = new Set<AdminModeListener>();

function notifyAdminMode(enabled: boolean) {
  listeners.forEach((listener) => listener(enabled));
}

export function subscribeAdminMode(listener: AdminModeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function getAdminMode(): Promise<boolean> {
  return (await AsyncStorage.getItem(STORAGE_KEYS.ADMIN_MODE)) === "true";
}

export async function setAdminMode(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_MODE, enabled ? "true" : "false");
  notifyAdminMode(enabled);
}

async function hashCandidate(code: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, code.trim(), {
    encoding: Crypto.CryptoEncoding.HEX
  });
}

/**
 * Constant-time string compare so an attacker timing the rejection can't infer
 * how many leading characters of their guess were correct.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function getLockUntil(): Promise<number> {
  const raw = await AsyncStorage.getItem(LOCK_UNTIL_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getAttempts(): Promise<number> {
  const raw = await AsyncStorage.getItem(ATTEMPTS_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

async function setAttempts(value: number): Promise<void> {
  await AsyncStorage.setItem(ATTEMPTS_KEY, String(value));
}

async function clearFailureState(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(ATTEMPTS_KEY),
    AsyncStorage.removeItem(LOCK_UNTIL_KEY)
  ]);
}

/**
 * Returns milliseconds remaining in the current lockout, or 0 if not locked.
 */
export async function getAdminLockoutRemainingMs(): Promise<number> {
  const lockUntil = await getLockUntil();
  return Math.max(0, lockUntil - Date.now());
}

export interface AdminUnlockResult {
  ok: boolean;
  lockedForMs?: number;
  attemptsRemaining?: number;
}

export async function verifyAndEnableAdminMode(code: string): Promise<boolean> {
  const result = await tryUnlockAdminMode(code);
  return result.ok;
}

/**
 * Richer unlock entry point that exposes lockout state so the UI can show a
 * "try again in 30s" message. The legacy boolean wrapper above is kept for
 * existing callers.
 */
export async function tryUnlockAdminMode(code: string): Promise<AdminUnlockResult> {
  const lockedForMs = await getAdminLockoutRemainingMs();
  if (lockedForMs > 0) {
    return { ok: false, lockedForMs };
  }

  const candidate = await hashCandidate(code);
  const isValid = constantTimeEqual(candidate.toLowerCase(), ADMIN_CODE_HASH.toLowerCase());

  if (isValid) {
    await clearFailureState();
    await setAdminMode(true);
    return { ok: true };
  }

  const nextAttempts = (await getAttempts()) + 1;
  await setAttempts(nextAttempts);

  if (nextAttempts >= MAX_ATTEMPTS_BEFORE_LOCK) {
    // Exponential backoff with a cap. attempts 5 -> 30s, 6 -> 60s, 7 -> 120s, ...
    const overshoot = nextAttempts - MAX_ATTEMPTS_BEFORE_LOCK;
    const lockoutMs = Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** overshoot);
    await AsyncStorage.setItem(LOCK_UNTIL_KEY, String(Date.now() + lockoutMs));
    return { ok: false, lockedForMs: lockoutMs };
  }

  return { ok: false, attemptsRemaining: MAX_ATTEMPTS_BEFORE_LOCK - nextAttempts };
}

export async function disableAdminMode(): Promise<void> {
  await setAdminMode(false);
}
