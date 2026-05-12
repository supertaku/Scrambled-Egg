import { StyleSheet, Switch, Text, View } from "react-native";

import { colors } from "@/theme/colors";

export function SettingsPreferencesSection({
  autoSendVoice,
  onToggleAutoSendVoice
}: {
  autoSendVoice: boolean;
  onToggleAutoSendVoice: (value: boolean) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Chat Preferences</Text>
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>Auto-send voice messages</Text>
          <Text style={styles.settingDesc}>
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
  }
});
