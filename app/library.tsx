import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  BookOpen,
  ChevronRight,
  Info,
  Search,
  Shield,
  X,
  Zap
} from "lucide-react-native";

import { libraryTopics, searchTopics, getCategories, type LibraryTopic } from "@/data/libraryTopics";
import { colors } from "@/theme/colors";

// ─── Category config ─────────────────────────────────────────────────────────

interface CatConfig {
  bg: string;
  border: string;
  text: string;
  icon: typeof BookOpen;
}

const CATEGORY_CONFIG: Record<string, CatConfig> = {
  "Student Services": { bg: "#E8F5E9", border: "#A5D6A7", text: "#2E7D32", icon: Shield },
  "Campus Safety":   { bg: "#FFF3E0", border: "#FFCC80", text: "#E65100", icon: Zap },
  "Student Welfare": { bg: "#E3F2FD", border: "#90CAF9", text: "#1565C0", icon: Info },
  "Campus Guidelines": { bg: colors.maroonSoft, border: "#E8C7D0", text: colors.maroon, icon: BookOpen }
};

const DEFAULT_CAT: CatConfig = { bg: colors.surface, border: colors.border, text: colors.muted, icon: BookOpen };

function getCat(category: string): CatConfig {
  return CATEGORY_CONFIG[category] ?? DEFAULT_CAT;
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({ topic, index, onPress }: { topic: LibraryTopic; index: number; onPress: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const delay = Math.min(index * 35, 600); // cap delay at 600ms for long lists
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true })
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [index, fadeAnim, slideAnim]);

  const handlePressIn = () =>
    Animated.spring(pressScale, { toValue: 0.97, useNativeDriver: true, friction: 6, tension: 200 }).start();
  const handlePressOut = () =>
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();

  const cat = getCat(topic.category);
  const CatIcon = cat.icon;
  const stepCount = topic.steps.length;

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View
        style={[
          styles.topicCard,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: pressScale }] }
        ]}
      >
        {/* Left accent */}
        <View style={[styles.accentBar, { backgroundColor: cat.text }]} />

        <View style={styles.topicBody}>
          {/* Category badge + step count */}
          <View style={styles.topicMeta}>
            <View style={[styles.catBadge, { backgroundColor: cat.bg, borderColor: cat.border }]}>
              <CatIcon color={cat.text} size={11} />
              <Text style={[styles.catBadgeText, { color: cat.text }]}>{topic.category}</Text>
            </View>
            {stepCount > 0 && (
              <View style={styles.stepCountBadge}>
                <Text style={styles.stepCountText}>{stepCount} step{stepCount !== 1 ? "s" : ""}</Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.topicTitle} numberOfLines={2}>{topic.sectionTitle}</Text>

          {/* Office / source */}
          {topic.office || topic.officeLocation ? (
            <Text style={styles.topicOffice} numberOfLines={1}>
              {topic.officeLocation || topic.office}
            </Text>
          ) : null}

          {/* Preview of answer/content */}
          <Text style={styles.topicPreview} numberOfLines={2}>
            {topic.answer || topic.content}
          </Text>
        </View>

        <ChevronRight color={colors.muted} size={17} style={styles.chevron} />
      </Animated.View>
    </Pressable>
  );
}

// ─── Category filter chips ────────────────────────────────────────────────────

function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, friction: 6, tension: 200 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();

  const cat = getCat(label);

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View
        style={[
          styles.chip,
          active
            ? { backgroundColor: cat.text, borderColor: cat.text }
            : { backgroundColor: cat.bg, borderColor: cat.border },
          { transform: [{ scale }] }
        ]}
      >
        <Text style={[styles.chipText, { color: active ? "#fff" : cat.text }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Main Library Screen ──────────────────────────────────────────────────────

export default function LibraryScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => getCategories(), []);

  const results = useMemo(() => {
    let topics = searchTopics(query);
    if (activeCategory) {
      topics = topics.filter((t) => t.category === activeCategory);
    }
    return topics;
  }, [query, activeCategory]);

  const handleTopicPress = (topic: LibraryTopic) => {
    router.push({
      pathname: "/library-topic/[chunkId]" as never,
      params: { chunkId: topic.chunkId }
    });
  };

  const clearSearch = () => {
    setQuery("");
    setActiveCategory(null);
  };

  const sheetFade = useRef(new Animated.Value(0)).current;
  const sheetSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(sheetFade, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(sheetSlide, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true })
    ]).start();
  }, [sheetFade, sheetSlide]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.headerArea}>
        <View style={styles.headerRow}>
          <BookOpen color={colors.white} size={20} />
          <Text style={styles.headerTitle}>Library</Text>
        </View>
        <Text style={styles.headerSub}>{libraryTopics.length} topics from campus data</Text>
      </View>

      <Animated.View
        style={[
          styles.sheetContainer,
          { opacity: sheetFade, transform: [{ translateY: sheetSlide }] }
        ]}
      >
        {/* Search bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBox}>
            <Search color={colors.mutedLight} size={17} />
            <TextInput
              autoCorrect={false}
              autoCapitalize="none"
              value={query}
              onChangeText={setQuery}
              placeholder="Search topics, offices, procedures..."
              placeholderTextColor={colors.mutedLight}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {(query.length > 0 || activeCategory) ? (
              <Pressable onPress={clearSearch} style={styles.clearBtn}>
                <X color={colors.muted} size={15} />
              </Pressable>
            ) : null}
          </View>

          {/* Category filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {categories.map((cat) => (
              <CategoryChip
                key={cat}
                label={cat}
                active={activeCategory === cat}
                onPress={() => setActiveCategory(activeCategory === cat ? null : cat)}
              />
            ))}
          </ScrollView>

          {/* Result count */}
          <Text style={styles.resultCount}>
            {results.length} topic{results.length !== 1 ? "s" : ""}
            {query ? ` matching "${query}"` : ""}
            {activeCategory ? ` in ${activeCategory}` : ""}
          </Text>
        </View>

        {/* Topic list */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        >
          {results.map((topic, index) => (
            <TopicCard
              key={topic.chunkId}
              topic={topic}
              index={index}
              onPress={() => handleTopicPress(topic)}
            />
          ))}

          {results.length === 0 && (
            <View style={styles.emptyState}>
              <BookOpen color={colors.mutedLight} size={40} />
              <Text style={styles.emptyTitle}>No topics found</Text>
              <Text style={styles.emptyText}>
                Try clinic, guidance, safety, clearance, ID, complaint, or feedback.
              </Text>
              <Pressable onPress={clearSearch} style={styles.clearAllBtn}>
                <Text style={styles.clearAllText}>Clear filters</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.maroon, flex: 1 },

  headerArea: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 4
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { color: colors.white, fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  headerSub: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "600" },

  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    flex: 1,
    overflow: "hidden"
  },

  searchSection: {
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 12
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 10
  },
  clearBtn: {
    alignItems: "center",
    height: 30,
    justifyContent: "center",
    width: 30
  },
  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 7
  },
  chipText: { fontSize: 12, fontWeight: "800" },
  resultCount: { color: colors.muted, fontSize: 12, fontWeight: "700" },

  listContent: {
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 120,
    paddingTop: 2
  },

  topicCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  accentBar: {
    width: 4,
    flexShrink: 0
  },
  topicBody: {
    flex: 1,
    gap: 5,
    padding: 14
  },
  topicMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  catBadge: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  catBadgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3 },
  stepCountBadge: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  stepCountText: { color: colors.gold, fontSize: 10, fontWeight: "800" },
  topicTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
    letterSpacing: -0.2
  },
  topicOffice: { color: colors.maroon, fontSize: 12, fontWeight: "700" },
  topicPreview: { color: colors.muted, fontSize: 12, fontWeight: "500", lineHeight: 17 },
  chevron: { alignSelf: "center", marginRight: 10 },

  emptyState: {
    alignItems: "center",
    gap: 10,
    paddingTop: 60,
    paddingHorizontal: 20
  },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: "500", lineHeight: 19, textAlign: "center" },
  clearAllBtn: {
    backgroundColor: colors.maroonSoft,
    borderColor: "#E8C7D0",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10
  },
  clearAllText: { color: colors.maroon, fontSize: 13, fontWeight: "800" }
});
