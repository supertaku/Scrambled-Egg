import { useEffect, useMemo, useRef } from "react";
import { Lightbulb, Mail, Search, X } from "lucide-react-native";
import { Animated, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";
import { useDebouncedQuery } from "@/hooks/useDebouncedQuery";
import { logger } from "@/utils/logger";

interface Tip {
  id: string;
  author: string;
  content: string;
  category: string;
}

const studentTips: Tip[] = [
  {
    id: "student-tip-1",
    author: "2nd year student",
    category: "Documents",
    content: "Keep a clear screenshot or PDF copy of your COR, student number, and receipts in one phone album before going to any office."
  },
  {
    id: "student-tip-2",
    author: "Irregular student",
    category: "Enrollment",
    content: "Before asking about subjects, write your exact program, year level, section, and the subject code so the adviser can route you faster."
  },
  {
    id: "student-tip-3",
    author: "Class rep",
    category: "Communication",
    content: "When messaging an office or instructor, put your student number, full name, program, and short concern in the first message."
  },
  {
    id: "student-tip-4",
    author: "Lab buddy",
    category: "Study",
    content: "After class, write three tiny notes: what was discussed, what confused you, and what to ask next meeting."
  },
  {
    id: "student-tip-5",
    author: "Commuter student",
    category: "Routine",
    content: "Pack your ID, pen, small notebook, charger, and water before leaving. The pen saves you more often than you think."
  },
  {
    id: "student-tip-6",
    author: "Graduating student",
    category: "Clearance",
    content: "Do not wait for the last week to check requirements. Ask early, list every missing item, and finish one small requirement per day."
  },
  {
    id: "student-tip-7",
    author: "Freshie",
    category: "Campus Life",
    content: "If you are lost, ask a guard, class officer, or nearby office politely. Most people can at least point you to the right building."
  },
  {
    id: "student-tip-8",
    author: "Scholarship applicant",
    category: "Files",
    content: "Name your files clearly, like LASTNAME_COR_2026.pdf. It makes email attachments easier to check and resend."
  },
  {
    id: "student-tip-9",
    author: "Working student",
    category: "Time",
    content: "Use a weekly checklist instead of a giant to-do list. Put deadlines, office errands, and review blocks in the same view."
  },
  {
    id: "student-tip-10",
    author: "Peer tutor",
    category: "Review",
    content: "Practice solving first, then reread. If you can explain the step out loud, you probably understand it better."
  },
  {
    id: "student-tip-11",
    author: "Student assistant",
    category: "Office Visit",
    content: "Bring context, not just the question. A clear timeline of what happened helps staff understand your concern faster."
  },
  {
    id: "student-tip-12",
    author: "Group leader",
    category: "Teamwork",
    content: "For group tasks, decide the owner, deadline, and output format in chat so everyone can check the same agreement later."
  }
];

export default function TipsScreen() {
  const { clearQuery, debouncedQuery, query, setQuery } = useDebouncedQuery();
  const filteredTips = useMemo(() => {
    const normalized = debouncedQuery.trim().toLowerCase();
    if (!normalized) return studentTips;

    return studentTips.filter((tip) =>
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
          <Text style={styles.sectionTitle}>Tips & Tricks from other students</Text>
          </View>
          <Text style={styles.sectionDesc}>Mock peer advice while the community tips feature is being shaped.</Text>

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
              <Pressable accessibilityLabel="Clear search" onPress={clearQuery} style={styles.clearButton}>
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
                <Text style={styles.authorText}>{tip.author}</Text>
                </View>
                <Text style={styles.tipContent}>{tip.content}</Text>
              </View>
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
            <Text style={styles.actionTitle}>Got a student tip?</Text>
            <Text style={styles.actionDesc}>Send a short peer tip for review before it becomes part of this screen.</Text>
            
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
