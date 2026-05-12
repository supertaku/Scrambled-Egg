import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";

export default function MapScreen() {
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
        <Text style={styles.headerTitle}>Map</Text>
      </View>
      <View style={styles.sheetContainer}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={require("../assets/images/mascot/haki-map-construction.png")}
            style={styles.image}
          />
          <View style={styles.dialogueBubble}>
            <Text style={styles.dialogueTitle}>Map is cooking</Text>
            <Text style={styles.dialogueText}>
              Haki is still building this map feature. No cap, campus navigation is under construction.
            </Text>
          </View>
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
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 8
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
  content: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: 110,
    paddingHorizontal: 22
  },
  image: {
    aspectRatio: 1,
    maxHeight: 390,
    width: "100%"
  },
  dialogueBubble: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    marginTop: 12,
    padding: 16,
    width: "100%"
  },
  dialogueTitle: {
    color: colors.maroon,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center"
  },
  dialogueText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center"
  }
});
