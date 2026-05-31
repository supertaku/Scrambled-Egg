import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import {
  Building2,
  ChevronRight,
  IdCard,
  ListChecks,
  Map,
  MessageCircle,
  Plus,
  Settings,
  ShieldCheck,
  User,
  Utensils
} from "lucide-react-native";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminUnlockModal } from "@/components/AdminUnlockModal";
import { MascotHeader } from "@/components/MascotHeader";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { getAdminMode, subscribeAdminMode } from "@/services/adminService";
import { getSeedTriviaItems } from "@/services/triviaService";
import { colors } from "@/theme/colors";

interface HomeDialogueLine {
  isTrivia: boolean;
  text: string;
}

const openingGreeting: HomeDialogueLine = {
  isTrivia: false,
  text: "Hi TUPian, Haki here. How can I help today?"
};

const casualLines = [
  "How is your day so far?",
  "Need help with an office concern? Send me a message.",
  "Quick check: did you bring your student ID today?",
  "What is your campus task today: Registrar, Clinic, or enrollment?",
  "If a school process is confusing, ask me in Chat.",
  "Take a water break, then tell me what you need."
];

function buildHomeDialogueLines(): HomeDialogueLine[] {
  const standardLines = casualLines.map((text) => ({ isTrivia: false, text }));
  const triviaLines = getSeedTriviaItems().map((item) => ({ isTrivia: true, text: item.body }));
  return [...standardLines, ...triviaLines];
}

const SAMPLE_QUESTIONS = [
  "How do I file a complaint?",
  "How do I request a good moral character?",
  "What should I do if I feel sick on campus?",
  "What should I do if I lose my ID?"
];

const REMINDERS = [
  { icon: <IdCard color={colors.maroon} size={20} />, text: "Bring your student ID or student number." },
  { icon: <ListChecks color={colors.maroon} size={20} />, text: "Prepare the details of your concern before lining up." },
  { icon: <Building2 color={colors.maroon} size={20} />, text: "If unsure, ask which office can help." }
];

const FAB_MENU = [
  {
    label: "Food",
    icon: <Utensils color={colors.maroon} size={20} />,
    route: "/canteen" as const
  },
  {
    label: "Org Chart",
    icon: <Building2 color={colors.maroon} size={20} />,
    route: "/org-chart" as const
  }
];

// ─── Animated staggered card ────────────────────────────────────────────────

function AnimatedCard({ children, delay, style }: { children: ReactNode; delay: number; style?: object }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(22)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true })
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, fadeAnim, slideAnim]);

  return (
    <Animated.View style={[style, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {children}
    </Animated.View>
  );
}

function PressableCard({
  onPress,
  style,
  children
}: {
  onPress: () => void;
  style: object;
  children: ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 6, tension: 200 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ─── FAB menu modal ─────────────────────────────────────────────────────────

function FabActionTray({ visible, onClose, onNavigate, reducedMotion }: {
  visible: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
  reducedMotion: boolean;
}) {
  const [rendered, setRendered] = useState(visible);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      opacity.setValue(reducedMotion ? 1 : 0);
      translateY.setValue(reducedMotion ? 0 : 10);
      if (!reducedMotion) {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: 0, friction: 8, tension: 115, useNativeDriver: true })
        ]).start();
      }
    } else if (reducedMotion) {
      setRendered(false);
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 8, duration: 120, useNativeDriver: true })
      ]).start(() => setRendered(false));
    }
  }, [opacity, reducedMotion, translateY, visible]);

  if (!rendered) return null;

  return (
    <>
      <Pressable accessibilityLabel="Close quick actions" onPress={onClose} style={styles.trayDismiss} />
      <Animated.View style={[styles.actionTray, { opacity, transform: [{ translateY }] }]}>
        {FAB_MENU.map((item) => (
          <TrayAction
            key={item.route}
            icon={item.icon}
            label={item.label}
            onPress={() => {
              onClose();
              onNavigate(item.route);
            }}
          />
        ))}
      </Animated.View>
    </>
  );
}

function TrayAction({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, friction: 6, tension: 200 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[styles.trayAction, { transform: [{ scale }] }]}>
        <View style={styles.trayIcon}>{icon}</View>
        <Text style={styles.trayLabel}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const dialogueLines = useMemo(() => buildHomeDialogueLines(), []);
  const [hakiLine, setHakiLine] = useState(openingGreeting);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const nextLine = dialogueLines[Math.floor(Math.random() * dialogueLines.length)] ??
        { isTrivia: false, text: casualLines[0] ?? openingGreeting.text };
      setHakiLine(nextLine);
    }, 15000);
    return () => clearInterval(intervalId);
  }, [dialogueLines]);

  useEffect(() => {
    let mounted = true;
    void getAdminMode().then((enabled) => {
      if (mounted) setAdminMode(enabled);
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

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-12)).current;

  // FAB rotation animation
  const fabRotate = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 340, useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, friction: 9, tension: 50, useNativeDriver: true })
    ]).start();
  }, [headerFade, headerSlide]);

  const handleFabPress = () => {
    const opening = !showFabMenu;
    setShowFabMenu(opening);
    Animated.parallel([
      Animated.spring(fabRotate, {
        toValue: opening ? 1 : 0,
        useNativeDriver: true,
        friction: 7,
        tension: 120
      }),
      Animated.spring(fabScale, {
        toValue: opening ? 0.92 : 1,
        useNativeDriver: true,
        friction: 7,
        tension: 140
      })
    ]).start();
  };

  const handleFabClose = () => {
    setShowFabMenu(false);
    Animated.parallel([
      Animated.spring(fabRotate, { toValue: 0, useNativeDriver: true, friction: 7, tension: 120 }),
      Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 140 })
    ]).start();
  };

  const fabRotateDeg = fabRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"]
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.headerArea}>
        <Animated.View style={[styles.headerTopRow, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Haki Assistant</Text>
            <Text style={styles.headerSubtitle}>Your campus guide, ready anytime</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityLabel="App settings" onPress={() => router.push("/settings")} style={styles.profileButton}>
              <View style={styles.profileIconCircle}>
                <Settings color={colors.white} size={18} />
              </View>
            </Pressable>
            <Pressable accessibilityLabel="Student profile" onPress={() => router.push("/profile")} style={styles.profileButton}>
              <View style={styles.profileIconCircle}>
                <User color={colors.white} size={18} />
              </View>
            </Pressable>
          </View>
        </Animated.View>
        <MascotHeader
          isTrivia={hakiLine.isTrivia}
          message={hakiLine.text}
          status="teaching"
          onMascotPress={() => setShowAdminModal(true)}
          useSpriteSheet
        />
      </View>

      <View style={styles.sheetContainer}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <AnimatedCard delay={60}>
            <View style={styles.greetingHeader}>
              <Text style={styles.dateText}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase()}
              </Text>
              <Text style={styles.greetingText}>Good day, TUPian!</Text>
            </View>
          </AnimatedCard>

          <AdminUnlockModal onClose={closeAdminModal} visible={showAdminModal} />

          <View style={styles.dashboard}>
            <AnimatedCard delay={100} style={styles.quickGrid}>
              <PressableCard onPress={goToChat} style={styles.primaryAction}>
                <View style={styles.primaryActionIcon}>
                  <MessageCircle color={colors.white} size={22} />
                </View>
                <Text style={styles.primaryActionTitle}>Chat with Haki</Text>
                <Text style={styles.primaryActionText}>Message Haki about enrollment, offices, clinic help, rules, and more.</Text>
              </PressableCard>

              <PressableCard onPress={() => router.push("/map" as never)} style={styles.secondaryAction}>
                <View style={styles.secondaryActionIcon}>
                  <Map color={colors.maroon} size={22} />
                </View>
                <Text style={styles.secondaryActionTitle}>Campus Map</Text>
                <Text style={styles.secondaryActionText}>Explore the campus map and find buildings.</Text>
              </PressableCard>
            </AnimatedCard>

            <AnimatedCard delay={180}>
              <View style={styles.card}>
                <View style={styles.cardLabelRow}>
                  <ShieldCheck color={colors.maroon} size={14} />
                  <Text style={styles.sectionLabel}>Ask Haki</Text>
                </View>
                <Text style={styles.sectionTitle}>Things you can message</Text>
                <View style={styles.questionList}>
                  {SAMPLE_QUESTIONS.map((question) => (
                    <QuestionRow key={question} question={question} onPress={goToChat} />
                  ))}
                </View>
              </View>
            </AnimatedCard>

            <AnimatedCard delay={260}>
              <View style={styles.card}>
                <View style={styles.cardLabelRow}>
                  <Building2 color={colors.maroon} size={14} />
                  <Text style={styles.sectionLabel}>Campus reminder</Text>
                </View>
                <Text style={styles.sectionTitle}>Before going to an office</Text>
                <View style={styles.reminderList}>
                  {REMINDERS.map((reminder, i) => (
                    <Reminder key={i} icon={reminder.icon} text={reminder.text} />
                  ))}
                </View>
              </View>
            </AnimatedCard>
          </View>
        </ScrollView>

        {/* Floating Action Button */}
        <Pressable
          accessibilityLabel="Open more features"
          accessibilityRole="button"
          onPress={handleFabPress}
          style={styles.fabWrap}
        >
          <Animated.View style={[styles.fab, { transform: [{ scale: fabScale }] }]}>
            <Animated.View style={{ transform: [{ rotate: fabRotateDeg }] }}>
              <Plus color={colors.white} size={26} strokeWidth={2.5} />
            </Animated.View>
          </Animated.View>
        </Pressable>
      </View>

      <FabActionTray
        visible={showFabMenu}
        onClose={handleFabClose}
        onNavigate={(route) => router.push(route as never)}
        reducedMotion={reducedMotion}
      />
    </SafeAreaView>
  );
}

function QuestionRow({ question, onPress }: { question: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 7, tension: 200 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[styles.questionRow, { transform: [{ scale }] }]}>
        <Text style={styles.questionText}>{question}</Text>
        <ChevronRight color={colors.maroon} size={16} />
      </Animated.View>
    </Pressable>
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
  safeArea: { backgroundColor: colors.maroon, flex: 1 },
  headerArea: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  headerTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  headerTextWrap: { alignItems: "flex-start" },
  headerActions: { alignItems: "center", flexDirection: "row", gap: 8 },
  profileButton: { padding: 4 },
  profileIconCircle: {
    backgroundColor: colors.overlayMedium,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)"
  },
  headerTitle: { color: colors.white, fontSize: 21, fontWeight: "900", letterSpacing: -0.5 },
  headerSubtitle: { color: "rgba(255,255,255,0.62)", fontSize: 12, fontWeight: "600", letterSpacing: 0.2 },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    flex: 1,
    overflow: "hidden"
  },
  greetingHeader: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 2 },
  dateText: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginBottom: 4 },
  greetingText: { color: colors.ink, fontSize: 27, fontWeight: "900", letterSpacing: -0.6 },
  scroll: { flex: 1 },
  content: { paddingBottom: 120 },
  dashboard: { gap: 14, padding: 16, paddingTop: 12 },
  quickGrid: { flexDirection: "row", gap: 12 },
  primaryAction: {
    backgroundColor: colors.maroon,
    borderRadius: 22,
    flex: 1,
    gap: 10,
    minHeight: 140,
    padding: 16,
    shadowColor: colors.maroon,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8
  },
  primaryActionIcon: {
    backgroundColor: "rgba(255,255,255,0.18)",
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryActionTitle: { color: colors.white, fontSize: 17, fontWeight: "900", lineHeight: 22, letterSpacing: -0.3 },
  primaryActionText: { color: "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: "600", lineHeight: 17 },
  secondaryAction: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    gap: 10,
    minHeight: 140,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2
  },
  secondaryActionIcon: {
    backgroundColor: colors.maroonSoft,
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryActionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", lineHeight: 22, letterSpacing: -0.3 },
  secondaryActionText: { color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  cardLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  sectionLabel: { color: colors.maroon, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", lineHeight: 22, letterSpacing: -0.3, marginTop: -4 },
  questionList: { gap: 8 },
  questionRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    padding: 13
  },
  questionText: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: "700", lineHeight: 19 },
  reminderList: { gap: 10 },
  reminderRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    gap: 12,
    padding: 12
  },
  reminderIcon: {
    alignItems: "center",
    backgroundColor: colors.maroonSoft,
    borderRadius: 11,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  reminderText: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },

  // FAB
  fabWrap: {
    position: "absolute",
    bottom: 96,
    right: 22,
    zIndex: 52,
    elevation: 52
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.maroon,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.maroon,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10
  },

  trayDismiss: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30
  },
  actionTray: {
    position: "absolute",
    bottom: 164,
    gap: 9,
    right: 22,
    zIndex: 44,
    elevation: 44
  },
  trayAction: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 48,
    paddingHorizontal: 11,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8
  },
  trayIcon: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: colors.maroonSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  trayLabel: { color: colors.ink, fontSize: 14, fontWeight: "800", minWidth: 68 }
});
