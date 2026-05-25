import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react-native";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import type { ChatRole } from "@/types/search";

const ROLE_OPTIONS: Array<{ description: string; label: string; requiresModel: boolean; value: ChatRole }> = [
  {
    label: "Haki",
    description: "Handles campus information, supportive guidance, and general facts. Campus answers always come from saved sources.",
    requiresModel: false,
    value: "haki"
  },
  {
    label: "Information Officer",
    description: "Answers only from saved campus information. Missing details can be reported to Haki's admin.",
    requiresModel: false,
    value: "information_officer"
  },
  {
    label: "Friendly Buddy",
    description: "Offers empathetic personal support only. It is not a therapist and does not provide campus facts.",
    requiresModel: true,
    value: "friendly_buddy"
  },
  {
    label: "Researcher",
    description: "Discusses non-campus facts using local AI. Always verify important information because Haki can make mistakes.",
    requiresModel: true,
    value: "researcher"
  }
];

interface ChatRoleSelectorProps {
  disabled: boolean;
  modesAvailable: boolean;
  notice?: string | null;
  onChange: (role: ChatRole) => void;
  onClose: () => void;
  onOpenModels: () => void;
  value: ChatRole;
}

export function ChatRoleSelector({
  disabled,
  modesAvailable,
  notice,
  onChange,
  onClose,
  onOpenModels,
  value
}: ChatRoleSelectorProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const slide = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { duration: 170, toValue: 1, useNativeDriver: true }),
      Animated.spring(scale, { friction: 8, tension: 150, toValue: 1, useNativeDriver: true }),
      Animated.spring(slide, { friction: 9, tension: 145, toValue: 0, useNativeDriver: true })
    ]).start();
  }, [opacity, scale, slide]);

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, transform: [{ translateY: slide }, { scale }] }
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>How Haki helps</Text>
          <Text style={styles.helper}>Select how Haki responds.</Text>
        </View>
        <Pressable accessibilityLabel="Close answer mode menu" onPress={onClose} style={styles.closeButton}>
          <X color={colors.muted} size={16} />
        </Pressable>
      </View>
      <View style={styles.optionList}>
        {ROLE_OPTIONS.map((role) => {
          const selected = value === role.value;
          const optionDisabled = disabled || (role.requiresModel && !modesAvailable);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: optionDisabled, selected }}
              disabled={optionDisabled}
              key={role.value}
              onPress={() => onChange(role.value)}
              style={({ pressed }) => [
                styles.option,
                selected ? styles.optionSelected : undefined,
                optionDisabled ? styles.optionDisabled : undefined,
                pressed && !optionDisabled ? styles.optionPressed : undefined
              ]}
            >
              <View style={styles.optionCopy}>
                <Text style={[styles.optionText, selected ? styles.optionTextSelected : undefined]}>{role.label}</Text>
                <Text style={[styles.optionDescription, selected ? styles.optionDescriptionSelected : undefined]}>
                  {role.description}
                </Text>
              </View>
              {selected ? <Check color={colors.white} size={16} strokeWidth={3} /> : null}
            </Pressable>
          );
        })}
      </View>
      {!modesAvailable ? (
        <View style={styles.availabilityRow}>
          <Text style={styles.availabilityText}>Saved campus information is active. Download a chat model to unlock Friendly Buddy and Researcher.</Text>
          <Pressable accessibilityRole="button" onPress={onOpenModels}>
            <Text style={styles.modelsLink}>Set up chat model</Text>
          </Pressable>
        </View>
      ) : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  availabilityRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 6
  },
  availabilityText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600"
  },
  container: {
    backgroundColor: colors.white,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 8,
    gap: 9,
    padding: 12,
    shadowColor: "#000000",
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  label: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  helper: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2
  },
  closeButton: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    width: 28
  },
  modelsLink: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: "900",
    textDecorationLine: "underline"
  },
  notice: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6
  },
  option: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  optionDisabled: {
    opacity: 0.45
  },
  optionPressed: {
    opacity: 0.8
  },
  optionList: {
    gap: 6
  },
  optionSelected: {
    backgroundColor: colors.maroon,
    borderColor: colors.maroon
  },
  optionText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700"
  },
  optionTextSelected: { color: colors.white },
  optionCopy: { flex: 1, gap: 2, paddingRight: 6 },
  optionDescription: { color: colors.muted, fontSize: 10, fontWeight: "600", lineHeight: 14 },
  optionDescriptionSelected: { color: "rgba(255, 255, 255, 0.86)" }
});
