import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import { Building2, IdCard, ListChecks, Map, MessageCircle, Settings, ShieldCheck, User } from "lucide-react-native";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminUnlockModal } from "@/components/AdminUnlockModal";
import { MascotHeader } from "@/components/MascotHeader";
import { getAdminMode, subscribeAdminMode } from "@/services/adminService";
import { getSeedTriviaItems } from "@/services/triviaService";
import { colors } from "@/theme/colors";

const openingGreeting = "Hi TUPian, Haki here. Kumusta ka today?";

const casualLines = [
  "How's your day so far? Kaya pa ba?",
  "Need help with an office concern? Message mo lang ako.",
  "Random check: may baon ka bang ID today?",
  "Anong campus mission natin today? Registrar? Clinic? Enrollment?",
  "If may school process kang confusing, send mo lang sa Chat.",
  "Hydrate ka muna. Tapos ask mo na yung concern mo."
];

function buildHomeDialogueLines() {
  const triviaLines = getSeedTriviaItems().map((item) => `Did you know? ${item.title}. ${item.body}`);
  return [...casualLines, ...triviaLines];
}

export default function HomeScreen() {
  const router = useRouter();
  const dialogueLines = useMemo(() => buildHomeDialogueLines(), []);
  const [hakiLine, setHakiLine] = useState(openingGreeting);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminMode, setAdminMode] = useState(false);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const nextLine = dialogueLines[Math.floor(Math.random() * dialogueLines.length)] ?? casualLines[0] ?? openingGreeting;
      setHakiLine(nextLine);
    }, 15000);

    return () => clearInterval(intervalId);
  }, [dialogueLines]);

  useEffect(() => {
    let mounted = true;
    void getAdminMode().then((enabled) => {
      if (mounted) {
        setAdminMode(enabled);
      }
    });
    const unsubscribe = subscribeAdminMode((enabled) => {
      setAdminMode(enabled);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const goToChat = useCallback(() => {
    router.push("/chat");
  }, [router]);

  const closeAdminModal = useCallback(() => {
    setShowAdminModal(false);
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

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
        tension: 30,
        useNativeDriver: true
      })
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.headerArea}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Haki Assistant</Text>
            <Text style={styles.headerSubtitle}>Your offline campus guide</Text>
          </View>
          <View style={styles.headerActions}>
            {adminMode ? (
              <Pressable accessibilityLabel="Admin settings" onPress={() => router.push("/settings")} style={styles.profileButton}>
                <View style={styles.profileIconCircle}>
                  <Settings color={colors.white} size={20} />
                </View>
              </Pressable>
            ) : null}
            <Pressable accessibilityLabel="Student profile" onPress={() => router.push("/profile")} style={styles.profileButton}>
              <View style={styles.profileIconCircle}>
                <User color={colors.white} size={20} />
              </View>
            </Pressable>
          </View>
        </View>
        <MascotHeader
          message={hakiLine}
          status="teaching"
          onMascotPress={() => setShowAdminModal(true)}
        />
      </View>
      <View style={styles.sheetContainer}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <View style={styles.greetingHeader}>
              <Text style={styles.dateText}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase()}</Text>
              <Text style={styles.greetingText}>Good day, TUPian!</Text>
            </View>
            <AdminUnlockModal onClose={closeAdminModal} visible={showAdminModal} />

        <View style={styles.dashboard}>
          <View style={styles.quickGrid}>
            <Pressable onPress={goToChat} style={styles.primaryAction}>
              <MessageCircle color={colors.white} size={24} />
              <Text style={styles.primaryActionTitle}>Chat with Haki</Text>
              <Text style={styles.primaryActionText}>Message Haki about enrollment, offices, clinic help, rules, and more.</Text>
            </Pressable>

            <Pressable onPress={() => router.push("/map" as never)} style={styles.secondaryAction}>
              <Map color={colors.maroon} size={23} />
              <Text style={styles.secondaryActionTitle}>Campus Map</Text>
              <Text style={styles.secondaryActionText}>Peek at the map space while Haki builds navigation.</Text>
            </Pressable>
          </View>

          <View style={styles.askCard}>
            <Text style={styles.sectionLabel}>Ask Haki</Text>
            <Text style={styles.sectionTitle}>Things you can message</Text>
            {[
              "How do I request documents from the Registrar?",
              "What should I do if I feel sick on campus?",
              "What are common enrollment requirements?",
              "What are student conduct rules?"
            ].map((question) => (
              <Pressable key={question} onPress={goToChat} style={styles.questionRow}>
                <ShieldCheck color={colors.gold} size={18} />
                <Text style={styles.questionText}>{question}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.reminderCard}>
            <Text style={styles.sectionLabel}>Campus reminder</Text>
            <Text style={styles.sectionTitle}>Before going to an office</Text>
            <Reminder icon={<IdCard color={colors.maroon} size={20} />} text="Bring your student ID or student number." />
            <Reminder icon={<ListChecks color={colors.maroon} size={20} />} text="Prepare the details of your concern before lining up." />
            <Reminder icon={<Building2 color={colors.maroon} size={20} />} text="If unsure, ask where your concern should be routed." />
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  </View>
</SafeAreaView>
  );
}

function Reminder({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.reminderRow}>
      <View style={styles.reminderIcon}>{icon}</View>
      <Text style={styles.reminderText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.maroon,
    flex: 1
  },
  headerArea: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  headerTextWrap: {
    alignItems: "flex-start"
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  profileButton: {
    padding: 4
  },
  profileIconCircle: {
    backgroundColor: "rgba(255,255,255,0.15)",
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)"
  },
  headerTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600"
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flex: 1,
    overflow: "hidden"
  },
  greetingHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 4
  },
  dateText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4
  },
  greetingText: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5
  },
  scroll: {
    flex: 1
  },
  content: {
    paddingBottom: 110
  },
  dashboard: {
    gap: 16,
    padding: 18
  },
  quickGrid: {
    flexDirection: "row",
    gap: 12
  },
  primaryAction: {
    backgroundColor: colors.maroon,
    borderRadius: 20,
    flex: 1,
    gap: 8,
    minHeight: 132,
    padding: 16
  },
  primaryActionTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 23
  },
  primaryActionText: {
    color: colors.maroonSoft,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  secondaryAction: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 132,
    padding: 16
  },
  secondaryActionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 23
  },
  secondaryActionText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  askCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 16
  },
  sectionLabel: {
    color: colors.maroon,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22
  },
  questionRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    padding: 12
  },
  questionText: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19
  },
  reminderCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 11,
    padding: 16
  },
  reminderRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    padding: 12
  },
  reminderIcon: {
    alignItems: "center",
    backgroundColor: colors.maroonSoft,
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  reminderText: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19
  }
});
