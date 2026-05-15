import { useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { AdminUnlockModal } from "./AdminUnlockModal";
import { mascotImages, type MascotStatus } from "./mascot/mascotConfig";
import { useMascotInteraction } from "./mascot/useMascotInteraction";

export type { MascotStatus } from "./mascot/mascotConfig";

interface MascotHeaderProps {
  message?: string;
  onMascotPress?: () => void;
  subtitle?: string;
  status?: MascotStatus;
}

export function MascotHeader({
  message,
  onMascotPress,
  subtitle,
  status = "idle"
}: MascotHeaderProps) {
  const {
    bubbleScale,
    closeAdminModal,
    handleMascotLongPress,
    handleMascotPress,
    imageTransform,
    isGroggy,
    resolvedMessage,
    resolvedStatus,
    showAdminModal
  } = useMascotInteraction({ message, onAdminRequest: onMascotPress, status });
  const mascotSource = mascotImages[resolvedStatus] ?? mascotImages.idle;

  // Gentle idle breathing animation
  const breathAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1.025,
          duration: 2200,
          useNativeDriver: true
        }),
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: true
        })
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [breathAnim]);

  return (
    <View style={styles.container}>
      <AdminUnlockModal onClose={closeAdminModal} visible={showAdminModal} />
      <Pressable
        accessibilityLabel={`Haki mascot (${resolvedStatus})`}
        accessibilityRole="button"
        disabled={isGroggy}
        onLongPress={handleMascotLongPress}
        onPress={handleMascotPress}
        delayLongPress={450}
        style={styles.mascotWrap}
      >
        <Animated.Image
          source={mascotSource}
          style={[styles.mascotImage, { transform: [...imageTransform, { scale: breathAnim }] }]}
          resizeMode="contain"
        />
      </Pressable>

      {resolvedMessage ? (
        <Animated.View style={[styles.speechBubbleWrap, { transform: [{ scale: bubbleScale }] }]}>
          <View style={styles.speechBubble}>
            <View pointerEvents="none" style={styles.speechBubbleTailBorder} />
            <View pointerEvents="none" style={styles.speechBubbleTail} />
            <Text style={styles.hakiName}>Haki</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            <ScrollView
              style={styles.speechScroll}
              contentContainerStyle={styles.speechScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <Text style={styles.speechText}>
                {resolvedMessage.startsWith("Did you know?") ? (
                  <>
                    <Text style={styles.messageStrong}>Did you know?</Text>
                    {resolvedMessage.replace("Did you know?", "")}
                  </>
                ) : (
                  resolvedMessage
                )}
              </Text>
            </ScrollView>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    height: 146,
    justifyContent: "flex-end",
    overflow: "visible",
    paddingHorizontal: 18,
    paddingTop: 8,
    position: "relative",
    zIndex: 20,
    elevation: 20
  },
  mascotWrap: {
    alignItems: "center",
    bottom: -38,
    height: 180,
    justifyContent: "center",
    left: 10,
    position: "absolute",
    width: 160,
    zIndex: 4,
    elevation: 4
  },
  mascotImage: {
    width: "100%",
    height: "100%"
  },
  speechBubbleWrap: {
    left: 136,
    minWidth: 0,
    overflow: "visible",
    position: "absolute",
    right: 12,
    top: 18,
    zIndex: 6,
    elevation: 6
  },
  speechBubble: {
    backgroundColor: colors.white,
    borderColor: colors.ink,
    borderRadius: 18,
    borderTopLeftRadius: 8,
    borderWidth: 1.5,
    elevation: 4,
    maxWidth: "100%",
    minWidth: 0,
    paddingHorizontal: 15,
    paddingVertical: 12,
    position: "relative",
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    zIndex: 2
  },
  speechBubbleTailBorder: {
    borderBottomColor: "transparent",
    borderBottomWidth: 13,
    borderRightColor: colors.ink,
    borderRightWidth: 18,
    borderTopColor: "transparent",
    borderTopWidth: 13,
    height: 0,
    left: -18,
    position: "absolute",
    top: 44,
    width: 0,
    zIndex: 1
  },
  speechBubbleTail: {
    borderBottomColor: "transparent",
    borderBottomWidth: 11,
    borderRightColor: colors.white,
    borderRightWidth: 16,
    borderTopColor: "transparent",
    borderTopWidth: 11,
    height: 0,
    left: -14,
    position: "absolute",
    top: 46,
    width: 0,
    zIndex: 3
  },
  hakiName: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  subtitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
    marginBottom: 4,
    textTransform: "uppercase"
  },
  speechScroll: {
    flexShrink: 1,
    maxWidth: "100%",
    maxHeight: 132
  },
  speechScrollContent: {
    paddingRight: 4
  },
  speechText: {
    color: colors.ink,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18
  },
  messageStrong: {
    color: colors.maroon,
    fontWeight: "800"
  }
});
