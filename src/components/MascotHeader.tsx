import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { AdminUnlockModal } from "./AdminUnlockModal";
import { mascotImages, mascotTurnaroundImage, type MascotStatus } from "./mascot/mascotConfig";
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
    showAdminModal,
    turnaroundVisible
  } = useMascotInteraction({ message, onAdminRequest: onMascotPress, status });
  const mascotSource = turnaroundVisible ? mascotTurnaroundImage : mascotImages[resolvedStatus] ?? mascotImages.idle;

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
        <Animated.View style={[styles.speechBubbleWrap, { transform: [{ scale: bubbleScale }] }]}>
          <View style={styles.speechBubble}>
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
    borderColor: colors.maroonSoft,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 3,
    maxWidth: "100%",
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: "relative",
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
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
