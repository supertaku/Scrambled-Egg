import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Animated, Image, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { CAMPUS_MAP_CANVAS } from "@/data/campusMapDestinations";
import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import { mapPreviewPalette } from "@/theme/featurePalettes";
import type { Theme } from "@/theme/themes";

interface PreviewImageFrame {
  height: number;
  left: number;
  top: number;
  width: number;
}

const COURT_FOCUS = { x: 0.515, y: 0.69 };

function focusedPreviewFrame(viewportWidth: number, viewportHeight: number): PreviewImageFrame {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { height: 0, left: 0, top: 0, width: 0 };
  }

  const scale = Math.max(viewportWidth / CAMPUS_MAP_CANVAS.width, viewportHeight / CAMPUS_MAP_CANVAS.height);
  const width = CAMPUS_MAP_CANVAS.width * scale;
  const height = CAMPUS_MAP_CANVAS.height * scale;
  return {
    height,
    left: Math.min(0, Math.max(viewportWidth - width, viewportWidth / 2 - width * COURT_FOCUS.x)),
    top: Math.min(0, Math.max(viewportHeight - height, viewportHeight / 2 - height * COURT_FOCUS.y)),
    width
  };
}

export default function MapScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const translate = useRef(new Animated.Value(reducedMotion ? 0 : 14)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const [previewFrame, setPreviewFrame] = useState<PreviewImageFrame>({
    height: 0,
    left: 0,
    top: 0,
    width: 0
  });

  useEffect(() => {
    if (reducedMotion) {
      entrance.setValue(1);
      translate.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(entrance, { duration: 260, toValue: 1, useNativeDriver: true }),
      Animated.spring(translate, { friction: 9, tension: 64, toValue: 0, useNativeDriver: true })
    ]).start();
  }, [entrance, reducedMotion, translate]);

  const handlePressIn = () => {
    if (!reducedMotion) {
      Animated.spring(buttonScale, { friction: 8, tension: 210, toValue: 0.96, useNativeDriver: true }).start();
    }
  };

  const handlePressOut = () => {
    if (!reducedMotion) {
      Animated.spring(buttonScale, { friction: 7, tension: 190, toValue: 1, useNativeDriver: true }).start();
    }
  };

  const handlePreviewLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setPreviewFrame(focusedPreviewFrame(width, height));
  }, []);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <Animated.View style={[styles.page, { opacity: entrance, transform: [{ translateY: translate }] }]}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Explore the campus</Text>
          <Text style={styles.title}>TUPT Campus Map</Text>
        </View>

        <View style={styles.pixelFrame}>
          <View onLayout={handlePreviewLayout} style={styles.pixelFrameInner}>
            {previewFrame.width > 0 ? (
              <Image
                accessibilityIgnoresInvertColors
                resizeMode="stretch"
                source={require("../assets/images/map/tupt-campus-overview-pixel.png")}
                style={[styles.previewImage, previewFrame]}
              />
            ) : null}
            <View style={styles.tint} />
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <Pressable
                accessibilityHint="Opens the full-screen playable campus map."
                accessibilityLabel="View Campus Map"
                accessibilityRole="button"
                onPress={() => router.push("/campus-map" as never)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={styles.launchButton}
              >
                <View style={styles.launchInset}>
                  <Text style={styles.launchText}>View Campus Map</Text>
                  <ChevronRight color={colors.maroonDark} size={19} strokeWidth={3} />
                </View>
              </Pressable>
            </Animated.View>
          </View>
        </View>

        <Text selectable style={styles.note}>
          Walk around campus and tap buildings for details. Works even without internet.
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  safeArea: {
    backgroundColor: colors.maroon,
    flex: 1
  },
  page: {
    flex: 1,
    gap: 16,
    paddingBottom: 104,
    paddingHorizontal: 18,
    paddingTop: 14
  },
  header: {
    gap: 3
  },
  eyebrow: {
    color: colors.goldLight,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  title: {
    color: colors.white,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.4
  },
  pixelFrame: {
    backgroundColor: mapPreviewPalette.frame,
    borderColor: colors.gold,
    borderWidth: 4,
    flex: 1,
    padding: 5,
    shadowColor: mapPreviewPalette.shadow,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 0
  },
  pixelFrameInner: {
    alignItems: "center",
    borderColor: mapPreviewPalette.frameHighlight,
    borderWidth: 2,
    flex: 1,
    justifyContent: "center",
    overflow: "hidden"
  },
  previewImage: {
    position: "absolute"
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(25, 12, 18, 0.36)"
  },
  launchButton: {
    backgroundColor: colors.maroon,
    borderBottomColor: colors.maroonDark,
    borderBottomWidth: 5,
    borderColor: mapPreviewPalette.launchBorder,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
    padding: 4
  },
  launchInset: {
    alignItems: "center",
    backgroundColor: mapPreviewPalette.launchFill,
    borderColor: mapPreviewPalette.launchInk,
    borderWidth: 2,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 13
  },
  launchText: {
    color: colors.maroonDark,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.4
  },
  note: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    textAlign: "center"
  }
});
