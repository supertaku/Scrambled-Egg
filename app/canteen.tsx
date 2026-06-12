import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "expo-router";
import { ChevronRight, MapPin, Search, Store, X } from "lucide-react-native";
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { canteenStores } from "@/data/canteenStores";
import { useDebouncedQuery } from "@/hooks/useDebouncedQuery";
import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/themes";

export default function CanteenScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { clearQuery, debouncedQuery, query, setQuery } = useDebouncedQuery();
  const filteredStores = useMemo(() => {
    const normalized = debouncedQuery.trim().toLowerCase();
    if (!normalized) return canteenStores;

    return canteenStores.filter((store) =>
      [
        store.name,
        store.description,
        store.location,
        ...store.foods.map((food) => `${food.name} ${food.description}`)
      ].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [debouncedQuery]);

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
  }, [fadeAnim, slideAnim]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.headerArea}>
        <Text style={styles.headerTitle}>Food</Text>
      </View>
      <View style={styles.sheetContainer}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.sectionHeader}>
              <View style={styles.headerTitleRow}>
                <View style={styles.sectionIconBg}>
                  <Store color={colors.maroon} size={20} />
                </View>
                <View>
                  <Text style={styles.sectionLabel}>Campus Canteen</Text>
                  <Text style={styles.sectionTitle}>Canteen Stores</Text>
                </View>
              </View>
              <Text selectable style={styles.sectionDesc}>Choose a store first, then view its full food list.</Text>
              <View style={styles.searchBox}>
                <Search color={colors.mutedLight} size={17} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search stores or foods"
                  placeholderTextColor={colors.mutedLight}
                  style={styles.searchInput}
                />
                {query ? (
                  <Pressable accessibilityLabel="Clear search" onPress={clearQuery} style={styles.clearButton}>
                    <X color={colors.muted} size={16} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.storeList}>
              {filteredStores.map((store, index) => (
                <StoreCard
                  key={store.id}
                  store={store}
                  index={index}
                  onPress={() =>
                    router.push({
                      pathname: "/canteen-store/[storeId]",
                      params: { storeId: store.id }
                    })
                  }
                />
              ))}
              {filteredStores.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No stores found</Text>
                  <Text style={styles.emptyText}>Try searching for siomai, coffee, rice meals, or snacks.</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function StoreCard({
  store,
  index,
  onPress
}: {
  store: { id: string; name: string; description: string; location: string; foods: { name: string; description: string }[] };
  index: number;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 70, useNativeDriver: true })
      ]).start();
    }, index * 55);
    return () => clearTimeout(timer);
  }, [index, fadeAnim, slideAnim]);

  const handlePressIn = () =>
    Animated.spring(pressScale, { toValue: 0.97, useNativeDriver: true, friction: 6, tension: 200 }).start();
  const handlePressOut = () =>
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View
        style={[
          styles.storeCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: pressScale }]
          }
        ]}
      >
        <View style={styles.storeIcon}>
          <Store color={colors.maroon} size={22} />
        </View>
        <View style={styles.storeCopy}>
          <Text selectable style={styles.storeName}>{store.name}</Text>
          <Text selectable style={styles.storeDescription} numberOfLines={2}>{store.description}</Text>
          <View style={styles.metaRow}>
            <MapPin color={colors.mutedLight} size={12} />
            <Text selectable style={styles.locationText}>{store.location}</Text>
            <View style={styles.metaDivider} />
            <Text style={styles.foodCount}>{store.foods.length} items</Text>
          </View>
        </View>
        <ChevronRight color={colors.maroon} size={18} />
      </Animated.View>
    </Pressable>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
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
    gap: 16,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 114
  },
  sectionHeader: {
    gap: 10
  },
  headerTitleRow: {
    alignItems: "center",
    flexDirection: "row",
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
    fontWeight: "600",
    lineHeight: 19
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 13,
    shadowColor: colors.shadow,
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
  storeList: {
    gap: 12
  },
  storeCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  storeIcon: {
    alignItems: "center",
    backgroundColor: colors.maroonSoft,
    borderRadius: 14,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  storeCopy: {
    flex: 1,
    gap: 5
  },
  storeName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
    letterSpacing: -0.2
  },
  storeDescription: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  locationText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600"
  },
  metaDivider: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border
  },
  foodCount: {
    color: colors.maroon,
    fontSize: 12,
    fontWeight: "800"
  },
  emptyState: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 20
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
  }
});
