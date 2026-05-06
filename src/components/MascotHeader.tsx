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
          style={[styles.mascotImage, { transform: imageTransform }]} 
          resizeMode="contain"
        />
      </Pressable>

      {resolvedMessage ? (
        <Animated.View style={[styles.cloudBubbleWrap, { transform: [{ scale: bubbleScale }] }]}>
          <View style={styles.cloudBubbleShadow}>
            <View style={[styles.cloudPuff, styles.cloudPuffTopLeft]} />
            <View style={[styles.cloudPuff, styles.cloudPuffTopCenter]} />
            <View style={[styles.cloudPuff, styles.cloudPuffTopRight]} />
            <View style={[styles.cloudPuff, styles.cloudPuffBottomRight]} />
            <View style={[styles.cloudTrailPuff, styles.cloudTrailLarge]} />
            <View style={[styles.cloudTrailPuff, styles.cloudTrailSmall]} />
          </View>
          <View style={styles.cloudBubble}>
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
  cloudBubbleWrap: {
    left: 136,
    minWidth: 0,
    overflow: "visible",
    position: "absolute",
    right: 12,
    top: 18,
    zIndex: 6,
    elevation: 6
  },
  cloudBubbleShadow: {
    backgroundColor: colors.white,
    borderRadius: 28,
    bottom: 0,
    elevation: 3,
    left: 0,
    overflow: "visible",
    position: "absolute",
    right: 0,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    top: 0
  },
  cloudPuff: {
    backgroundColor: colors.white,
    borderColor: colors.maroonSoft,
    borderRadius: 999,
    borderWidth: 1,
    position: "absolute"
  },
  cloudPuffTopLeft: {
    height: 42,
    left: 18,
    top: -13,
    width: 42
  },
  cloudPuffTopCenter: {
    height: 54,
    left: 58,
    top: -20,
    width: 54
  },
  cloudPuffTopRight: {
    height: 46,
    right: 22,
    top: -14,
    width: 46
  },
  cloudPuffBottomRight: {
    bottom: -9,
    height: 36,
    right: 44,
    width: 36
  },
  cloudTrailPuff: {
    backgroundColor: colors.white,
    borderColor: colors.maroonSoft,
    borderRadius: 999,
    borderWidth: 1,
    position: "absolute"
  },
  cloudTrailLarge: {
    height: 22,
    left: -15,
    top: 48,
    width: 22
  },
  cloudTrailSmall: {
    height: 12,
    left: -31,
    top: 62,
    width: 12
  },
  cloudBubble: {
    backgroundColor: colors.white,
    borderColor: colors.maroonSoft,
    borderRadius: 28,
    borderWidth: 1,
    maxWidth: "100%",
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: "relative",
    zIndex: 2
  },
  hakiName: {
    color: colors.maroon,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
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
