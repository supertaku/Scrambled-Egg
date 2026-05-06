import { useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb, Mail, Search, X } from "lucide-react-native";
import { Animated, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";
import { logger } from "@/utils/logger";

interface Tip {
  id: string;
  author: string;
  content: string;
  category: string;
}

const mockTips: Tip[] = [
  {
    id: "t1",
    author: "Senior BSCS Student",
    category: "Enrollment",
    content: "Always bring extra 1x1 and 2x2 ID pictures during enrollment week. You never know when an office will ask for one."
  },
  {
    id: "t2",
    author: "Alumni 2025",
    category: "Registrar",
    content: "The best time to visit the Registrar is between 8:00 AM to 9:00 AM. Lines get super long after lunch break."
  },
  {
    id: "t3",
    author: "TUP Confessions",
    category: "Survival",
    content: "If you need cheap and fast printing, go to the stalls right outside the main gate. They offer bulk printing discounts."
  },
  {
    id: "t4",
    author: "Student Council",
    category: "Facilities",
    content: "The library is air-conditioned and perfect for studying during vacant hours, but it fills up fast. Reserve a seat early!"
  }
];

export default function TipsScreen() {
  const [query, setQuery] = useState("");
  const filteredTips = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return mockTips;

    return mockTips.filter((tip) =>
      [tip.author, tip.category, tip.content].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [query]);

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
        <Text style={styles.headerTitle}>Tips</Text>
      </View>
      <View style={styles.sheetContainer}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <View style={styles.section}>
          <View style={styles.headerTitleRow}>
            <Lightbulb color={colors.maroon} size={22} />
            <Text style={styles.sectionTitle}>Student Advice</Text>
          </View>
          <Text style={styles.sectionDesc}>Real advice from real TUPians.</Text>

          <View style={styles.searchBox}>
            <Search color={colors.muted} size={18} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search tips, categories, or authors"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
            />
            {query ? (
              <Pressable accessibilityLabel="Clear search" onPress={() => setQuery("")} style={styles.clearButton}>
                <X color={colors.muted} size={18} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.tipsList}>
            {filteredTips.map((tip) => (
              <View key={tip.id} style={styles.tipCard}>
                <View style={styles.tipHeader}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{tip.category}</Text>
                  </View>
                  <Text style={styles.authorText}>from {tip.author}</Text>
                </View>
                <Text style={styles.tipContent}>"{tip.content}"</Text>
              </View>
            ))}
            {filteredTips.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No tips found</Text>
                <Text style={styles.emptyText}>Try searching for enrollment, registrar, printing, or library.</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.actionSection}>
          <View style={styles.actionCard}>
            <Text style={styles.actionTitle}>Have your own advice?</Text>
            <Text style={styles.actionDesc}>Help other students by sharing your campus life hacks. Your tip might be featured in the next update!</Text>
            
            <Pressable style={styles.emailButton} onPress={handleEmailAdmin}>
              <Mail color={colors.white} size={18} />
              <Text style={styles.emailButtonText}>Send your own advice</Text>
            </Pressable>
          </View>
        </View>

        </ScrollView>
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
    fontWeight: "900"
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flex: 1,
    overflow: "hidden"
  },
  scroll: {
    flex: 1
  },
  content: {
    backgroundColor: colors.surface,
    gap: 24,
    paddingTop: 24,
    paddingBottom: 110
  },
  section: {
    paddingHorizontal: 18,
    gap: 8
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900"
  },
  sectionDesc: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8
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
    paddingHorizontal: 12
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: 10
  },
  clearButton: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32
  },
  tipsList: {
    gap: 16
  },
  tipCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 12
  },
  tipHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  categoryBadge: {
    backgroundColor: colors.maroonSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  categoryText: {
    color: colors.maroonDark,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  authorText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  tipContent: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    fontStyle: "italic"
  },
  emptyState: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 5,
    padding: 16
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
    paddingHorizontal: 18,
    marginTop: 8
  },
  actionCard: {
    backgroundColor: colors.maroonSoft,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    alignItems: "center",
    borderColor: "#E8C7D0",
    borderWidth: 1
  },
  actionTitle: {
    color: colors.maroonDark,
    fontSize: 18,
    fontWeight: "900"
  },
  actionDesc: {
    color: colors.maroon,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 8,
    fontWeight: "600"
  },
  emailButton: {
    backgroundColor: colors.maroon,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    width: "100%"
  },
  emailButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800"
  }
});
