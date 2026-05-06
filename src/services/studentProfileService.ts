import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "@/utils/constants";

export interface StudentProfile {
  name: string;
  studentId: string;
  course: string;
  year: string;
}

export const emptyStudentProfile: StudentProfile = {
  name: "",
  studentId: "",
  course: "",
  year: ""
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeProfile(value: unknown): StudentProfile {
  if (!value || typeof value !== "object") {
    return emptyStudentProfile;
  }

  const profile = value as Record<string, unknown>;
  return {
    name: stringValue(profile.name),
    studentId: stringValue(profile.studentId),
    course: stringValue(profile.course),
    year: stringValue(profile.year)
  };
}

export async function getStudentProfile(): Promise<StudentProfile> {
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
    name: profile.name.trim(),
    studentId: profile.studentId.trim(),
    course: profile.course.trim(),
    year: profile.year.trim()
  };

  await AsyncStorage.setItem(STORAGE_KEYS.STUDENT_PROFILE, JSON.stringify(normalized));
}
