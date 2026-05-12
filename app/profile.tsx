import { useCallback, useEffect, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { 
  ActivityIndicator,
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
import { ArrowLeft, Save, User as UserIcon, BookOpen, GraduationCap, Calendar, ImagePlus } from "lucide-react-native";

import { getStudentProfile, importStudentAvatar, saveStudentProfile } from "@/services/studentProfileService";
import { colors } from "@/theme/colors";

export default function ProfileScreen() {
  const router = useRouter();
  
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [course, setCourse] = useState("");
  const [year, setYear] = useState("");
  const [avatarUri, setAvatarUri] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
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

    try {
      await saveStudentProfile({ avatarUri, name, studentId, course, year });
      router.back();
    } catch {
      setProfileError("Could not save your profile. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }, [avatarUri, course, name, router, studentId, year]);

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

    try {
      const nextAvatarUri = await importStudentAvatar(asset.uri, avatarUri);
      setAvatarUri(nextAvatarUri);
      await saveStudentProfile({ avatarUri: nextAvatarUri, name, studentId, course, year });
    } catch {
      setProfileError("Could not save the selected avatar.");
    }
  }, [avatarUri, course, name, studentId, year]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.headerArea}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.white} size={24} />
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
              <View style={styles.avatarContainer}>
                <Pressable
                  accessibilityRole="button"
                  disabled={profileLoading || savingProfile}
                  onPress={handlePickAvatar}
                  style={styles.avatarCircle}
                >
                  {avatarUri ? (
                    <Image resizeMode="cover" source={{ uri: avatarUri }} style={styles.avatarImage} />
                  ) : (
                    <UserIcon color={colors.maroon} size={48} />
                  )}
                  <View style={styles.avatarEditBadge}>
                    <ImagePlus color={colors.maroonDark} size={16} />
                  </View>
                </Pressable>
                <Text style={styles.avatarLabel}>
                  {profileLoading ? "Loading profile..." : `Student ID: ${studentId || "Not set"}`}
                </Text>
              </View>

              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Full Name</Text>
                  <View style={styles.inputWrapper}>
                    <UserIcon color={colors.gold} size={18} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your full name"
                      value={name}
                      editable={!profileLoading && !savingProfile}
                      onChangeText={setName}
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Student ID Number</Text>
                  <View style={styles.inputWrapper}>
                    <BookOpen color={colors.gold} size={18} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. TUPM-21-XXXX"
                      value={studentId}
                      editable={!profileLoading && !savingProfile}
                      onChangeText={setStudentId}
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Course / Program</Text>
                  <View style={styles.inputWrapper}>
                    <GraduationCap color={colors.gold} size={18} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. BS in Computer Science"
                      value={course}
                      editable={!profileLoading && !savingProfile}
                      onChangeText={setCourse}
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Year Level</Text>
                  <View style={styles.inputWrapper}>
                    <Calendar color={colors.gold} size={18} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 3rd Year"
                      value={year}
                      editable={!profileLoading && !savingProfile}
                      onChangeText={setYear}
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>
              </View>

              {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}

              <Pressable
                accessibilityRole="button"
                disabled={profileLoading || savingProfile}
                style={[styles.saveButton, profileLoading || savingProfile ? styles.saveButtonDisabled : undefined]}
                onPress={handleSave}
              >
                {savingProfile ? <ActivityIndicator color={colors.white} /> : <Save color={colors.white} size={20} />}
                <Text style={styles.saveButtonText}>{savingProfile ? "Saving..." : "Save Profile"}</Text>
              </Pressable>

              <View style={styles.footerInfo}>
                <Text style={styles.footerText}>
                  Your profile details are stored locally on this device.
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.maroon,
    flex: 1
  },
  headerArea: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 20
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flex: 1,
    overflow: "hidden"
  },
  content: {
    flex: 1
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: 32
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.gold,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 12
  },
  avatarImage: {
    height: "100%",
    width: "100%"
  },
  avatarEditBadge: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderColor: colors.white,
    borderRadius: 16,
    borderWidth: 2,
    bottom: 0,
    height: 32,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 32
  },
  avatarLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600"
  },
  form: {
    gap: 20,
    marginBottom: 32
  },
  inputGroup: {
    gap: 8
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 4
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16
  },
  inputIcon: {
    marginRight: 12
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
    elevation: 4,
    shadowColor: colors.maroon,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  saveButtonDisabled: {
    backgroundColor: colors.grayhawk,
    shadowOpacity: 0
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800"
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
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic"
  }
});
