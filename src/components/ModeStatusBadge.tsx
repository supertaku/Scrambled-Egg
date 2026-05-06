import { Cpu, Database } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";

interface ModeStatusBadgeProps {
  label: string;
  compact?: boolean;
}

export function ModeStatusBadge({ label, compact = false }: ModeStatusBadgeProps) {
  const isAI = label.includes("AI");
  const Icon = isAI ? Cpu : Database;

  return (
    <View style={[styles.badge, isAI ? styles.aiBadge : styles.sourceBadge, compact ? styles.compact : undefined]}>
      <Icon color={isAI ? colors.maroon : colors.grayhawkDark} size={compact ? 13 : 15} />
      <Text style={[styles.text, compact ? styles.compactText : undefined]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  aiBadge: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold
  },
  sourceBadge: {
    backgroundColor: colors.white,
    borderColor: colors.border
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  text: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800"
  },
  compactText: {
    fontSize: 11
  }
});
