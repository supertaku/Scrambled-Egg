import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, Camera, Check, Hash, IdCard, User, GraduationCap, Calendar } from "lucide-react-native";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { OnboardingHaki } from "@/components/onboarding/OnboardingHaki";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  getOnboardingStep,
  markOnboardingComplete,
  markOnboardingStarted,
  ONBOARDING_STEP_COUNT,
  saveOnboardingStep
} from "@/services/onboardingService";
import {
  emptyStudentProfile,
  getStudentProfile,
  importStudentAvatar,
  saveStudentProfile,
  type StudentProfile
} from "@/services/studentProfileService";
import { colors } from "@/theme/colors";

type TextProfileField = "name" | "studentId" | "course" | "year" | "section";

interface SetupStep {
  field: TextProfileField | "avatar";
  icon: typeof User;
  label: string;
  prompt: string;
  placeholder?: string;
}

const STEPS: SetupStep[] = [
  { field: "name", icon: User, label: "What is your name?", placeholder: "Enter your full name", prompt: "Hi! What name would you like me to use?" },
  { field: "studentId", icon: IdCard, label: "Student ID number", placeholder: "Enter your student ID", prompt: "Your student ID is saved only on this phone." },
  { field: "course", icon: GraduationCap, label: "Program or course", placeholder: "e.g. BS in Information Technology", prompt: "Tell me your program so I can understand your context." },
  { field: "year", icon: Calendar, label: "Year level", placeholder: "e.g. 3rd Year", prompt: "Which year level are you currently in?" },
  { field: "section", icon: Hash, label: "Section", placeholder: "e.g. BSIT 3A", prompt: "Add your section if you would like more relevant help." },
  { field: "avatar", icon: Camera, label: "Add a profile photo", prompt: "You are ready. A photo is optional, and you can change it later." }
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { mode, returnTo } = useLocalSearchParams<{ mode?: string; returnTo?: string }>();
  const editing = mode === "edit";
  const reducedMotion = useReducedMotion();
  const [draft, setDraft] = useState<StudentProfile>(emptyStudentProfile);
  const [initialProfile, setInitialProfile] = useState<StudentProfile>(emptyStudentProfile);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replayKey, setReplayKey] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    let mounted = true;

    void Promise.all([
      getStudentProfile(),
      editing ? Promise.resolve(0) : getOnboardingStep(),
      editing ? Promise.resolve() : markOnboardingStarted()
    ])
      .then(([profile, savedStep]) => {
        if (!mounted) {
          return;
        }
        setDraft(profile);
        setInitialProfile(profile);
        setStep(savedStep);
      })
      .catch(() => {
        if (mounted) {
          setError("Could not load your setup information.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [editing]);

  useEffect(() => {
    if (!loading && STEPS[step]?.field !== "avatar") {
      const timer = setTimeout(() => inputRef.current?.focus(), 180);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loading, step]);

  const current = STEPS[step] ?? STEPS[0]!;
  const Icon = current.icon;
  const progress = ((step + 1) / ONBOARDING_STEP_COUNT) * 100;
  const isLastStep = step === ONBOARDING_STEP_COUNT - 1;
  const textField = current.field === "avatar" ? null : current.field;
  const textValue = textField ? draft[textField] : "";

  const saveAndAdvance = useCallback(async (profile: StudentProfile) => {
    setSaving(true);
    setError(null);
    try {
      await saveStudentProfile(profile);
      if (isLastStep) {
        await markOnboardingComplete();
        router.replace(returnTo === "profile" ? "/profile" : "/");
        return;
      }

      const nextStep = step + 1;
      if (!editing) {
        await saveOnboardingStep(nextStep);
      }
      setStep(nextStep);
    } catch {
      setError("Could not save this step. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [editing, isLastStep, returnTo, router, step]);

  const handleNext = useCallback(() => {
    void saveAndAdvance(draft);
  }, [draft, saveAndAdvance]);

  const handleSkip = useCallback(() => {
    const nextDraft = current.field === "avatar"
      ? { ...draft, avatarUri: editing ? initialProfile.avatarUri ?? "" : "" }
      : { ...draft, [current.field]: editing ? initialProfile[current.field] : "" };
    setDraft(nextDraft);
    void saveAndAdvance(nextDraft);
  }, [current.field, draft, editing, initialProfile, saveAndAdvance]);

  const handleBack = useCallback(() => {
    if (step > 0) {
      const previousStep = step - 1;
      setStep(previousStep);
      if (!editing) {
        void saveOnboardingStep(previousStep);
      }
      return;
    }
    if (editing) {
      router.back();
    }
  }, [editing, router, step]);

  const handleAvatarPick = useCallback(async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Allow photo access to choose a profile photo, or skip this step.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ["images"],
      quality: 0.82
    });
    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }
    const uri = result.assets[0].uri;

    try {
      const avatarUri = await importStudentAvatar(uri, draft.avatarUri);
      setDraft((profile) => ({ ...profile, avatarUri }));
    } catch {
      setError("Could not save the selected photo.");
    }
  }, [draft.avatarUri]);

  const actionLabel = useMemo(() => isLastStep ? "Finish" : "Next", [isLastStep]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loading} edges={["top", "left", "right", "bottom"]}>
        <ActivityIndicator color={colors.white} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        {(step > 0 || editing) ? (
          <Pressable accessibilityLabel="Previous setup step" onPress={handleBack} style={styles.backButton}>
            <ArrowLeft color={colors.white} size={21} />
          </Pressable>
        ) : (
          <View style={styles.backButtonSpacer} />
        )}
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Meet Haki</Text>
          <Text style={styles.headerSubtitle}>Set up your student profile</Text>
        </View>
        <Text style={styles.stepText}>{step + 1}/{ONBOARDING_STEP_COUNT}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <OnboardingHaki
            message={current.prompt}
            onPress={() => setReplayKey((value) => value + 1)}
            reducedMotion={reducedMotion}
            replayKey={replayKey}
            step={step}
          />
          <View style={styles.formCard}>
            <View style={styles.titleRow}>
              <View style={styles.iconCircle}>
                <Icon color={colors.maroon} size={21} />
              </View>
              <Text style={styles.fieldTitle}>{current.label}</Text>
            </View>

            {textField ? (
              <TextInput
                key={textField}
                ref={inputRef}
                accessibilityLabel={current.label}
                autoCapitalize={textField === "studentId" ? "characters" : "words"}
                autoCorrect={false}
                onChangeText={(value) => setDraft((profile) => ({ ...profile, [textField]: value }))}
                onSubmitEditing={handleNext}
                placeholder={current.placeholder}
                placeholderTextColor={colors.mutedLight}
                returnKeyType={isLastStep ? "done" : "next"}
                style={styles.input}
                value={textValue}
              />
            ) : (
              <Pressable accessibilityLabel="Choose a profile photo" onPress={handleAvatarPick} style={styles.avatarPicker}>
                {draft.avatarUri ? (
                  <Image source={{ uri: draft.avatarUri }} resizeMode="cover" style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Camera color={colors.maroon} size={26} />
                    <Text style={styles.avatarText}>Choose photo</Text>
                  </View>
                )}
              </Pressable>
            )}
            <Text style={styles.privacyText}>Saved only on this phone. Every step is optional.</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actionRow}>
            <Pressable disabled={saving} onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>{isLastStep ? "Skip and finish" : "Skip"}</Text>
            </Pressable>
            <Pressable disabled={saving} onPress={handleNext} style={styles.nextButton}>
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Text style={styles.nextText}>{actionLabel}</Text>
                  {isLastStep ? <Check color={colors.white} size={18} /> : <ArrowRight color={colors.white} size={18} />}
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: colors.maroon,
    flex: 1,
    justifyContent: "center"
  },
  safeArea: {
    backgroundColor: colors.maroon,
    flex: 1
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 14,
    paddingTop: 8
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.overlayMedium,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  backButtonSpacer: { height: 44, width: 44 },
  headerCopy: { flex: 1 },
  headerTitle: { color: colors.white, fontSize: 21, fontWeight: "900", letterSpacing: -0.3 },
  headerSubtitle: { color: "rgba(255,255,255,0.66)", fontSize: 12, fontWeight: "600" },
  stepText: { color: colors.goldLight, fontSize: 13, fontWeight: "900", minWidth: 34, textAlign: "right" },
  progressTrack: {
    backgroundColor: "rgba(255,255,255,0.14)",
    height: 4,
    marginHorizontal: 22,
    marginBottom: 12,
    overflow: "hidden",
    borderRadius: 2
  },
  progressFill: { backgroundColor: colors.goldLight, borderRadius: 2, height: "100%" },
  keyboardView: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    flex: 1,
    overflow: "hidden"
  },
  content: {
    flexGrow: 1,
    paddingBottom: 26,
    paddingHorizontal: 18,
    paddingTop: 10
  },
  formCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 18
  },
  titleRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  iconCircle: {
    alignItems: "center",
    backgroundColor: colors.maroonSoft,
    borderRadius: 13,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  fieldTitle: { color: colors.ink, flex: 1, fontSize: 19, fontWeight: "900", letterSpacing: -0.3 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: 15,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
    height: 54,
    paddingHorizontal: 15
  },
  avatarPicker: {
    alignItems: "center",
    alignSelf: "center",
    borderColor: colors.borderStrong,
    borderRadius: 54,
    borderStyle: "dashed",
    borderWidth: 1,
    height: 108,
    justifyContent: "center",
    overflow: "hidden",
    width: 108
  },
  avatarImage: { height: "100%", width: "100%" },
  avatarPlaceholder: { alignItems: "center", gap: 5 },
  avatarText: { color: colors.maroon, fontSize: 12, fontWeight: "800" },
  privacyText: { color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 12,
    textAlign: "center"
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18
  },
  skipButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: 1,
    flex: 1,
    height: 54,
    justifyContent: "center"
  },
  skipText: { color: colors.muted, fontSize: 14, fontWeight: "800" },
  nextButton: {
    alignItems: "center",
    backgroundColor: colors.maroon,
    borderRadius: 17,
    flex: 1.15,
    flexDirection: "row",
    gap: 8,
    height: 54,
    justifyContent: "center"
  },
  nextText: { color: colors.white, fontSize: 15, fontWeight: "900" }
});
