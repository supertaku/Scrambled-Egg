import { useEffect, useRef } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  BookOpen,
  Building,
  CheckCircle,
  Hash,
  Info,
  MapPin,
  Phone,
  Shield,
  Zap
} from "lucide-react-native";

import { getTopicById } from "@/data/libraryTopics";
import { colors } from "@/theme/colors";

// ─── Category config (same as list screen) ───────────────────────────────────

interface CatConfig {
  bg: string;
  border: string;
  text: string;
  icon: typeof BookOpen;
}

const CATEGORY_CONFIG: Record<string, CatConfig> = {
  "Student Services":  { bg: "#E8F5E9", border: "#A5D6A7", text: "#2E7D32", icon: Shield },
  "Campus Safety":     { bg: "#FFF3E0", border: "#FFCC80", text: "#E65100", icon: Zap },
  "Student Welfare":   { bg: "#E3F2FD", border: "#90CAF9", text: "#1565C0", icon: Info },
  "Campus Guidelines": { bg: colors.maroonSoft, border: "#E8C7D0", text: colors.maroon, icon: BookOpen }
};
const DEFAULT_CAT: CatConfig = { bg: colors.surface, border: colors.border, text: colors.muted, icon: BookOpen };

function getCat(category: string): CatConfig {
  return CATEGORY_CONFIG[category] ?? DEFAULT_CAT;
}

// ─── Parse contact info into structured lines ─────────────────────────────────

interface ContactEntry { label: string; value: string }

function parseContactInfo(raw: string): ContactEntry[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const colonIdx = line.indexOf(":");
      if (colonIdx !== -1) {
        return { label: line.slice(0, colonIdx).trim(), value: line.slice(colonIdx + 1).trim() };
      }
      return { label: "Contact", value: line };
    });
}

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({ step, index }: { step: string; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true })
      ]).start();
    }, 80 + index * 70);
    return () => clearTimeout(timer);
  }, [index, fadeAnim, slideAnim]);

  // Split "Title: Body" if present
  const colonIdx = step.indexOf(":");
  const hasTitle = colonIdx > 0 && colonIdx < 60;
  const stepLabel = hasTitle ? step.slice(0, colonIdx).trim() : null;
  const stepBody = hasTitle ? step.slice(colonIdx + 1).trim() : step;

  return (
    <Animated.View
      style={[styles.stepCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
    >
      {/* Step number bubble */}
      <View style={styles.stepNumCircle}>
        <Text style={styles.stepNumText}>{index + 1}</Text>
      </View>

      <View style={styles.stepContent}>
        {stepLabel ? (
          <Text style={styles.stepLabel}>{stepLabel}</Text>
        ) : null}
        <Text style={styles.stepBody}>{stepBody}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Main detail screen ───────────────────────────────────────────────────────

export default function LibraryTopicScreen() {
  const { chunkId } = useLocalSearchParams<{ chunkId: string }>();
  const router = useRouter();
  const topic = getTopicById(chunkId ?? "");

  // Entry animations
  const headerFade = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(headerFade, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(contentFade, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.spring(contentSlide, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true })
      ])
    ]).start();
  }, [headerFade, contentFade, contentSlide]);

  if (!topic) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.headerArea}>
          <BackButton onPress={() => router.back()} />
          <View style={{ flex: 1 }} />
        </View>
        <View style={styles.sheetContainer}>
          <View style={styles.notFound}>
            <BookOpen color={colors.mutedLight} size={40} />
            <Text style={styles.notFoundTitle}>Topic not found</Text>
            <Text style={styles.notFoundText}>This topic could not be loaded from the library.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const cat = getCat(topic.category);
  const CatIcon = cat.icon;
  const contacts = parseContactInfo(topic.contactInfo);
  const hasSteps = topic.steps.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Maroon header */}
      <Animated.View style={[styles.headerArea, { opacity: headerFade }]}>
        <BackButton onPress={() => router.back()} />
        <View style={styles.headerCenter}>
          <Text style={styles.headerBreadcrumb} numberOfLines={1}>{topic.documentTitle}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </Animated.View>

      {/* White sheet */}
      <View style={styles.sheetContainer}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={{ opacity: contentFade, transform: [{ translateY: contentSlide }] }}
        >
          {/* Hero card */}
          <View style={styles.heroCard}>
            {/* Category badge */}
            <View style={[styles.catBadge, { backgroundColor: cat.bg, borderColor: cat.border }]}>
              <CatIcon color={cat.text} size={12} />
              <Text style={[styles.catBadgeText, { color: cat.text }]}>{topic.category}</Text>
            </View>

            {/* Title */}
            <Text style={styles.topicTitle}>{topic.sectionTitle}</Text>

            {/* Meta row */}
            <View style={styles.metaGrid}>
              {topic.officeLocation ? (
                <View style={styles.metaItem}>
                  <MapPin color={colors.maroon} size={14} />
                  <Text style={styles.metaText}>{topic.officeLocation}</Text>
                </View>
              ) : topic.office ? (
                <View style={styles.metaItem}>
                  <Building color={colors.maroon} size={14} />
                  <Text style={styles.metaText}>{topic.office}</Text>
                </View>
              ) : null}

              {hasSteps ? (
                <View style={styles.metaItem}>
                  <Hash color={colors.gold} size={14} />
                  <Text style={[styles.metaText, { color: colors.gold }]}>
                    {topic.steps.length} step{topic.steps.length !== 1 ? "s" : ""}
                  </Text>
                </View>
              ) : null}

              {topic.lastUpdated ? (
                <View style={styles.metaItem}>
                  <CheckCircle color={colors.success} size={14} />
                  <Text style={[styles.metaText, { color: colors.success }]}>Updated {topic.lastUpdated}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Summary / answer */}
          {topic.answer ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Summary</Text>
              <Text style={styles.summaryText}>{topic.answer}</Text>
            </View>
          ) : null}

          {/* Steps */}
          {hasSteps ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderDot} />
                <Text style={styles.sectionTitle}>Step-by-Step Procedure</Text>
              </View>
              <View style={styles.stepsList}>
                {topic.steps.map((step, i) => (
                  <StepCard key={i} step={step} index={i} />
                ))}
              </View>
            </View>
          ) : (
            /* Full content for non-step entries */
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderDot} />
                <Text style={styles.sectionTitle}>Details</Text>
              </View>
              <View style={styles.contentCard}>
                <Text style={styles.contentText}>{topic.content}</Text>
              </View>
            </View>
          )}

          {/* Contact info */}
          {contacts.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionHeaderDot, { backgroundColor: colors.gold }]} />
                <Text style={styles.sectionTitle}>Contact Information</Text>
              </View>
              <View style={styles.contactCard}>
                {contacts.map((entry, i) => (
                  <View key={i} style={[styles.contactRow, i > 0 && styles.contactRowBorder]}>
                    <Phone color={colors.maroon} size={14} />
                    <View style={styles.contactRowText}>
                      <Text style={styles.contactLabel}>{entry.label}</Text>
                      <Text style={styles.contactValue}>{entry.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Source footer */}
          <View style={styles.sourceFooter}>
            <BookOpen color={colors.mutedLight} size={13} />
            <Text style={styles.sourceText}>
              Source: {topic.documentTitle}
            </Text>
          </View>
        </Animated.ScrollView>
      </View>
    </SafeAreaView>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, friction: 6, tension: 200 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();

  return (
    <Pressable
      accessibilityLabel="Back to Library"
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.backBtn, { transform: [{ scale }] }]}>
        <ArrowLeft color={colors.white} size={20} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.maroon, flex: 1 },

  headerArea: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 54,
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 10
  },
  backBtn: {
    alignItems: "center",
    backgroundColor: colors.overlayMedium,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerBreadcrumb: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  },
  headerSpacer: { width: 40 },

  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    flex: 1,
    overflow: "hidden"
  },

  scrollContent: {
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 120
  },

  // Hero card
  heroCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3
  },
  catBadge: {
    alignSelf: "flex-start",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  catBadgeText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  topicTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
    lineHeight: 26
  },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: colors.muted, fontSize: 12, fontWeight: "700" },

  // Summary
  summaryCard: {
    backgroundColor: colors.goldSoft,
    borderColor: "#E8D98B",
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 16
  },
  summaryLabel: {
    color: colors.maroonDark,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  summaryText: { color: colors.ink, fontSize: 14, fontWeight: "500", lineHeight: 21 },

  // Sections
  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionHeaderDot: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: colors.maroon
  },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "900", letterSpacing: -0.2 },

  // Steps
  stepsList: { gap: 10 },
  stepCard: {
    alignItems: "flex-start",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  stepNumCircle: {
    alignItems: "center",
    backgroundColor: colors.maroon,
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    minWidth: 28,
    flexShrink: 0,
    marginTop: 2
  },
  stepNumText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  stepContent: { flex: 1, gap: 4 },
  stepLabel: { color: colors.maroon, fontSize: 13, fontWeight: "900" },
  stepBody: { color: colors.ink, fontSize: 13, fontWeight: "500", lineHeight: 20 },

  // Content (non-step)
  contentCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16
  },
  contentText: { color: colors.ink, fontSize: 14, fontWeight: "500", lineHeight: 22 },

  // Contact
  contactCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden"
  },
  contactRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14 },
  contactRowBorder: { borderTopColor: colors.border, borderTopWidth: 1 },
  contactRowText: { flex: 1, gap: 2 },
  contactLabel: { color: colors.maroon, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  contactValue: { color: colors.ink, fontSize: 13, fontWeight: "600", lineHeight: 18 },

  // Source footer
  sourceFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingTop: 4
  },
  sourceText: { color: colors.mutedLight, fontSize: 11, fontWeight: "600", fontStyle: "italic" },

  // Not found
  notFound: { alignItems: "center", flex: 1, gap: 10, justifyContent: "center", paddingHorizontal: 30 },
  notFoundTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  notFoundText: { color: colors.muted, fontSize: 14, fontWeight: "500", lineHeight: 20, textAlign: "center" }
});
