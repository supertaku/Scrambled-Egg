import { useCallback } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";

import { HakiMascotCompat } from "@/mascot";
import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/themes";
import { hapticTap } from "@/utils/haptics";
import { AdminUnlockModal } from "./AdminUnlockModal";
import type { MascotStatus } from "./mascot/mascotConfig";
import { useMascotInteraction } from "./mascot/useMascotInteraction";

export type { MascotStatus } from "./mascot/mascotConfig";

interface MascotHeaderProps {
  isTrivia?: boolean;
  message?: string;
  onMascotPress?: () => void;
  subtitle?: string;
  status?: MascotStatus;
  useSpriteSheet?: boolean;
}

export function MascotHeader({
  isTrivia = false,
  message,
  onMascotPress,
  subtitle,
  status = "idle",
  useSpriteSheet = false
}: MascotHeaderProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const interactionVisible = useIsFocused();
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
  } = useMascotInteraction({ interactionVisible, message, onAdminRequest: onMascotPress, status });
  const showTriviaLabel = isTrivia && resolvedMessage === message;
  const compactDialogue = resolvedStatus === "sleepy" && Boolean(resolvedMessage);

  const handlePressWithReaction = useCallback(() => {
    hapticTap();
    handleMascotPress();
  }, [handleMascotPress]);

  return (
    <View style={styles.container}>
      <AdminUnlockModal onClose={closeAdminModal} visible={showAdminModal} />
      <Pressable
        accessibilityLabel={`Haki mascot (${resolvedStatus})`}
        accessibilityRole="button"
        disabled={isGroggy}
        onLongPress={handleMascotLongPress}
        onPress={handlePressWithReaction}
        delayLongPress={450}
        style={styles.mascotWrap}
      >
        <Animated.View style={[styles.mascotImage, { transform: imageTransform }]}>
          <HakiMascotCompat
            animated={interactionVisible}
            externalFloat
            height={178}
            status={resolvedStatus}
          />
        </Animated.View>
      </Pressable>

      {resolvedMessage ? (
        <Animated.View style={[styles.speechBubbleWrap, compactDialogue ? styles.compactBubbleWrap : undefined, { transform: [{ scale: bubbleScale }] }]}>
          <View style={[styles.speechBubble, compactDialogue ? styles.compactBubble : undefined]}>
            <View pointerEvents="none" style={[styles.speechBubbleTailBorder, compactDialogue ? styles.compactTailBorder : undefined]} />
            <View pointerEvents="none" style={[styles.speechBubbleTail, compactDialogue ? styles.compactTail : undefined]} />
            <Text style={styles.hakiName}>Haki</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            <ScrollView
              style={styles.speechScroll}
              contentContainerStyle={styles.speechScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {showTriviaLabel ? <Text style={styles.triviaLabel}>Did you know?</Text> : null}
              <Text selectable style={styles.speechText}>{resolvedMessage}</Text>
            </ScrollView>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
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
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    width: "100%"
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
    backgroundColor: colors.card,
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
  compactBubbleWrap: {
    top: 45
  },
  compactBubble: {
    paddingVertical: 10
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
  compactTailBorder: {
    top: 24
  },
  compactTail: {
    top: 26
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
  triviaLabel: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
});
