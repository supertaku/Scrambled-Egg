import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";

export default function MapScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  // Floating bob animation for the mascot
  const bobAnim = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, {
          toValue: -10,
          duration: 1800,
          useNativeDriver: true
        }),
        Animated.timing(bobAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true
        })
      ])
    );
    bob.start();
    return () => bob.stop();
  }, [bobAnim]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.headerArea}>
        <Text style={styles.headerTitle}>Map</Text>
      </View>
      <View style={styles.sheetContainer}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Animated.Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={require("../assets/images/mascot/haki-map-construction.png")}
            style={[styles.image, { transform: [{ translateY: bobAnim }] }]}
          />
          <View style={styles.dialogueBubble}>
            <View style={styles.comingSoonPill}>
              <Text style={styles.comingSoonText}>Coming Soon</Text>
            </View>
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
  content: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: 110,
    paddingHorizontal: 28
  },
  image: {
    aspectRatio: 1,
    maxHeight: 360,
    width: "100%"
  },
  dialogueBubble: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    marginTop: 14,
    padding: 20,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3
  },
  comingSoonPill: {
    backgroundColor: colors.maroonSoft,
    borderColor: "#E8C7D0",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5
  },
  comingSoonText: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1
  },
  dialogueTitle: {
    color: colors.maroon,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.4
  },
  dialogueText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    textAlign: "center"
  }
});
