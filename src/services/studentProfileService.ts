import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Directory, File, Paths } from "expo-file-system";

import { STORAGE_KEYS } from "@/utils/constants";
import { logger } from "@/utils/logger";

export interface StudentProfile {
  avatarUri?: string;
  name: string;
  studentId: string;
  course: string;
  year: string;
}

export const emptyStudentProfile: StudentProfile = {
  avatarUri: "",
  name: "",
  studentId: "",
  course: "",
  year: ""
};

const PROFILE_DIR = new Directory(Paths.document, "profile");

/** iOS Keychain value limit is tight; core JSON stays small without the avatar URI. */
const SECURE_PROFILE_CORE_KEY = "tupt_wiki_student_profile_core_v1";

interface ProfileCorePayload {
  name: string;
  studentId: string;
  course: string;
  year: string;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeProfile(value: unknown): StudentProfile {
  if (!value || typeof value !== "object") {
    return emptyStudentProfile;
  }

  const profile = value as Record<string, unknown>;
  return {
    avatarUri: stringValue(profile.avatarUri),
    name: stringValue(profile.name),
    studentId: stringValue(profile.studentId),
    course: stringValue(profile.course),
    year: stringValue(profile.year)
  };
}

function normalizeCore(profile: StudentProfile): ProfileCorePayload {
  return {
    name: profile.name.trim(),
    studentId: profile.studentId.trim(),
    course: profile.course.trim(),
    year: profile.year.trim()
  };
}

function ensureProfileDirectory(): void {
  PROFILE_DIR.create({ intermediates: true, idempotent: true });
}

function avatarExtension(uri: string): string {
  const match = uri.split("?")[0]?.match(/\.(jpg|jpeg|png|webp)$/i);
  return match?.[0]?.toLowerCase() ?? ".jpg";
}

function safeDeleteAvatar(uri: string | undefined): void {
  if (!uri) return;

  try {
    const file = new File(uri);
    if (file.exists && file.uri.includes("/profile/")) {
      file.delete();
    }
  } catch {
    // Best-effort cleanup only.
  }
}

let secureStoreAvailablePromise: Promise<boolean> | null = null;

async function isSecureStoreUsable(): Promise<boolean> {
  if (!secureStoreAvailablePromise) {
    secureStoreAvailablePromise = SecureStore.isAvailableAsync().catch(() => false);
  }
  return secureStoreAvailablePromise;
}

async function migrateLegacyPlaintextProfile(): Promise<void> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.STUDENT_PROFILE);
  if (!raw) return;

  try {
    const parsed = normalizeProfile(JSON.parse(raw) as unknown);
    const useSecure = await isSecureStoreUsable();

    if (useSecure) {
      await SecureStore.setItemAsync(SECURE_PROFILE_CORE_KEY, JSON.stringify(normalizeCore(parsed)));
      const avatar = parsed.avatarUri?.trim();
      if (avatar) {
        await AsyncStorage.setItem(STORAGE_KEYS.STUDENT_PROFILE_AVATAR_URI, avatar);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.STUDENT_PROFILE_AVATAR_URI);
      }
      await AsyncStorage.removeItem(STORAGE_KEYS.STUDENT_PROFILE);
      logger.ui.log("Migrated student profile from AsyncStorage to SecureStore.");
    }
  } catch (error) {
    logger.ui.warn("Student profile migration failed; keeping legacy storage.", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function getStudentProfile(): Promise<StudentProfile> {
  await migrateLegacyPlaintextProfile();

  const useSecure = await isSecureStoreUsable();

  if (useSecure) {
    try {
      const coreRaw = await SecureStore.getItemAsync(SECURE_PROFILE_CORE_KEY);
      const core = coreRaw
        ? (JSON.parse(coreRaw) as Partial<ProfileCorePayload>)
        : ({} as Partial<ProfileCorePayload>);
      const avatarUri = (await AsyncStorage.getItem(STORAGE_KEYS.STUDENT_PROFILE_AVATAR_URI)) ?? "";

      return normalizeProfile({
        name: core.name,
        studentId: core.studentId,
        course: core.course,
        year: core.year,
        avatarUri
      });
    } catch {
      return emptyStudentProfile;
    }
  }

  const raw = await AsyncStorage.getItem(STORAGE_KEYS.STUDENT_PROFILE);
  if (!raw) {
    return emptyStudentProfile;
  }

  try {
    return normalizeProfile(JSON.parse(raw) as unknown);
  } catch {
    return emptyStudentProfile;
  }
}

export async function saveStudentProfile(profile: StudentProfile): Promise<void> {
  const normalized: StudentProfile = {
    avatarUri: profile.avatarUri?.trim() ?? "",
    name: profile.name.trim(),
    studentId: profile.studentId.trim(),
    course: profile.course.trim(),
    year: profile.year.trim()
  };

  const useSecure = await isSecureStoreUsable();

  if (useSecure) {
    await SecureStore.setItemAsync(SECURE_PROFILE_CORE_KEY, JSON.stringify(normalizeCore(normalized)));
    if (normalized.avatarUri) {
      await AsyncStorage.setItem(STORAGE_KEYS.STUDENT_PROFILE_AVATAR_URI, normalized.avatarUri);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.STUDENT_PROFILE_AVATAR_URI);
    }
    await AsyncStorage.removeItem(STORAGE_KEYS.STUDENT_PROFILE);
    return;
  }

  await AsyncStorage.setItem(STORAGE_KEYS.STUDENT_PROFILE, JSON.stringify(normalized));
}

export async function clearStudentProfile(): Promise<void> {
  const current = await getStudentProfile();
  safeDeleteAvatar(current.avatarUri);
  await AsyncStorage.multiRemove([STORAGE_KEYS.STUDENT_PROFILE, STORAGE_KEYS.STUDENT_PROFILE_AVATAR_URI]);
  if (await isSecureStoreUsable()) {
    await SecureStore.deleteItemAsync(SECURE_PROFILE_CORE_KEY).catch(() => undefined);
  }
}

export async function importStudentAvatar(sourceUri: string, previousAvatarUri?: string): Promise<string> {
  ensureProfileDirectory();
  const source = new File(sourceUri);
  const target = new File(PROFILE_DIR, `avatar-${Date.now()}${avatarExtension(sourceUri)}`);
  source.copy(target);
  safeDeleteAvatar(previousAvatarUri);
  return target.uri;
}

export function studentProfileToChatContext(profile: StudentProfile): string | null {
  const details = [
    profile.name ? `Name: ${profile.name}` : null,
    profile.studentId ? `Student ID: ${profile.studentId}` : null,
    profile.course ? `Course/program: ${profile.course}` : null,
    profile.year ? `Year level: ${profile.year}` : null
  ].filter(Boolean);

  if (details.length === 0) {
    return null;
  }

  return [
    "Student profile context. You may address the student by name when it feels natural. Never repeat the student's ID, course, or year level in your reply unless the student explicitly asks for it. Do not volunteer these details unprompted.",
    ...details
  ].join("\n");
}
