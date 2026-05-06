import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { ChevronRight, MapPin, Search, Store, X } from "lucide-react-native";
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { canteenStores } from "@/data/canteenStores";
import { colors } from "@/theme/colors";

export default function CanteenScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const filteredStores = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return canteenStores;

    return canteenStores.filter((store) =>
      [
        store.name,
        store.description,
        store.location,
        ...store.foods.map((food) => `${food.name} ${food.description}`)
      ].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [query]);

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
  }, [fadeAnim, slideAnim]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.headerArea}>
        <Text style={styles.headerTitle}>Food</Text>
      </View>
      <View style={styles.sheetContainer}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <View style={styles.sectionHeader}>
              <View style={styles.headerTitleRow}>
                <Store color={colors.maroon} size={22} />
                <Text style={styles.sectionTitle}>Canteen Stores</Text>
              </View>
              <Text style={styles.sectionDesc}>Choose a store first, then view its full food list.</Text>
              <View style={styles.searchBox}>
                <Search color={colors.muted} size={18} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search stores or foods"
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                />
                {query ? (
                  <Pressable accessibilityLabel="Clear search" onPress={() => setQuery("")} style={styles.clearButton}>
                    <X color={colors.muted} size={18} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.storeList}>
              {filteredStores.map((store) => (
                <Pressable
                  key={store.id}
                  onPress={() =>
                    router.push({
                      pathname: "/canteen-store/[storeId]",
                      params: { storeId: store.id }
                    })
                  }
                  style={styles.storeCard}
                >
                  <View style={styles.storeIcon}>
                    <Store color={colors.maroon} size={22} />
                  </View>
                  <View style={styles.storeCopy}>
                    <Text style={styles.storeName}>{store.name}</Text>
                    <Text style={styles.storeDescription}>{store.description}</Text>
                    <View style={styles.metaRow}>
                      <MapPin color={colors.muted} size={14} />
                      <Text style={styles.locationText}>{store.location}</Text>
                      <Text style={styles.foodCount}>{store.foods.length} foods</Text>
                    </View>
                  </View>
                  <ChevronRight color={colors.maroon} size={20} />
                </Pressable>
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
    gap: 18,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 110
  },
  sectionHeader: {
    gap: 8
  },
  headerTitleRow: {
    alignItems: "center",
    flexDirection: "row",
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
    lineHeight: 20
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
  storeList: {
    gap: 12
  },
  storeCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 16
  },
  storeIcon: {
    alignItems: "center",
    backgroundColor: colors.maroonSoft,
    borderRadius: 14,
    height: 46,
    justifyContent: "center",
    width: 46
  },
  storeCopy: {
    flex: 1,
    gap: 6
  },
  storeName: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22
  },
  storeDescription: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5
  },
  locationText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  foodCount: {
    color: colors.maroon,
    fontSize: 12,
    fontWeight: "900",
    marginLeft: 6
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
  }
});
