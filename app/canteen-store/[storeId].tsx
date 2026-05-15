import { useEffect, useMemo, useRef } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, MapPin, Search, Store, Utensils, X } from "lucide-react-native";
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCanteenStoreById } from "@/data/canteenStores";
import { useDebouncedQuery } from "@/hooks/useDebouncedQuery";
import { colors } from "@/theme/colors";

export default function CanteenStoreScreen() {
  const router = useRouter();
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const store = getCanteenStoreById(storeId);
  const { clearQuery, debouncedQuery, query, setQuery } = useDebouncedQuery();
  const filteredFoods = useMemo(() => {
    if (!store) return [];

    const normalized = debouncedQuery.trim().toLowerCase();
    if (!normalized) return store.foods;

    return store.foods.filter((food) =>
      [food.name, food.description, String(food.price)].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [debouncedQuery, store]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const goToStoreList = () => router.replace("/canteen");

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

  if (!store) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.headerArea}>
          <BackButton onPress={goToStoreList} />
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
        <BackButton onPress={goToStoreList} />
        <Text style={styles.headerTitle}>Food</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.sheetContainer}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Store header */}
            <View style={styles.storeHeader}>
              <View style={styles.storeIconWrap}>
                <Store color={colors.maroon} size={28} />
              </View>
              <View style={styles.storeCopy}>
                <Text style={styles.storeName}>{store.name}</Text>
                <Text style={styles.storeDescription}>{store.description}</Text>
                <View style={styles.locationRow}>
                  <MapPin color={colors.mutedLight} size={13} />
                  <Text style={styles.locationText}>{store.location}</Text>
                </View>
              </View>
            </View>

            {/* Food section */}
            <View style={styles.foodSection}>
              <Text style={styles.sectionTitle}>Menu</Text>
              <View style={styles.searchBox}>
                <Search color={colors.mutedLight} size={17} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search foods or prices"
                  placeholderTextColor={colors.mutedLight}
                  style={styles.searchInput}
                />
                {query ? (
                  <Pressable accessibilityLabel="Clear search" onPress={clearQuery} style={styles.clearButton}>
                    <X color={colors.muted} size={16} />
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.foodList}>
                {filteredFoods.map((food, index) => (
                  <FoodCard key={food.id} food={food} index={index} />
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

function BackButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, friction: 6, tension: 200 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();

  return (
    <Pressable accessibilityLabel="Back to stores" onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[styles.backButton, { transform: [{ scale }] }]}>
        <ArrowLeft color={colors.white} size={21} />
      </Animated.View>
    </Pressable>
  );
}

function FoodCard({
  food,
  index
}: {
  food: { id: string; name: string; description: string; price: number };
  index: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 70, useNativeDriver: true })
      ]).start();
    }, index * 45);
    return () => clearTimeout(timer);
  }, [index, fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.foodCard,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}
    >
      <View style={styles.foodIcon}>
        <Utensils color={colors.gold} size={19} />
      </View>
      <View style={styles.foodCopy}>
        <View style={styles.foodTitleRow}>
          <Text style={styles.foodName}>{food.name}</Text>
          <View style={styles.priceTag}>
            <Text style={styles.foodPrice}>₱{food.price}</Text>
          </View>
        </View>
        <Text style={styles.foodDescription}>{food.description}</Text>
      </View>
    </Animated.View>
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
    backgroundColor: colors.overlayMedium,
    height: 40,
    justifyContent: "center",
    width: 40,
    borderRadius: 20
  },
  headerSpacer: {
    width: 40
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
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 114
  },
  storeHeader: {
    alignItems: "flex-start",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  storeIconWrap: {
    alignItems: "center",
    backgroundColor: colors.maroonSoft,
    borderRadius: 16,
    height: 58,
    justifyContent: "center",
    width: 58
  },
  storeCopy: {
    flex: 1,
    gap: 5
  },
  storeName: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 25,
    letterSpacing: -0.3
  },
  storeDescription: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19
  },
  locationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  locationText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  foodSection: {
    gap: 12
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.3
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
    paddingHorizontal: 13
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
  foodList: {
    gap: 10
  },
  foodCard: {
    alignItems: "flex-start",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  foodIcon: {
    alignItems: "center",
    backgroundColor: colors.goldSoft,
    borderRadius: 13,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  foodCopy: {
    flex: 1,
    gap: 5
  },
  foodTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  foodName: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20,
    letterSpacing: -0.2
  },
  priceTag: {
    backgroundColor: colors.maroonSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#E8C7D0"
  },
  foodPrice: {
    color: colors.maroon,
    fontSize: 13,
    fontWeight: "900"
  },
  foodDescription: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18
  },
  emptyState: {
    gap: 6,
    padding: 20
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  }
});
