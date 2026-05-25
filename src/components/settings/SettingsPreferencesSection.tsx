import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { colors } from "@/theme/colors";

export function SettingsPreferencesSection({
  autoSendVoice,
  clearingMemory,
  onClearChatMemory,
  onToggleAutoSendVoice,
  onToggleUseProfileContext,
  onToggleUseRelatedHistory,
  useProfileContext,
  useRelatedHistory
}: {
  autoSendVoice: boolean;
  clearingMemory?: boolean;
  onClearChatMemory?: () => void;
  onToggleAutoSendVoice: (value: boolean) => void;
  onToggleUseProfileContext: (value: boolean) => void;
  onToggleUseRelatedHistory: (value: boolean) => void;
  useProfileContext: boolean;
  useRelatedHistory: boolean;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Chat Preferences</Text>
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>Auto-send voice messages</Text>
          <Text selectable style={styles.settingDesc}>
            When on, your voice message will automatically send after you finish speaking.
          </Text>
        </View>
        <Switch
          onValueChange={onToggleAutoSendVoice}
          thumbColor={autoSendVoice ? colors.maroon : colors.white}
          trackColor={{ false: colors.border, true: colors.maroonSoft }}
          value={autoSendVoice}
        />
      </View>
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>Use my profile in answers</Text>
          <Text selectable style={styles.settingDesc}>
            When on, Haki can locally use the profile details you saved on this phone.
          </Text>
        </View>
        <Switch
          onValueChange={onToggleUseProfileContext}
          thumbColor={useProfileContext ? colors.maroon : colors.white}
          trackColor={{ false: colors.border, true: colors.maroonSoft }}
          value={useProfileContext}
        />
      </View>
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>Use related previous chats</Text>
          <Text selectable style={styles.settingDesc}>
            When on, Haki can locally reuse related remembered replies for continuity.
          </Text>
        </View>
        <Switch
          onValueChange={onToggleUseRelatedHistory}
          thumbColor={useRelatedHistory ? colors.maroon : colors.white}
          trackColor={{ false: colors.border, true: colors.maroonSoft }}
          value={useRelatedHistory}
        />
      </View>
      <Text selectable style={styles.privacyNote}>
        Device compatibility checks stay on this phone. Shake-to-dizzy reads motion only while interactive Haki is visible and the app is active; motion readings are not saved or sent.
      </Text>
      {onClearChatMemory ? (
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Clear recent chat activity</Text>
            <Text selectable style={styles.settingDesc}>
              Removes recent questions and remembered replies from this phone.
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Clear recent chat activity"
            accessibilityRole="button"
            disabled={clearingMemory}
            onPress={onClearChatMemory}
            style={({ pressed }) => [
              styles.clearButton,
              clearingMemory ? styles.clearButtonDisabled : undefined,
              pressed ? styles.clearButtonPressed : undefined
            ]}
          >
            <Text style={styles.clearButtonText}>{clearingMemory ? "Clearing" : "Clear"}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginHorizontal: 18,
    padding: 16
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  settingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8
  },
  settingInfo: {
    flex: 1,
    paddingRight: 16
  },
  settingLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4
  },
  settingDesc: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16
  },
  privacyNote: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    padding: 10
  },
  clearButton: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderColor: "#FDA29B",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 14
  },
  clearButtonDisabled: {
    opacity: 0.55
  },
  clearButtonPressed: {
    opacity: 0.7
  },
  clearButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "900"
  }
});
