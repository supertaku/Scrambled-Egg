import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import type { ConfidenceLevel } from "@/types/search";

interface ConfidenceBadgeProps {
  confidence: ConfidenceLevel;
}

const labelMap: Record<ConfidenceLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low"
};

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const tone = styles[confidence];

  return (
    <View style={[styles.badge, tone]}>
      <Text style={[styles.text, confidence === "low" ? styles.lowText : undefined]}>
        {labelMap[confidence]} confidence
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  text: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700"
  },
  lowText: {
    color: colors.ink
  },
  high: {
    backgroundColor: colors.success
  },
  medium: {
    backgroundColor: colors.warning
  },
  low: {
    backgroundColor: colors.goldSoft
  }
});
