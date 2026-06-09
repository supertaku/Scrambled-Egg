import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors } from "@/theme/colors";

export function ModelActionButton({
  disabled,
  icon,
  inProgress,
  label,
  onPress,
  secondary
}: {
  disabled?: boolean;
  icon: ReactNode;
  inProgress?: boolean;
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary ? styles.secondaryButton : undefined,
        inProgress ? styles.inProgressButton : undefined,
        disabled && !inProgress ? styles.disabled : undefined
      ]}
    >
      {icon}
      <Text style={[styles.buttonText, secondary ? styles.secondaryButtonText : undefined, inProgress ? styles.inProgressButtonText : undefined]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.maroon, borderRadius: 10, flexDirection: "row", gap: 7, minHeight: 40, paddingHorizontal: 13, paddingVertical: 9 },
  buttonText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  inProgressButton: { backgroundColor: colors.goldSoft, borderColor: colors.gold, borderWidth: 1 },
  inProgressButtonText: { color: colors.maroonDark },
  secondaryButton: { backgroundColor: colors.white, borderColor: colors.maroon, borderWidth: 1 },
  secondaryButtonText: { color: colors.maroon }
});
