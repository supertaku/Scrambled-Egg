import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { HakiMascot } from "../mascot/HakiMascot";
import type { HakiActivity } from "../mascot/hakiMascotState";

function activityForStep(step: number): HakiActivity {
  if (step >= 5) return "success";
  return "onboarding";
}

interface OnboardingHakiProps {
  message: string;
  reducedMotion: boolean;
  replayKey: number;
  step: number;
  onPress: () => void;
}

export function OnboardingHaki({ message, reducedMotion, replayKey, step, onPress }: OnboardingHakiProps) {
  return (
    <View style={styles.container}>
      <View style={styles.mascot}>
        <HakiMascot
          activity={activityForStep(step)}
          event={replayKey > 0 ? "attention" : undefined}
          eventKey={replayKey}
          interactionMode="compact"
          onInteraction={(event) => {
            if (event === "tap") onPress();
          }}
          placement="onboarding"
          reducedMotion={reducedMotion}
          size={184}
        />
      </View>
      <View style={styles.bubble}>
        <View style={styles.tail} />
        <Text style={styles.name}>Haki</Text>
        <Text selectable style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", height: 272, justifyContent: "flex-end", marginBottom: 12, position: "relative" },
  mascot: { alignItems: "center", bottom: 0, height: 224, justifyContent: "center", left: 2, position: "absolute", width: 184 },
  bubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.white,
    borderColor: colors.borderStrong,
    borderRadius: 18,
    borderTopLeftRadius: 8,
    borderWidth: 1,
    marginBottom: 64,
    marginRight: 8,
    maxWidth: "61%",
    minHeight: 74,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10
  },
  tail: { backgroundColor: colors.white, borderBottomColor: colors.borderStrong, borderLeftColor: colors.borderStrong, borderBottomWidth: 1, borderLeftWidth: 1, height: 14, left: -8, position: "absolute", top: 32, transform: [{ rotate: "45deg" }], width: 14 },
  name: { color: colors.maroon, fontSize: 10, fontWeight: "900", letterSpacing: 0.8, marginBottom: 4, textTransform: "uppercase" },
  message: { color: colors.ink, fontSize: 13, fontWeight: "600", lineHeight: 18 }
});
