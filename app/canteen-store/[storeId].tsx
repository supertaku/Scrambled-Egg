import { useEffect, useMemo, useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, MapPin, Search, Store, Utensils, X } from "lucide-react-native";
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCanteenStoreById } from "@/data/canteenStores";
import { colors } from "@/theme/colors";

export default function CanteenStoreScreen() {
  const router = useRouter();
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const store = getCanteenStoreById(storeId);
  const [query, setQuery] = useState("");
  const filteredFoods = useMemo(() => {
    if (!store) return [];

    const normalized = query.trim().toLowerCase();
    if (!normalized) return store.foods;

    return store.foods.filter((food) =>
      [food.name, food.description, String(food.price)].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [query, store]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const goToStoreList = () => router.replace("/canteen");

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

  if (!store) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.headerArea}>
          <Pressable accessibilityLabel="Back to stores" onPress={goToStoreList} style={styles.backButton}>
            <ArrowLeft color={colors.white} size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>Food</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.sheetContainer}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Store not found</Text>
            <Text style={styles.emptyText}>This canteen store is not available in the local list yet.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.headerArea}>
        <Pressable accessibilityLabel="Back to stores" onPress={goToStoreList} style={styles.backButton}>
          <ArrowLeft color={colors.white} size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>Food</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.sheetContainer}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <View style={styles.storeHeader}>
              <View style={styles.storeIcon}>
                <Store color={colors.maroon} size={28} />
              </View>
              <View style={styles.storeCopy}>
                <Text style={styles.storeName}>{store.name}</Text>
                <Text style={styles.storeDescription}>{store.description}</Text>
                <View style={styles.locationRow}>
                  <MapPin color={colors.muted} size={14} />
                  <Text style={styles.locationText}>{store.location}</Text>
                </View>
              </View>
            </View>

            <View style={styles.foodSection}>
              <Text style={styles.sectionTitle}>Foods</Text>
              <View style={styles.searchBox}>
                <Search color={colors.muted} size={18} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search foods or prices"
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                />
                {query ? (
                  <Pressable accessibilityLabel="Clear search" onPress={() => setQuery("")} style={styles.clearButton}>
                    <X color={colors.muted} size={18} />
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.foodList}>
                {filteredFoods.map((food) => (
                  <View key={food.id} style={styles.foodCard}>
                    <View style={styles.foodIcon}>
                      <Utensils color={colors.gold} size={20} />
                    </View>
                    <View style={styles.foodCopy}>
                      <View style={styles.foodTitleRow}>
                        <Text style={styles.foodName}>{food.name}</Text>
                        <Text style={styles.foodPrice}>PHP {food.price}</Text>
                      </View>
                      <Text style={styles.foodDescription}>{food.description}</Text>
                    </View>
                  </View>
                ))}
                {filteredFoods.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No foods found</Text>
                    <Text style={styles.emptyText}>Try searching for rice, coffee, siomai, drinks, or a price.</Text>
                  </View>
                ) : null}
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
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 54,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12
  },
  backButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40
  },
  headerSpacer: {
    width: 40
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
    gap: 22,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 110
  },
  storeHeader: {
    alignItems: "flex-start",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 16
  },
  storeIcon: {
    alignItems: "center",
    backgroundColor: colors.maroonSoft,
    borderRadius: 16,
    height: 56,
    justifyContent: "center",
    width: 56
  },
  storeCopy: {
    flex: 1,
    gap: 6
  },
  storeName: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 25
  },
  storeDescription: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20
  },
  locationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  locationText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  foodSection: {
    gap: 12
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900"
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
  foodList: {
    gap: 12
  },
  foodCard: {
    alignItems: "flex-start",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 16
  },
  foodIcon: {
    alignItems: "center",
    backgroundColor: colors.goldSoft,
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  foodCopy: {
    flex: 1,
    gap: 6
  },
  foodTitleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  foodName: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21
  },
  foodPrice: {
    color: colors.maroon,
    fontSize: 14,
    fontWeight: "900"
  },
  foodDescription: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  },
  emptyState: {
    gap: 8,
    padding: 24
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900"
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20
  }
});
