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
  Utensils,
  X
} from "lucide-react-native";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminUnlockModal } from "@/components/AdminUnlockModal";
import { MascotHeader } from "@/components/MascotHeader";
import { getAdminMode, subscribeAdminMode } from "@/services/adminService";
import { getSeedTriviaItems } from "@/services/triviaService";
import { colors } from "@/theme/colors";

const { height: SCREEN_H } = Dimensions.get("window");

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

const SAMPLE_QUESTIONS = [
  "How do I file a complaint?",
  "How do I request a good moral character?",
  "What should I do if I feel sick on campus?",
  "What should I do if I lose my ID?"
];

const REMINDERS = [
  { icon: <IdCard color={colors.maroon} size={20} />, text: "Bring your student ID or student number." },
  { icon: <ListChecks color={colors.maroon} size={20} />, text: "Prepare the details of your concern before lining up." },
  { icon: <Building2 color={colors.maroon} size={20} />, text: "If unsure, ask where your concern should be routed." }
];

const FAB_MENU = [
  {
    label: "Food & Canteen",
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

function FabMenu({ visible, onClose, onNavigate }: {
  visible: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
}) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(sheetTranslateY, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, { toValue: 300, duration: 200, useNativeDriver: true })
      ]).start();
    }
  }, [visible, backdropOpacity, sheetTranslateY]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.fabSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
        <View style={styles.fabSheetHandle} />
        <View style={styles.fabSheetHeader}>
          <Text style={styles.fabSheetTitle}>More Features</Text>
          <Pressable onPress={onClose} style={styles.fabSheetClose}>
            <X color={colors.muted} size={20} />
          </Pressable>
        </View>
        <View style={styles.fabMenuItems}>
          {FAB_MENU.map((item) => (
            <FabMenuItem
              key={item.route}
              icon={item.icon}
              label={item.label}
              onPress={() => {
                onClose();
                setTimeout(() => onNavigate(item.route), 150);
              }}
            />
          ))}
        </View>
      </Animated.View>
    </Modal>
  );
}

function FabMenuItem({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, friction: 6, tension: 200 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[styles.fabMenuItem, { transform: [{ scale }] }]}>
        <View style={styles.fabMenuIcon}>{icon}</View>
        <Text style={styles.fabMenuLabel}>{label}</Text>
        <ChevronRight color={colors.muted} size={18} />
      </Animated.View>
    </Pressable>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const dialogueLines = useMemo(() => buildHomeDialogueLines(), []);
  const [hakiLine, setHakiLine] = useState(openingGreeting);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);

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
            <Text style={styles.headerSubtitle}>Your offline campus guide</Text>
          </View>
          <View style={styles.headerActions}>
            {adminMode ? (
              <Pressable accessibilityLabel="Admin settings" onPress={() => router.push("/settings")} style={styles.profileButton}>
                <View style={styles.profileIconCircle}>
                  <Settings color={colors.white} size={18} />
                </View>
              </Pressable>
            ) : null}
            <Pressable accessibilityLabel="Student profile" onPress={() => router.push("/profile")} style={styles.profileButton}>
              <View style={styles.profileIconCircle}>
                <User color={colors.white} size={18} />
              </View>
            </Pressable>
          </View>
        </Animated.View>
        <MascotHeader
          message={hakiLine}
          status="teaching"
          onMascotPress={() => setShowAdminModal(true)}
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
                <Text style={styles.secondaryActionText}>Peek at the map space while Haki builds navigation.</Text>
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

      {/* FAB menu bottom sheet */}
      <FabMenu
        visible={showFabMenu}
        onClose={handleFabClose}
        onNavigate={(route) => router.push(route as never)}
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
    right: 22
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

  // FAB Menu sheet
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)"
  },
  fabSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20
  },
  fabSheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4
  },
  fabSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14
  },
  fabSheetTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  fabSheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  fabMenuItems: { paddingHorizontal: 16, gap: 10 },
  fabMenuItem: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 16
  },
  fabMenuIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.maroonSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  fabMenuLabel: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: "800" }
});
