import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";

import { subscribeModelOperation, type ModelOperationState } from "@/ai/localModelManager";
import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/themes";

function badgeText(operation: ModelOperationState): string {
  if (operation.phase === "queued") return "Chat download queued";
  if (operation.phase === "downloading") return `Chat download ${Math.round((operation.progress ?? 0) * 100)}%`;
  if (operation.phase === "paused") return "Chat download paused";
  if (operation.phase === "verifying") return "Checking download";
  if (operation.phase === "validating") return "Checking download";
  if (operation.phase === "optimizing") return "Optimizing local AI";
  if (operation.phase === "waiting_for_chat") return "Change waiting";
  if (operation.phase === "activating") return "Getting chat ready";
  if (operation.phase === "removing") return "Removing download";
  return "";
}

export function ModelOperationBadge() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [operation, setOperation] = useState<ModelOperationState | null>(null);

  useEffect(() => subscribeModelOperation(setOperation), []);

  if (!operation || ["completed", "failed", "canceled"].includes(operation.phase)) return null;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Open chat download progress" onPress={() => router.push("/models" as never)} style={styles.badge}>
      <Text style={styles.text}>{badgeText(operation)}</Text>
    </Pressable>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  badge: {
    alignSelf: "center",
    backgroundColor: colors.maroon,
    borderRadius: 999,
    bottom: 98,
    elevation: 35,
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: "absolute",
    shadowColor: colors.maroon,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    zIndex: 35
  },
  text: { color: colors.white, fontSize: 12, fontWeight: "900" }
});
