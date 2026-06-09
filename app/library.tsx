import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BookOpen, Building2, ChevronRight, Info, Map as MapIcon, Search, Shield, X } from "lucide-react-native";
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
import { colors } from "@/theme/colors";

interface CounterConfig {
  accent: string;
  icon: typeof BookOpen;
  tint: string;
}

const COUNTERS: Record<ServiceDeskCounter, CounterConfig> = {
  Offices: { accent: "#2E7D32", icon: Building2, tint: "#E8F5E9" },
  Safety: { accent: "#E65100", icon: Shield, tint: "#FFF3E0" },
  "Campus Guidelines": { accent: colors.maroon, icon: Info, tint: colors.maroonSoft },
  "Map Directory": { accent: "#1565C0", icon: MapIcon, tint: "#E3F2FD" }
};

function counterFor(category: ServiceDeskCounter): CounterConfig {
  return COUNTERS[category] ?? { accent: colors.maroon, icon: BookOpen, tint: colors.maroonSoft };
}

export default function LibraryScreen() {
  const router = useRouter();
  const { query: queryParam } = useLocalSearchParams<{ query?: string | string[] }>();
  const routedQuery = Array.isArray(queryParam) ? queryParam[0] ?? "" : queryParam ?? "";
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState(routedQuery);
  const [selectedCounter, setSelectedCounter] = useState<ServiceDeskCounter | null>(null);
  const [officeFilter, setOfficeFilter] = useState("All");
  const counters = useMemo(() => getServiceDeskCounters(), []);

  useEffect(() => {
    if (routedQuery.trim()) {
      setQuery(routedQuery);
      setSelectedCounter(null);
      setOfficeFilter("All");
    }
  }, [routedQuery]);

  const searchResults = useMemo(() => {
    return searchTopics(query);
  }, [query]);

  const counterResults = useMemo(() => {
    const matches = searchTopics(query);
    return selectedCounter ? matches.filter((topic) => topicMatchesCategory(topic, selectedCounter)) : matches;
  }, [query, selectedCounter]);

  const officeFilters = useMemo(() => {
    return selectedCounter === "Offices" ? getOfficeFilters(counterResults) : [];
  }, [counterResults, selectedCounter]);

  useEffect(() => {
    if (selectedCounter !== "Offices") {
      if (officeFilter !== "All") setOfficeFilter("All");
      return;
    }
    if (!officeFilters.some((filter) => filter.key === officeFilter)) {
      setOfficeFilter("All");
    }
  }, [officeFilter, officeFilters, selectedCounter]);

  const results = useMemo(() => {
    if (selectedCounter === "Offices") {
      return counterResults.filter((topic) => topicMatchesOfficeFilter(topic, officeFilter));
    }
    return counterResults;
  }, [counterResults, officeFilter, selectedCounter]);

  const sections = useMemo(() => {
    if (selectedCounter) {
      return [{ category: selectedCounter, topics: results }];
    }

    return counters
      .map((item) => ({ category: item, topics: searchResults.filter((topic) => topicMatchesCategory(topic, item)) }))
      .filter((section) => section.topics.length > 0);
  }, [counters, results, searchResults, selectedCounter]);

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
              {query || selectedCounter || officeFilter !== "All" ? (
                <Pressable
                  accessibilityLabel="Clear filters"
                  onPress={() => {
                    setQuery("");
                    setSelectedCounter(null);
                    setOfficeFilter("All");
                  }}
                  style={styles.clear}
                >
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
            {counters.map((item) => (
              <CounterTile
                active={selectedCounter === item}
                category={item}
                count={libraryTopics.filter((topic) => topicMatchesCategory(topic, item)).length}
                key={item}
                onPress={() => {
                  setSelectedCounter(selectedCounter === item ? null : item);
                  setOfficeFilter("All");
                }}
              />
            ))}
          </View>

          {selectedCounter === "Offices" ? (
            <View style={styles.officeChipRow}>
              {officeFilters.map((filter) => {
                const active = officeFilter === filter.key;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    key={filter.key}
                    onPress={() => setOfficeFilter(filter.key)}
                    style={[styles.officeChip, active ? styles.officeChipActive : undefined]}
                  >
                    <Text style={[styles.officeChipText, active ? styles.officeChipTextActive : undefined]}>{filter.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {sections.map((section) => (
            <View key={section.category} style={styles.ticketSection}>
              <View style={styles.counterHeader}>
                <View style={[styles.counterMark, { backgroundColor: counterFor(section.category).accent }]} />
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
              <Pressable
                onPress={() => {
                  setQuery("");
                  setSelectedCounter(null);
                  setOfficeFilter("All");
                }}
                style={styles.emptyAction}
              >
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
  const config = counterFor(category);
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
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : 12)).current;
  const config = counterFor(serviceDeskCounterForTopic(topic));

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

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.maroon, flex: 1 },
  header: { gap: 2, paddingBottom: 15, paddingHorizontal: 20, paddingTop: 8 },
  headerLabel: { color: colors.goldLight, fontSize: 11, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  headerTitle: { color: colors.white, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, flex: 1, overflow: "hidden" },
  content: { gap: 17, paddingBottom: 116, paddingHorizontal: 18, paddingTop: 20 },
  hero: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 22, borderWidth: 1, gap: 15, padding: 16 },
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
  counterTile: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 17, borderWidth: 1, gap: 7, minHeight: 120, padding: 12, width: "48%" },
  counterIcon: { alignItems: "center", borderRadius: 11, height: 37, justifyContent: "center", width: 37 },
  counterTileTitle: { color: colors.ink, fontSize: 13, fontWeight: "900", lineHeight: 17 },
  counterTileCount: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  officeChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  officeChip: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 999, borderWidth: 1, minHeight: 36, paddingHorizontal: 12, paddingVertical: 9 },
  officeChipActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  officeChipText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  officeChipTextActive: { color: colors.white },
  activeText: { color: colors.white },
  activeSubtext: { color: "rgba(255,255,255,0.78)" },
  ticketSection: { gap: 10 },
  counterHeader: { alignItems: "center", flexDirection: "row", gap: 8 },
  counterMark: { borderRadius: 3, height: 18, width: 4 },
  counterTitle: { color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" },
  counterCount: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  ticketList: { gap: 9 },
  ticket: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.border, borderRadius: 17, borderWidth: 1, flexDirection: "row", minHeight: 110, overflow: "hidden" },
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
  empty: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.border, borderRadius: 20, borderWidth: 1, gap: 8, padding: 26 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19, textAlign: "center" },
  emptyAction: { backgroundColor: colors.maroonSoft, borderRadius: 13, marginTop: 5, minHeight: 44, paddingHorizontal: 16, paddingVertical: 13 },
  emptyActionText: { color: colors.maroon, fontSize: 13, fontWeight: "900" }
});
