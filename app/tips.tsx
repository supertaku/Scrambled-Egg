import { useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb, Mail, Search, X } from "lucide-react-native";
import { Animated, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useDebouncedQuery } from "@/hooks/useDebouncedQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { studentTips, type StudentTip } from "@/data/studentTips";
import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import { bulletinPaperPalette, tipCategoryPalette } from "@/theme/featurePalettes";
import type { Theme, ThemeColors } from "@/theme/themes";
import { logger } from "@/utils/logger";

const REVIEW_EMAIL = "hakiadmin@gmail.com";

function accentFor(category: string, colors: ThemeColors): string {
  return tipCategoryPalette[category] ?? colors.maroon;
}

export default function TipsScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useReducedMotion();
  const { clearQuery, debouncedQuery, query, setQuery } = useDebouncedQuery();
  const [category, setCategory] = useState<string | null>(null);
  const categories = useMemo(() => [...new Set(studentTips.map((tip) => tip.category))], []);

  const matchingTips = useMemo(() => {
    const normalized = debouncedQuery.trim().toLowerCase();
    return studentTips.filter((tip) => {
      const categoryMatches = !category || tip.category === category;
      const searchMatches = !normalized ||
        [tip.author, tip.category, tip.content].some((value) => value.toLowerCase().includes(normalized));
      return categoryMatches && searchMatches;
    });
  }, [category, debouncedQuery]);

  const featuredTip = useMemo(() => {
    if (matchingTips.length === 0) {
      return null;
    }
    const day = Math.floor(Date.now() / 86_400_000);
    return matchingTips[day % matchingTips.length] ?? null;
  }, [matchingTips]);
  const remainingTips = matchingTips.filter((tip) => tip.id !== featuredTip?.id);

  const handleEmailAdmin = async () => {
    const subject = "Haki: Tips and Tricks Review Submission";
    const body = "Hi Haki Admin,\n\nI would like to send this tip or correction for review:\n\n[Write your review here]\n\nRegards,\n[Your Name/Course]";
    const url = `mailto:${REVIEW_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      }
    } catch (error) {
      logger.ui.error("Error opening email client", { error: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Student community</Text>
        <Text style={styles.headerTitle}>Bulletin Board</Text>
      </View>
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.boardIntro}>
            <View style={styles.introTitleRow}>
              <View style={styles.ideaCircle}>
                <Lightbulb color={colors.maroon} size={20} />
              </View>
              <View style={styles.introCopy}>
                <Text style={styles.introTitle}>Tips & Tricks</Text>
                <Text style={styles.introText}>Peer advice pinned by students. Verify changing details before relying on them.</Text>
              </View>
            </View>
            <View style={styles.search}>
              <Search color={colors.mutedLight} size={17} />
              <TextInput
                accessibilityLabel="Search student tips"
                onChangeText={setQuery}
                placeholder="Search the board"
                placeholderTextColor={colors.mutedLight}
                style={styles.searchInput}
                value={query}
              />
              {query || category ? (
                <Pressable
                  accessibilityLabel="Clear tip filters"
                  onPress={() => { clearQuery(); setCategory(null); }}
                  style={styles.clear}
                >
                  <X color={colors.muted} size={16} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView contentContainerStyle={styles.tapeRow} horizontal showsHorizontalScrollIndicator={false}>
              {categories.map((item) => (
                <TapeFilter
                  active={category === item}
                  category={item}
                  key={item}
                  onPress={() => setCategory(category === item ? null : item)}
                />
              ))}
            </ScrollView>
          </View>

          {featuredTip ? (
            <View style={styles.featuredSection}>
              <Text style={styles.boardLabel}>Pinned today</Text>
              <FeaturedNote tip={featuredTip} />
            </View>
          ) : null}

          <View style={styles.noteSection}>
            {remainingTips.length > 0 ? <Text style={styles.boardLabel}>More from students</Text> : null}
            {remainingTips.map((tip, index) => (
              <BoardNote index={index} key={tip.id} reducedMotion={reducedMotion} tip={tip} />
            ))}
          </View>

          {matchingTips.length === 0 ? (
            <View style={styles.emptyNote}>
              <Text style={styles.emptyTitle}>Nothing pinned for that search</Text>
              <Text style={styles.emptyText}>Try another category or clear your search.</Text>
            </View>
          ) : null}

          <Pressable accessibilityRole="button" onPress={handleEmailAdmin} style={styles.submitNote}>
            <View style={styles.noteTapeGold} />
            <Mail color={colors.maroon} size={20} />
            <View style={styles.submitCopy}>
              <Text style={styles.submitTitle}>Send a review</Text>
              <Text style={styles.submitText}>Send tips or corrections to {REVIEW_EMAIL} before they are pinned.</Text>
            </View>
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function TapeFilter({ active, category, onPress }: { active: boolean; category: string; onPress: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const accent = accentFor(category, colors);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tapeFilter, { borderColor: `${accent}40` }, active ? { backgroundColor: accent } : undefined]}
    >
      <Text style={[styles.tapeText, { color: active ? colors.white : accent }]}>{category}</Text>
    </Pressable>
  );
}

function FeaturedNote({ tip }: { tip: StudentTip }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const accent = accentFor(tip.category, colors);
  return (
    <View style={styles.featuredNote}>
      <View style={[styles.noteTape, { backgroundColor: `${accent}35` }]} />
      <View style={styles.pin} />
      <Text style={[styles.noteCategory, { color: accent }]}>{tip.category}</Text>
      <Text selectable style={styles.featuredText}>{tip.content}</Text>
      <Text selectable style={styles.author}>Pinned from {tip.author}</Text>
    </View>
  );
}

function BoardNote({ index, reducedMotion, tip }: { index: number; reducedMotion: boolean; tip: StudentTip }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : 10)).current;
  const accent = accentFor(tip.category, colors);

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { duration: 230, toValue: 1, useNativeDriver: true }),
        Animated.spring(translateY, { friction: 9, tension: 70, toValue: 0, useNativeDriver: true })
      ]).start();
    }, Math.min(index * 42, 320));
    return () => clearTimeout(timer);
  }, [index, opacity, reducedMotion, translateY]);

  return (
    <Animated.View style={[styles.boardNote, { opacity, transform: [{ translateY }] }]}>
      <View style={[styles.noteTapeSmall, { backgroundColor: `${accent}28` }]} />
      <View style={styles.noteHeader}>
        <Text style={[styles.noteCategory, { color: accent }]}>{tip.category}</Text>
        <Text selectable style={styles.author}>{tip.author}</Text>
      </View>
      <Text selectable style={styles.noteText}>{tip.content}</Text>
    </Animated.View>
  );
}

const createStyles = ({ colors, mode }: Theme) => {
  // Bulletin-board "paper" looks: warm cream in light mode, dark cork in
  // dark mode so themed ink/muted text stays readable on the notes.
  const paper = bulletinPaperPalette(mode);

  return StyleSheet.create({
  safeArea: { backgroundColor: colors.maroon, flex: 1 },
  header: { gap: 2, paddingBottom: 15, paddingHorizontal: 20, paddingTop: 8 },
  headerLabel: { color: colors.goldLight, fontSize: 11, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  headerTitle: { color: colors.white, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  sheet: { backgroundColor: paper.board, borderTopLeftRadius: 30, borderTopRightRadius: 30, flex: 1, overflow: "hidden" },
  content: { gap: 18, paddingBottom: 118, paddingHorizontal: 18, paddingTop: 20 },
  boardIntro: { backgroundColor: paper.noteSoft, borderColor: paper.border, borderRadius: 22, borderWidth: 1, gap: 15, padding: 16 },
  introTitleRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  ideaCircle: { alignItems: "center", backgroundColor: colors.goldSoft, borderRadius: 14, height: 46, justifyContent: "center", width: 46 },
  introCopy: { flex: 1, gap: 3 },
  introTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  introText: { color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  search: { alignItems: "center", backgroundColor: colors.card, borderColor: paper.border, borderRadius: 15, borderWidth: 1, flexDirection: "row", gap: 8, height: 50, paddingHorizontal: 13 },
  searchInput: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: "600" },
  clear: { alignItems: "center", height: 44, justifyContent: "center", width: 36 },
  tapeRow: { gap: 8, paddingVertical: 2 },
  tapeFilter: { backgroundColor: paper.tape, borderRadius: 5, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, transform: [{ rotate: "-0.5deg" }] },
  tapeText: { fontSize: 12, fontWeight: "900" },
  featuredSection: { gap: 10 },
  boardLabel: { color: colors.maroon, fontSize: 11, fontWeight: "900", letterSpacing: 0.9, textTransform: "uppercase" },
  featuredNote: { backgroundColor: paper.featured, borderColor: paper.featuredBorder, borderRadius: 9, borderWidth: 1, gap: 10, padding: 20, paddingTop: 25, position: "relative" },
  noteTape: { height: 17, left: "39%", position: "absolute", top: -8, transform: [{ rotate: "-2deg" }], width: 78 },
  pin: { backgroundColor: colors.maroon, borderColor: colors.white, borderRadius: 7, borderWidth: 2, height: 14, position: "absolute", right: 16, top: 15, width: 14 },
  noteCategory: { fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
  featuredText: { color: colors.ink, fontSize: 16, fontWeight: "600", lineHeight: 24 },
  author: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  noteSection: { gap: 11 },
  boardNote: { backgroundColor: paper.note, borderColor: paper.border, borderRadius: 10, borderWidth: 1, gap: 10, padding: 16, paddingTop: 20, position: "relative" },
  noteTapeSmall: { height: 13, left: 20, position: "absolute", top: -6, transform: [{ rotate: "-3deg" }], width: 52 },
  noteHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  noteText: { color: colors.ink, fontSize: 14, fontWeight: "500", lineHeight: 21 },
  emptyNote: { backgroundColor: paper.noteSoft, borderColor: paper.border, borderRadius: 12, borderWidth: 1, gap: 6, padding: 20 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  submitNote: { alignItems: "center", backgroundColor: colors.maroonSoft, borderColor: paper.submitBorder, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 13, minHeight: 84, padding: 16, position: "relative" },
  noteTapeGold: { backgroundColor: colors.goldSoft, height: 14, position: "absolute", right: 22, top: -7, transform: [{ rotate: "2deg" }], width: 58 },
  submitCopy: { flex: 1, gap: 4 },
  submitTitle: { color: mode === "dark" ? colors.ink : colors.maroonDark, fontSize: 16, fontWeight: "900" },
  submitText: { color: colors.maroon, fontSize: 12, fontWeight: "600", lineHeight: 17 }
  });
};
