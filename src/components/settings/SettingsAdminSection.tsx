import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { RefreshCw, ShieldCheck } from "lucide-react-native";

import { ModeStatusBadge } from "@/components/ModeStatusBadge";
import type { DeviceCapabilityReport } from "@/ai/CapabilityDetector";
import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import { colors } from "@/theme/colors";

function formatGB(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not reported" : `${value.toFixed(1)}GB`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function SettingsAdminSection({
  activeMode,
  capabilityReport,
  onRefreshCapabilities,
  refreshingCapabilities
}: {
  activeMode: DeviceAIMode | null;
  capabilityReport: DeviceCapabilityReport | null;
  onRefreshCapabilities: () => void;
  refreshingCapabilities: boolean;
}) {
  return (
    <View style={styles.card}>
      <ShieldCheck color={colors.maroon} size={24} />
      <Text style={styles.cardTitle}>Admin settings</Text>
      <Text style={styles.cardText}>
        Re-check this phone before choosing a larger downloadable GGUF. Haki reads Android ABI, RAM, app heap,
        low-memory state, and free storage for model recommendations.
      </Text>
      {activeMode ? <ModeStatusBadge label={activeMode.label} /> : null}
      <View style={styles.statsGrid}>
        <Stat label="Detected ABI" value={capabilityReport?.architecture ?? "Not reported"} />
        <Stat label="Supported ABIs" value={capabilityReport?.supportedAbis.join(", ") || "Not reported"} />
        <Stat label="Total RAM" value={formatGB(capabilityReport?.memoryGB)} />
        <Stat label="App heap class" value={capabilityReport?.memoryClass ?? "Not reported"} />
        <Stat
          label="Low-memory state"
          value={
            capabilityReport?.lowMemory === null || capabilityReport?.lowMemory === undefined
              ? "Not reported"
              : capabilityReport.lowMemory
                ? "Yes"
                : "No"
          }
        />
        <Stat label="Free storage" value={formatGB(capabilityReport?.freeStorageGB)} />
        <Stat label="Recommended GGUF tier" value={capabilityReport?.recommendedModelTier ?? "unknown"} />
        <Stat label="Last capability check" value={capabilityReport?.lastCheckedAt ?? "Not checked"} />
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={refreshingCapabilities}
        onPress={onRefreshCapabilities}
        style={[styles.refreshButton, refreshingCapabilities ? styles.disabledButton : undefined]}
      >
        {refreshingCapabilities ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <RefreshCw color={colors.white} size={16} />
        )}
        <Text style={styles.refreshButtonText}>{refreshingCapabilities ? "Checking..." : "Re-check device capability"}</Text>
      </Pressable>
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
  cardText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21
  },
  statsGrid: {
    gap: 8
  },
  stat: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  statValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 3
  },
  refreshButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.maroon,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  refreshButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900"
  },
  disabledButton: {
    backgroundColor: colors.grayhawk
  }
});
