import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "haki_voice_autosend";

export async function getVoiceAutoSend(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEY);
  return value === null ? true : value === "true";
}

export async function setVoiceAutoSend(value: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, value ? "true" : "false");
}
