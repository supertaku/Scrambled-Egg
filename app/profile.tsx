import { useCallback, useEffect, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { useRouter } from "expo-router";
import { ArrowLeft, BookOpen, Calendar, ChevronRight, Cpu, GraduationCap, Hash, ImagePlus, Save, Sparkles, Trash2, User as UserIcon } from "lucide-react-native";

import { clearStudentProfile, getStudentProfile, importStudentAvatar, saveStudentProfile } from "@/services/studentProfileService";
import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/themes";

export default function ProfileScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();

  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [course, setCourse] = useState("");
  const [year, setYear] = useState("");
  const [section, setSection] = useState("");
  const [avatarUri, setAvatarUri] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const avatarScale = useRef(new Animated.Value(1)).current;
  const saveButtonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 360,
        useNativeDriver: true
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 9,
        tension: 50,
        useNativeDriver: true
      })
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    let mounted = true;

    getStudentProfile()
      .then((profile) => {
        if (!mounted) {
          return;
        }

        setName(profile.name);
        setStudentId(profile.studentId);
        setCourse(profile.course);
        setYear(profile.year);
        setSection(profile.section);
        setAvatarUri(profile.avatarUri ?? "");
      })
      .catch(() => {
        if (mounted) {
          setProfileError("Could not load your saved profile.");
        }
      })
      .finally(() => {
        if (mounted) {
          setProfileLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = useCallback(async () => {
    setSavingProfile(true);
    setProfileError(null);
    setSaveSuccess(false);

    // Press animation
    Animated.sequence([
      Animated.spring(saveButtonScale, { toValue: 0.94, useNativeDriver: true, friction: 6, tension: 200 }),
      Animated.spring(saveButtonScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 })
    ]).start();

    try {
      await saveStudentProfile({ avatarUri, name, studentId, course, year, section });
      setSaveSuccess(true);
      setTimeout(() => {
        router.back();
      }, 600);
    } catch {
      setProfileError("Could not save your profile. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }, [avatarUri, course, name, router, section, studentId, year, saveButtonScale]);

  const handlePickAvatar = useCallback(async () => {
    setProfileError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setProfileError("Allow photo access to upload your avatar.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ["images"],
      quality: 0.82
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    if (!asset?.uri) {
      setProfileError("Could not read the selected image.");
      return;
    }

    // Pulse animation on avatar pick
    Animated.sequence([
      Animated.spring(avatarScale, { toValue: 1.08, useNativeDriver: true, friction: 6, tension: 200 }),
      Animated.spring(avatarScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 120 })
    ]).start();

    try {
      const nextAvatarUri = await importStudentAvatar(asset.uri, avatarUri);
      setAvatarUri(nextAvatarUri);
      await saveStudentProfile({ avatarUri: nextAvatarUri, name, studentId, course, year, section });
    } catch {
      setProfileError("Could not save the selected avatar.");
    }
  }, [avatarUri, avatarScale, course, name, section, studentId, year]);

  const handleClearProfile = useCallback(() => {
    Alert.alert(
      "Delete profile",
      "This removes your saved profile and avatar from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setSavingProfile(true);
            setProfileError(null);
            void clearStudentProfile()
              .then(() => {
                setName("");
                setStudentId("");
                setCourse("");
                setYear("");
                setSection("");
                setAvatarUri("");
              })
              .catch(() => setProfileError("Could not delete your profile. Please try again."))
              .finally(() => setSavingProfile(false));
          }
        }
      ]
    );
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.headerArea}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.white} size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>Student Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.sheetContainer}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Avatar */}
              <View style={styles.avatarContainer}>
                <Animated.View style={[styles.avatarRing, { transform: [{ scale: avatarScale }] }]}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={profileLoading || savingProfile}
                    onPress={handlePickAvatar}
                    style={styles.avatarCircle}
                  >
                    {avatarUri ? (
                      <Image resizeMode="cover" source={{ uri: avatarUri }} style={styles.avatarImage} />
                    ) : (
                      <UserIcon color={colors.maroon} size={44} />
                    )}
                    <View style={styles.avatarEditBadge}>
                      <ImagePlus color={colors.white} size={14} />
                    </View>
                  </Pressable>
                </Animated.View>
                <Text style={styles.avatarLabel}>
                  {profileLoading ? "Loading profile..." : studentId ? `ID: ${studentId}` : "Tap to add a photo"}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Complete or edit profile with Haki"
                onPress={() => router.push({ pathname: "/onboarding" as never, params: { mode: "edit", returnTo: "profile" } } as never)}
                style={styles.hakiSetupButton}
              >
                <View style={styles.hakiSetupIcon}>
                  <Sparkles color={colors.maroon} size={20} />
                </View>
                <View style={styles.modelSettingsText}>
                  <Text style={styles.modelSettingsTitle}>Complete profile with Haki</Text>
                  <Text style={styles.modelSettingsBody}>Edit your information one step at a time.</Text>
                </View>
                <ChevronRight color={colors.muted} size={18} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Manage Haki models"
                onPress={() => router.push("/models" as never)}
                style={styles.modelSettingsButton}
              >
                <View style={styles.modelSettingsIcon}>
                  <Cpu color={colors.maroon} size={20} />
                </View>
                <View style={styles.modelSettingsText}>
                  <Text style={styles.modelSettingsTitle}>Haki Models</Text>
                  <Text style={styles.modelSettingsBody}>Download a model to unlock Friendly Haki modes.</Text>
                </View>
                <ChevronRight color={colors.muted} size={18} />
              </Pressable>

              {/* Form */}
              <View style={styles.form}>
                <FormField
                  label="Full Name"
                  icon={<UserIcon color={colors.gold} size={17} />}
                  value={name}
                  placeholder="Enter your full name"
                  editable={!profileLoading && !savingProfile}
                  onChangeText={setName}
                />
                <FormField
                  label="Student ID Number"
                  icon={<BookOpen color={colors.gold} size={17} />}
                  value={studentId}
                  placeholder="e.g. TUPM-21-XXXX"
                  editable={!profileLoading && !savingProfile}
                  onChangeText={setStudentId}
                />
                <FormField
                  label="Course / Program"
                  icon={<GraduationCap color={colors.gold} size={17} />}
                  value={course}
                  placeholder="e.g. BS in Computer Science"
                  editable={!profileLoading && !savingProfile}
                  onChangeText={setCourse}
                />
                <FormField
                  label="Year Level"
                  icon={<Calendar color={colors.gold} size={17} />}
                  value={year}
                  placeholder="e.g. 3rd Year"
                  editable={!profileLoading && !savingProfile}
                  onChangeText={setYear}
                />
                <FormField
                  label="Section"
                  icon={<Hash color={colors.gold} size={17} />}
                  value={section}
                  placeholder="e.g. BSIT 3A"
                  editable={!profileLoading && !savingProfile}
                  onChangeText={setSection}
                />
              </View>

              {profileError ? <Text selectable style={styles.errorText}>{profileError}</Text> : null}

              {/* Save button */}
              <Pressable
                accessibilityRole="button"
                disabled={profileLoading || savingProfile}
                onPress={handleSave}
              >
                <Animated.View
                  style={[
                    styles.saveButton,
                    profileLoading || savingProfile ? styles.saveButtonDisabled : undefined,
                    saveSuccess ? styles.saveButtonSuccess : undefined,
                    { transform: [{ scale: saveButtonScale }] }
                  ]}
                >
                  {savingProfile ? (
                    <ActivityIndicator color={colors.white} />
                  ) : saveSuccess ? (
                    <Text style={styles.saveButtonText}>✓ Saved!</Text>
                  ) : (
                    <>
                      <Save color={colors.white} size={18} />
                      <Text style={styles.saveButtonText}>Save Profile</Text>
                    </>
                  )}
                </Animated.View>
              </Pressable>

              <Pressable
                accessibilityLabel="Delete saved student profile"
                accessibilityRole="button"
                disabled={profileLoading || savingProfile}
                onPress={handleClearProfile}
                style={[styles.deleteButton, profileLoading || savingProfile ? styles.deleteButtonDisabled : undefined]}
              >
                <Trash2 color={colors.danger} size={16} />
                <Text style={styles.deleteButtonText}>Delete Profile</Text>
              </Pressable>

              <View style={styles.footerInfo}>
                <Text style={styles.footerText}>
                  Your profile details are saved only on this phone.
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function FormField({
  label,
  icon,
  value,
  placeholder,
  editable,
  onChangeText
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  placeholder: string;
  editable: boolean;
  onChangeText: (text: string) => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, focused ? styles.inputWrapperFocused : undefined]}>
        <View style={styles.inputIcon}>{icon}</View>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={value}
          editable={editable}
          onChangeText={onChangeText}
          placeholderTextColor={colors.mutedLight}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  safeArea: {
    backgroundColor: colors.maroon,
    flex: 1
  },
  headerArea: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 18
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlayMedium,
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    flex: 1,
    overflow: "hidden"
  },
  content: {
    flex: 1
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: 28
  },
  avatarRing: {
    padding: 3,
    borderRadius: 57,
    borderWidth: 2,
    borderColor: colors.gold,
    marginBottom: 12,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  avatarImage: {
    height: "100%",
    width: "100%"
  },
  avatarEditBadge: {
    alignItems: "center",
    backgroundColor: colors.maroon,
    borderColor: colors.white,
    borderRadius: 14,
    borderWidth: 2,
    bottom: 0,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 28
  },
  avatarLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600"
  },
  form: {
    gap: 18,
    marginBottom: 28
  },
  modelSettingsButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    padding: 14
  },
  hakiSetupButton: {
    alignItems: "center",
    backgroundColor: colors.goldSoft,
    borderColor: colors.goldBorder,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    padding: 14
  },
  hakiSetupIcon: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 11,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  modelSettingsIcon: {
    alignItems: "center",
    backgroundColor: colors.maroonSoft,
    borderRadius: 11,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  modelSettingsText: { flex: 1, gap: 2 },
  modelSettingsTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  modelSettingsBody: { color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  inputGroup: {
    gap: 7
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 2,
    letterSpacing: 0.1
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14
  },
  inputWrapperFocused: {
    borderColor: colors.maroon,
    shadowColor: colors.maroon,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    flex: 1,
    height: 52,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600"
  },
  saveButton: {
    backgroundColor: colors.maroon,
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: colors.maroon,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6
  },
  saveButtonDisabled: {
    backgroundColor: colors.grayhawk,
    shadowOpacity: 0
  },
  saveButtonSuccess: {
    backgroundColor: colors.success,
    shadowColor: colors.success
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800"
  },
  deleteButton: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    height: 46,
    justifyContent: "center",
    marginTop: 12
  },
  deleteButtonDisabled: {
    opacity: 0.55
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "900"
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginBottom: 12,
    textAlign: "center"
  },
  footerInfo: {
    marginTop: 24,
    alignItems: "center"
  },
  footerText: {
    color: colors.mutedLight,
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic"
  }
});
