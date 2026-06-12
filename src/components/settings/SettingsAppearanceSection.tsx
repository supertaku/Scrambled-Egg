import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Moon, Smartphone, SunMedium } from "lucide-react-native";

import { useTheme } from "@/theme/ThemeProvider";
import type { ThemePreference } from "@/theme/themes";
import { hapticTap, isHapticsEnabled, setHapticsEnabled } from "@/utils/haptics";

const PREFERENCE_CYCLE: ThemePreference[] = ["system", "light", "dark"];

const PREFERENCE_LABEL: Record<ThemePreference, string> = {
  dark: "Dark",
  light: "Light",
  system: "Auto"
};

export function SettingsAppearanceSection() {
  const { preference, setPreference, theme } = useTheme();
  const { colors } = theme;
  const [haptics, setHapticsState] = useState(isHapticsEnabled());

  const cycleTheme = () => {
    hapticTap();
    const index = PREFERENCE_CYCLE.indexOf(preference);
    const next = PREFERENCE_CYCLE[(index + 1) % PREFERENCE_CYCLE.length] ?? "system";
    setPreference(next);
  };

  const ThemeIcon = preference === "dark" ? Moon : preference === "light" ? SunMedium : Smartphone;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.switchRow}>
        <View style={styles.switchInfo}>
          <Text style={[styles.subTitle, { color: colors.textPrimary }]}>Theme</Text>
          <Text selectable style={[styles.description, { color: colors.textSecondary }]}>
            {preference === "system"
              ? "Following your phone's light or dark setting."
              : `${PREFERENCE_LABEL[preference]} mode.`}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={`Theme: ${PREFERENCE_LABEL[preference]}. Tap to change.`}
          accessibilityRole="button"
          onPress={cycleTheme}
          style={[styles.iconToggle, { backgroundColor: colors.maroonSoft, borderColor: colors.maroon }]}
        >
          <ThemeIcon color={colors.maroon} size={20} />
        </Pressable>
      </View>
      <View style={styles.switchRow}>
        <View style={styles.switchInfo}>
          <Text style={[styles.subTitle, { color: colors.textPrimary }]}>Touch feedback</Text>
          <Text selectable style={[styles.description, { color: colors.textSecondary }]}>
            Gentle vibrations when you tap Haki, switch tabs, or finish an action.
          </Text>
        </View>
        <Switch
          onValueChange={(value) => {
            setHapticsState(value);
            setHapticsEnabled(value);
          }}
          thumbColor={haptics ? colors.maroon : colors.white}
          trackColor={{ false: colors.border, true: colors.maroonSoft }}
          value={haptics}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginHorizontal: 18,
    padding: 16
  },
  subTitle: {
    fontSize: 15,
    fontWeight: "700"
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4
  },
  iconToggle: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1.5,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  switchInfo: {
    flex: 1,
    gap: 2,
    paddingRight: 16
  }
});
