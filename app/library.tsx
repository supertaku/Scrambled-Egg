import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Bookmark, BookOpen, Building2, ChevronRight, Info, Map as MapIcon, Search, Shield, X } from "lucide-react-native";
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getOfficeFilters,
  getServiceDeskCounters,
  libraryTopics,
  searchTopics,
  serviceDeskCounterForTopic,
  topicMatchesCategory,
  topicMatchesOfficeFilter,
  type LibraryTopic,
  type ServiceDeskCounter
} from "@/data/libraryTopics";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { listBookmarks, removeBookmark, type SavedBookmark } from "@/services/bookmarkService";
import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import { serviceDeskPalette } from "@/theme/featurePalettes";
import type { Theme, ThemeColors } from "@/theme/themes";
import { hapticTap } from "@/utils/haptics";
import { logger } from "@/utils/logger";

interface CounterConfig {
  accent: string;
  icon: typeof BookOpen;
  tint: string;
}

function counterFor(category: ServiceDeskCounter, colors: ThemeColors): CounterConfig {
  const palette = serviceDeskPalette(colors);
  const counters: Record<ServiceDeskCounter, CounterConfig> = {
    Offices: { accent: palette.offices.accent, icon: Building2, tint: palette.offices.tint },
    Safety: { accent: palette.safety.accent, icon: Shield, tint: palette.safety.tint },
    "Campus Guidelines": { accent: colors.maroon, icon: Info, tint: colors.maroonSoft },
    "Map Directory": { accent: palette.mapDirectory.accent, icon: MapIcon, tint: palette.mapDirectory.tint }
  };
  return counters[category];
}

export default function LibraryScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { query: queryParam } = useLocalSearchParams<{ query?: string | string[] }>();
  const routedQuery = Array.isArray(queryParam) ? queryParam[0] ?? "" : queryParam ?? "";
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState(routedQuery);
  const [category, setCategory] = useState<ServiceDeskCounter | null>(null);
  const [officeFilter, setOfficeFilter] = useState("All");
  const [bookmarks, setBookmarks] = useState<SavedBookmark[]>([]);
  const categories = useMemo(() => getServiceDeskCounters(), []);

  // Refresh saved answers whenever the screen regains focus (the user may
  // have bookmarked something in chat since the last visit).
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void listBookmarks()
        .then((saved) => {
          if (mounted) {
            setBookmarks(saved);
          }
        })
        .catch((error) => {
          logger.db.warn("Saved answers could not be loaded.", {
            error: error instanceof Error ? error.message : String(error)
          });
        });
      return () => {
        mounted = false;
      };
    }, [])
  );

  const handleRemoveBookmark = useCallback((id: number) => {
    hapticTap();
    void removeBookmark(id)
      .then(() => setBookmarks((current) => current.filter((bookmark) => bookmark.id !== id)))
      .catch((error) => {
        logger.db.warn("Saved answer could not be removed.", {
          id,
          error: error instanceof Error ? error.message : String(error)
        });
      });
  }, []);

  useEffect(() => {
    if (routedQuery.trim()) {
      setQuery(routedQuery);
      setCategory(null);
      setOfficeFilter("All");
    }
  }, [routedQuery]);

  const counterResults = useMemo(() => {
    const matches = searchTopics(query);
    return category ? matches.filter((topic) => topicMatchesCategory(topic, category)) : matches;
  }, [category, query]);

  const officeOptions = useMemo(
    () => category === "Offices" ? getOfficeFilters(counterResults) : [],
    [category, counterResults]
  );

  useEffect(() => {
    if (category !== "Offices" || !officeOptions.some((filter) => filter.key === officeFilter)) {
      if (officeFilter !== "All") setOfficeFilter("All");
    }
  }, [category, officeFilter, officeOptions]);

  const results = useMemo(
    () => category === "Offices"
      ? counterResults.filter((topic) => topicMatchesOfficeFilter(topic, officeFilter))
      : counterResults,
    [category, counterResults, officeFilter]
  );

  const sections = useMemo(() => {
    if (category) {
      return [{ category, topics: results }];
    }
    return categories
      .map((item) => ({ category: item, topics: results.filter((topic) => topicMatchesCategory(topic, item)) }))
      .filter((section) => section.topics.length > 0);
  }, [categories, category, results]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Campus help guide</Text>
        <Text style={styles.headerTitle}>Service Desk</Text>
      </View>
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <BookOpen color={colors.maroon} size={21} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>What do you need to do?</Text>
                <Text style={styles.heroText}>{libraryTopics.length} helpful campus topics are ready to view.</Text>
              </View>
            </View>
            <View style={styles.searchBox}>
              <Search color={colors.mutedLight} size={18} />
              <TextInput
                accessibilityLabel="Search campus procedures"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder="Search a task, office, or document"
                placeholderTextColor={colors.mutedLight}
                returnKeyType="search"
                style={styles.searchInput}
                value={query}
              />
              {query || category || officeFilter !== "All" ? (
                <Pressable accessibilityLabel="Clear filters" onPress={() => { setQuery(""); setCategory(null); setOfficeFilter("All"); }} style={styles.clear}>
                  <X color={colors.muted} size={16} />
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionLabel}>Choose a counter</Text>
            <Text style={styles.resultText}>{results.length} available</Text>
          </View>
          <View style={styles.counterGrid}>
            {categories.map((item) => (
              <CounterTile
                active={category === item}
                category={item}
                count={libraryTopics.filter((topic) => topicMatchesCategory(topic, item)).length}
                key={item}
                onPress={() => {
                  hapticTap();
                  setOfficeFilter("All");
                  setCategory(category === item ? null : item);
                }}
              />
            ))}
          </View>

          {category === "Offices" && officeOptions.length > 0 ? (
            <ScrollView
              contentContainerStyle={styles.officeChipRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {officeOptions.map((office) => {
                const selected = officeFilter === office.key;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={office.key}
                    onPress={() => {
                      hapticTap();
                      setOfficeFilter(office.key);
                    }}
                    style={[styles.officeChip, selected ? styles.officeChipActive : undefined]}
                  >
                    <Text style={[styles.officeChipText, selected ? styles.officeChipTextActive : undefined]}>
                      {office.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {bookmarks.length > 0 && !query && !category ? (
            <View style={styles.ticketSection}>
              <View style={styles.counterHeader}>
                <View style={[styles.counterMark, { backgroundColor: colors.gold }]} />
                <Text style={styles.counterTitle}>Saved answers</Text>
                <Text style={styles.counterCount}>{bookmarks.length}</Text>
              </View>
              <View style={styles.ticketList}>
                {bookmarks.map((bookmark) => (
                  <View key={bookmark.id} style={styles.savedCard}>
                    <View style={styles.savedHeader}>
                      <Bookmark color={colors.gold} fill={colors.gold} size={14} />
                      <Text numberOfLines={2} style={styles.savedQuestion}>
                        {bookmark.question?.trim() || "Saved Haki answer"}
                      </Text>
                      <Pressable
                        accessibilityLabel="Remove saved answer"
                        accessibilityRole="button"
                        hitSlop={10}
                        onPress={() => handleRemoveBookmark(bookmark.id)}
                        style={styles.savedRemove}
                      >
                        <X color={colors.muted} size={15} />
                      </Pressable>
                    </View>
                    <Text selectable style={styles.savedAnswer}>
                      {bookmark.answerText}
                    </Text>
                    {bookmark.citations.length > 0 ? (
                      <Text numberOfLines={2} style={styles.savedCitation}>
                        {bookmark.citations
                          .map((citation) => citation.citation ?? citation.documentTitle ?? citation.citationId)
                          .join(" | ")}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {sections.map((section) => (
            <View key={section.category} style={styles.ticketSection}>
              <View style={styles.counterHeader}>
                <View style={[styles.counterMark, { backgroundColor: counterFor(section.category, colors).accent }]} />
                <Text style={styles.counterTitle}>{section.category}</Text>
                <Text style={styles.counterCount}>{section.topics.length}</Text>
              </View>
              <View style={styles.ticketList}>
                {section.topics.map((topic, index) => (
                  <ProcedureTicket
                    index={index}
                    key={topic.chunkId}
                    reducedMotion={reducedMotion}
                    topic={topic}
                    onPress={() => router.push({
                      pathname: "/library-topic/[chunkId]" as never,
                      params: { chunkId: topic.chunkId }
                    })}
                  />
                ))}
              </View>
            </View>
          ))}

          {results.length === 0 ? (
            <View style={styles.empty}>
              <BookOpen color={colors.mutedLight} size={34} />
              <Text style={styles.emptyTitle}>No matching help topic found</Text>
              <Text style={styles.emptyText}>Try searching for an office, ID, clinic, complaint, or clearance task.</Text>
              <Pressable onPress={() => { setQuery(""); setCategory(null); setOfficeFilter("All"); }} style={styles.emptyAction}>
                <Text style={styles.emptyActionText}>Return to all counters</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function CounterTile({
  active,
  category,
  count,
  onPress
}: {
  active: boolean;
  category: ServiceDeskCounter;
  count: number;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const config = counterFor(category, colors);
  const Icon = config.icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.counterTile, active ? { backgroundColor: config.accent, borderColor: config.accent } : undefined]}
    >
      <View style={[styles.counterIcon, { backgroundColor: active ? "rgba(255,255,255,0.16)" : config.tint }]}>
        <Icon color={active ? colors.white : config.accent} size={18} />
      </View>
      <Text numberOfLines={2} style={[styles.counterTileTitle, active ? styles.activeText : undefined]}>{category}</Text>
      <Text style={[styles.counterTileCount, active ? styles.activeSubtext : undefined]}>{count} tickets</Text>
    </Pressable>
  );
}

function ProcedureTicket({
  index,
  onPress,
  reducedMotion,
  topic
}: {
  index: number;
  onPress: () => void;
  reducedMotion: boolean;
  topic: LibraryTopic;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : 12)).current;
  const config = counterFor(serviceDeskCounterForTopic(topic), colors);

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { duration: 220, toValue: 1, useNativeDriver: true }),
        Animated.spring(translateY, { friction: 9, tension: 70, toValue: 0, useNativeDriver: true })
      ]).start();
    }, Math.min(index * 36, 280));
    return () => clearTimeout(timer);
  }, [index, opacity, reducedMotion, translateY]);

  const office = topic.officeLocation || topic.office;

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Animated.View style={[styles.ticket, { opacity, transform: [{ translateY }] }]}>
        <View style={[styles.ticketStrip, { backgroundColor: config.accent }]} />
        <View style={styles.ticketBody}>
          <Text style={styles.ticketTag}>{topic.verificationStatus === "pending" ? "Draft placeholder" : "Procedure ticket"}</Text>
          <Text numberOfLines={2} style={styles.ticketTitle}>{topic.sectionTitle}</Text>
          <View style={styles.ticketMeta}>
            {office ? <Text numberOfLines={1} style={styles.ticketOffice}>{office}</Text> : null}
            <Text style={styles.stepBadge}>{topic.steps.length} step{topic.steps.length === 1 ? "" : "s"}</Text>
          </View>
          {topic.verificationStatus === "pending" ? (
            <Text style={styles.pending}>Pending confirmation - not used in Haki answers</Text>
          ) : topic.lastUpdated ? <Text style={styles.updated}>Updated {topic.lastUpdated}</Text> : null}
        </View>
        <ChevronRight color={colors.maroon} size={18} style={styles.ticketArrow} />
      </Animated.View>
    </Pressable>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  safeArea: { backgroundColor: colors.maroon, flex: 1 },
  header: { gap: 2, paddingBottom: 15, paddingHorizontal: 20, paddingTop: 8 },
  headerLabel: { color: colors.goldLight, fontSize: 11, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  headerTitle: { color: colors.white, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, flex: 1, overflow: "hidden" },
  content: { gap: 17, paddingBottom: 116, paddingHorizontal: 18, paddingTop: 20 },
  hero: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 22, borderWidth: 1, gap: 15, padding: 16 },
  heroTop: { alignItems: "center", flexDirection: "row", gap: 12 },
  heroIcon: { alignItems: "center", backgroundColor: colors.maroonSoft, borderRadius: 14, height: 46, justifyContent: "center", width: 46 },
  heroCopy: { flex: 1, gap: 3 },
  heroTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", letterSpacing: -0.2 },
  heroText: { color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  searchBox: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 15, borderWidth: 1, flexDirection: "row", gap: 8, height: 50, paddingHorizontal: 13 },
  searchInput: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: "600" },
  clear: { alignItems: "center", height: 44, justifyContent: "center", width: 36 },
  sectionHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionLabel: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  resultText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  counterGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  officeChipRow: { gap: 8, paddingVertical: 2 },
  officeChip: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 999, borderWidth: 1, minHeight: 38, justifyContent: "center", paddingHorizontal: 14 },
  officeChipActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  officeChipText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  officeChipTextActive: { color: colors.white },
  counterTile: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 17, borderWidth: 1, gap: 7, minHeight: 120, padding: 12, width: "48%" },
  counterIcon: { alignItems: "center", borderRadius: 11, height: 37, justifyContent: "center", width: 37 },
  counterTileTitle: { color: colors.ink, fontSize: 13, fontWeight: "900", lineHeight: 17 },
  counterTileCount: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  activeText: { color: colors.white },
  activeSubtext: { color: "rgba(255,255,255,0.78)" },
  ticketSection: { gap: 10 },
  counterHeader: { alignItems: "center", flexDirection: "row", gap: 8 },
  counterMark: { borderRadius: 3, height: 18, width: 4 },
  counterTitle: { color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" },
  counterCount: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  ticketList: { gap: 9 },
  ticket: { alignItems: "center", backgroundColor: colors.card, borderColor: colors.border, borderRadius: 17, borderWidth: 1, flexDirection: "row", minHeight: 110, overflow: "hidden" },
  ticketStrip: { alignSelf: "stretch", width: 5 },
  ticketBody: { flex: 1, gap: 5, padding: 12 },
  ticketTag: { color: colors.mutedLight, fontSize: 10, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  ticketTitle: { color: colors.ink, fontSize: 14, fontWeight: "900", lineHeight: 19 },
  ticketMeta: { alignItems: "center", flexDirection: "row", gap: 7 },
  ticketOffice: { color: colors.maroon, flex: 1, fontSize: 11, fontWeight: "700" },
  stepBadge: { backgroundColor: colors.goldSoft, borderRadius: 8, color: colors.warning, fontSize: 10, fontWeight: "900", overflow: "hidden", paddingHorizontal: 7, paddingVertical: 4 },
  updated: { color: colors.mutedLight, fontSize: 10, fontWeight: "700" },
  pending: { color: colors.warning, fontSize: 10, fontWeight: "800" },
  ticketArrow: { marginRight: 11 },
  savedCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 17, borderWidth: 1, gap: 7, padding: 13 },
  savedHeader: { alignItems: "center", flexDirection: "row", gap: 8 },
  savedQuestion: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: "900", lineHeight: 17 },
  savedRemove: { alignItems: "center", height: 28, justifyContent: "center", width: 28 },
  savedAnswer: { color: colors.ink, fontSize: 13, fontWeight: "500", lineHeight: 19 },
  savedCitation: { color: colors.maroon, fontSize: 11, fontWeight: "700", lineHeight: 15 },
  empty: { alignItems: "center", backgroundColor: colors.card, borderColor: colors.border, borderRadius: 20, borderWidth: 1, gap: 8, padding: 26 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19, textAlign: "center" },
  emptyAction: { backgroundColor: colors.maroonSoft, borderRadius: 13, marginTop: 5, minHeight: 44, paddingHorizontal: 16, paddingVertical: 13 },
  emptyActionText: { color: colors.maroon, fontSize: 13, fontWeight: "900" }
});
