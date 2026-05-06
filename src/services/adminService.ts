import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "@/utils/constants";

const ADMIN_CODE = "takumi19";

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

export async function verifyAndEnableAdminMode(code: string): Promise<boolean> {
  const isValid = code.trim() === ADMIN_CODE;
  if (isValid) {
    await setAdminMode(true);
  }
  return isValid;
}

export async function disableAdminMode(): Promise<void> {
  await setAdminMode(false);
}
