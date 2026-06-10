import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { HakiMascot } from "./mascot/HakiMascot";

interface HakiTabPopupProps {
  message: string | null;
  onDismiss?: () => void;
  visibleKey: number;
}

export function HakiTabPopup({ message, onDismiss, visibleKey }: HakiTabPopupProps) {
  const [renderedMessage, setRenderedMessage] = useState<string | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message || visibleKey === 0) return;
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setRenderedMessage(message);
    dismissTimer.current = setTimeout(() => {
      setRenderedMessage(null);
      onDismiss?.();
    }, 4200);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [message, onDismiss, visibleKey]);

  if (!renderedMessage) return null;
  const dismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setRenderedMessage(null);
    onDismiss?.();
  };

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View pointerEvents="box-none" style={styles.popup}>
        <HakiMascot
          activity="exploring"
          interactionMode="compact"
          onInteraction={(event) => {
            if (event === "tap") dismiss();
          }}
          placement="tabPopup"
          size={180}
          style={styles.hakiImage}
        />
        <View style={styles.bubbleWrap}>
          <Pressable accessibilityRole="button" onPress={dismiss} style={styles.speechBubble}>
            <View pointerEvents="none" style={styles.speechBubbleTailBorder} />
            <View pointerEvents="none" style={styles.speechBubbleTail} />
            <Text style={styles.hakiName}>Haki</Text>
            <Text selectable style={styles.message}>{renderedMessage}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { bottom: 72, elevation: 50, left: 0, position: "absolute", right: 0, zIndex: 50 },
  popup: { alignItems: "flex-end", flexDirection: "row", minHeight: 220, paddingHorizontal: 8 },
  hakiImage: { marginRight: -18, zIndex: 2 },
  bubbleWrap: { flexShrink: 1, marginBottom: 48 },
  speechBubble: { backgroundColor: colors.white, borderColor: "#D0D5DD", borderRadius: 20, borderTopLeftRadius: 8, borderWidth: 1.5, elevation: 10, flexShrink: 1, maxWidth: 274, minHeight: 76, paddingHorizontal: 18, paddingVertical: 14, position: "relative", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 14 },
  speechBubbleTailBorder: { borderBottomColor: "transparent", borderBottomWidth: 12, borderRightColor: "#D0D5DD", borderRightWidth: 17, borderTopColor: "transparent", borderTopWidth: 12, height: 0, left: -17, position: "absolute", top: 24, width: 0, zIndex: 1 },
  speechBubbleTail: { borderBottomColor: "transparent", borderBottomWidth: 10, borderRightColor: colors.white, borderRightWidth: 15, borderTopColor: "transparent", borderTopWidth: 10, height: 0, left: -13, position: "absolute", top: 26, width: 0, zIndex: 2 },
  hakiName: { color: colors.maroon, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, marginBottom: 4, textTransform: "uppercase" },
  message: { color: colors.ink, fontSize: 15, fontWeight: "700", lineHeight: 21 }
});
