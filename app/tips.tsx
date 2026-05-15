import { useEffect, useMemo, useRef } from "react";
import { Lightbulb, Mail, Search, X } from "lucide-react-native";
import { Animated, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { studentTips, type StudentTip } from "@/data/studentTips";
import { colors } from "@/theme/colors";
import { useDebouncedQuery } from "@/hooks/useDebouncedQuery";
import { logger } from "@/utils/logger";

// Category accent colors
const CATEGORY_COLORS: Record<string, string> = {
  Printing: "#2E7DB2",
  Documents: "#D4860A",
  Enrollment: "#147A3D",
  Routine: "#6B5FB5",
  Study: "#0C7BB3",
  Clearance: colors.maroon,
  Food: "#C45A1B",
  Files: "#9A6700",
  Time: "#586474",
  Review: "#147A3D",
  Teamwork: "#2E7DB2",
  "Campus Life": colors.maroon
};

export default function TipsScreen() {
  const { clearQuery, debouncedQuery, query, setQuery } = useDebouncedQuery();
  const filteredTips = useMemo(() => {
    const normalized = debouncedQuery.trim().toLowerCase();
    if (!normalized) return studentTips;

    return (studentTips as StudentTip[]).filter((tip) =>
      [tip.author, tip.category, tip.content].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [debouncedQuery]);

  const handleEmailAdmin = async () => {
    const email = "admin@tup.edu.ph";
    const subject = "TUP Wiki: New Tip/Trick Submission";
    const body = "Hi Admin,\n\nI would like to share a tip for the TUP Wiki app:\n\n[Write your tip here]\n\nRegards,\n[Your Name/Course]";

    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      logger.ui.error("Error opening email client", { error: error instanceof Error ? error.message : String(error) });
    }
  };

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 340,
        useNativeDriver: true
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 9,
        tension: 50,
        useNativeDriver: true
      })
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.headerArea}>
        <Text style={styles.headerTitle}>Tips</Text>
      </View>
      <View style={styles.sheetContainer}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

            <View style={styles.section}>
              <View style={styles.headerTitleRow}>
                <View style={styles.sectionIconBg}>
                  <Lightbulb color={colors.maroon} size={20} />
                </View>
                <View>
                  <Text style={styles.sectionLabel}>From students</Text>
                  <Text style={styles.sectionTitle}>Tips & Tricks</Text>
                </View>
              </View>
              <Text style={styles.sectionDesc}>Peer-style tips from student experience. Details can change, so verify before relying on a tip.</Text>

              <View style={styles.searchBox}>
                <Search color={colors.mutedLight} size={17} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search tips, categories, or authors"
                  placeholderTextColor={colors.mutedLight}
                  style={styles.searchInput}
                />
                {query ? (
                  <Pressable accessibilityLabel="Clear search" onPress={clearQuery} style={styles.clearButton}>
                    <X color={colors.muted} size={16} />
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.tipsList}>
                {filteredTips.map((tip, index) => (
                  <TipCard key={tip.id} tip={tip} index={index} />
                ))}
                {filteredTips.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No tips found</Text>
                    <Text style={styles.emptyText}>Try searching for documents, enrollment, study, files, or time.</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.actionSection}>
              <View style={styles.actionCard}>
                <View style={styles.actionIconRow}>
                  <Mail color={colors.maroon} size={20} />
                  <Text style={styles.actionTitle}>Got a student tip?</Text>
                </View>
                <Text style={styles.actionDesc}>Send a short peer tip for review before it becomes part of this screen.</Text>

                <SubmitButton onPress={handleEmailAdmin} />
              </View>
            </View>

          </ScrollView>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function TipCard({ tip, index }: { tip: StudentTip; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 70, useNativeDriver: true })
      ]).start();
    }, index * 50);
    return () => clearTimeout(timer);
  }, [index, fadeAnim, slideAnim]);

  const accentColor = CATEGORY_COLORS[tip.category] ?? colors.maroon;

  return (
    <Animated.View
      style={[
        styles.tipCard,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}
    >
      <View style={[styles.tipAccentBar, { backgroundColor: accentColor }]} />
      <View style={styles.tipBody}>
        <View style={styles.tipHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}30` }]}>
            <Text style={[styles.categoryText, { color: accentColor }]}>{tip.category}</Text>
          </View>
          <Text style={styles.authorText}>{tip.author}</Text>
        </View>
        <Text style={styles.tipContent}>{tip.content}</Text>
      </View>
    </Animated.View>
  );
}

function SubmitButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 6, tension: 200 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();

  return (
    <Pressable style={styles.emailButton} onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[styles.emailButtonInner, { transform: [{ scale }] }]}>
        <Mail color={colors.white} size={17} />
        <Text style={styles.emailButtonText}>Send your own advice</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.maroon,
    flex: 1
  },
  headerArea: {
    alignItems: "center",
    backgroundColor: colors.maroon,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12
  },
  headerTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    flex: 1,
    overflow: "hidden"
  },
  scroll: {
    flex: 1
  },
  content: {
    backgroundColor: colors.surface,
    gap: 20,
    paddingTop: 24,
    paddingBottom: 114
  },
  section: {
    paddingHorizontal: 18,
    gap: 12
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  sectionIconBg: {
    backgroundColor: colors.maroonSoft,
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  sectionLabel: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3
  },
  sectionDesc: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 13,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 10
  },
  clearButton: {
    alignItems: "center",
    height: 30,
    justifyContent: "center",
    width: 30
  },
  tipsList: {
    gap: 12
  },
  tipCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1
  },
  tipAccentBar: {
    width: 4,
    flexShrink: 0
  },
  tipBody: {
    flex: 1,
    padding: 16,
    gap: 10
  },
  tipHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  categoryBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3
  },
  authorText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  tipContent: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500"
  },
  emptyState: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 5,
    padding: 18
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  },
  actionSection: {
    paddingHorizontal: 18
  },
  actionCard: {
    backgroundColor: colors.maroonSoft,
    borderRadius: 22,
    padding: 20,
    gap: 10,
    borderColor: "#E8C7D0",
    borderWidth: 1
  },
  actionIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  actionTitle: {
    color: colors.maroonDark,
    fontSize: 17,
    fontWeight: "900"
  },
  actionDesc: {
    color: colors.maroon,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500"
  },
  emailButton: {
    marginTop: 4
  },
  emailButtonInner: {
    backgroundColor: colors.maroon,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowColor: colors.maroon,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4
  },
  emailButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800"
  }
});
