import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown, ChevronRight, Cpu } from "lucide-react-native";

import type { DeviceCapabilityReport, ProviderCapabilityReport } from "@/ai/CapabilityDetector";
import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import { colors } from "@/theme/colors";

function formatMs(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not reported" : `${Math.round(value)}ms`;
}

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

function ProviderMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.providerMeta}>
      <Text style={styles.providerMetaLabel}>{label}</Text>
      <Text style={styles.providerMetaValue}>{value}</Text>
    </View>
  );
}

function ActiveLocalStatus({
  activeMode,
  capabilityReport
}: {
  activeMode: DeviceAIMode | null;
  capabilityReport: DeviceCapabilityReport | null;
}) {
  if (!activeMode) {
    return <Text style={styles.cardText}>No active local AI mode detected yet.</Text>;
  }

  const capabilities = activeMode.capabilities;
  const readiness = capabilities.safeChat ? "Safe chat ready" : capabilities.summary ? "Summary ready" : "Fallback mode";
  const modelName = capabilities.modelName ?? activeMode.summaryProviderName ?? activeMode.label;

  return (
    <View style={styles.activeStatusStack}>
      <View style={styles.activeStatusHero}>
        <Text style={styles.activeStatusEyebrow}>{readiness}</Text>
        <Text style={styles.activeStatusTitle}>{modelName}</Text>
        <Text style={styles.activeStatusMeta}>
          {activeMode.label} - tier {capabilities.modelTier ?? "unknown"} - recommended{" "}
          {capabilityReport?.recommendedModelTier ?? capabilities.recommendedModelTier ?? "unknown"}
        </Text>
        <Text style={styles.modeExplanation}>
          {capabilities.safeChat
            ? "Campus facts are retrieved offline from the saved guide; answers can be synthesized on-device when safe chat shows as available above."
            : "Without local safe chat, answers use offline FTS search over the saved campus guide only—summaries and conversational replies need an activated on-device model (see provider list below)."}
        </Text>
      </View>
      <View style={styles.statusPriorityGrid}>
        <Stat label="Safe chat" value={capabilities.safeChat ? "Available" : "Unavailable"} />
        <Stat label="Streaming" value={capabilities.streamingSupported ? "Supported" : "Unavailable"} />
        <Stat label="Context window" value={capabilities.contextWindowTokens ?? "Not reported"} />
      </View>
      <View style={styles.providerMetaGrid}>
        <ProviderMeta label="Platform" value={`${capabilityReport?.platform ?? activeMode.platform} ${capabilityReport?.osVersion ?? activeMode.platformVersion}`} />
        <ProviderMeta label="ABI" value={capabilities.architecture ?? capabilityReport?.architecture ?? "Not reported"} />
        <ProviderMeta label="RAM" value={formatGB(capabilities.memoryGB ?? capabilityReport?.memoryGB)} />
        <ProviderMeta label="Free storage" value={formatGB(capabilities.freeStorageGB ?? capabilityReport?.freeStorageGB)} />
        <ProviderMeta label="Summary" value={capabilities.summary ? "Available" : "Unavailable"} />
        <ProviderMeta label="Embeddings" value={capabilities.embeddings ? "Available" : "Unavailable"} />
        <ProviderMeta label="Bridge" value={capabilities.bridgePresent ? "Present" : "Missing"} />
        <ProviderMeta label="FTS5" value={capabilityReport?.baseFtsAvailable ? "Available" : "Unavailable"} />
        <ProviderMeta label="Parameters" value={capabilities.modelParameterCountB ? `${capabilities.modelParameterCountB}B` : "Not active"} />
        <ProviderMeta label="Quantization" value={capabilities.modelQuantization ?? "Not active"} />
        <ProviderMeta label="Load time" value={formatMs(capabilities.modelLoadTimeMs)} />
        <ProviderMeta label="Last inference" value={formatMs(capabilities.lastInferenceTimeMs)} />
        <ProviderMeta label="Asset path" value={capabilities.modelAssetPath ?? "Not reported"} />
        <ProviderMeta label="Checked" value={capabilityReport?.lastCheckedAt ?? activeMode.detectedAt} />
      </View>
    </View>
  );
}

function ProviderStatus({
  expanded,
  onToggle,
  provider
}: {
  expanded: boolean;
  onToggle: () => void;
  provider: ProviderCapabilityReport;
}) {
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <View style={styles.providerCard}>
      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.providerHeader}>
        <ChevronIcon color={colors.maroon} size={18} />
        <Text style={styles.providerName}>{provider.name}</Text>
        <Text style={[styles.providerBadge, provider.available ? styles.availableBadge : styles.unavailableBadge]}>
          {provider.available ? "Available" : "Unavailable"}
        </Text>
      </Pressable>
      {expanded ? (
        <>
          <View style={styles.providerMetaGrid}>
            <ProviderMeta label="Bridge" value={provider.bridgePresent ? "Present" : "Missing"} />
            <ProviderMeta label="Runtime" value={provider.runtimeAvailable ? "Yes" : "No"} />
            <ProviderMeta label="Summary" value={provider.summaryAvailable ? "Yes" : "No"} />
            <ProviderMeta label="Safe chat" value={provider.safeChatAvailable ? "Yes" : "No"} />
            <ProviderMeta label="Streaming" value={provider.streamingSupported ? "Yes" : "No"} />
            <ProviderMeta label="Embeddings" value={provider.embeddingsAvailable ? "Yes" : "No"} />
            <ProviderMeta label="Model assets" value={provider.modelAssetsAvailable === null ? "Unknown" : provider.modelAssetsAvailable ? "Yes" : "No"} />
            <ProviderMeta label="Model" value={provider.modelName ?? "None"} />
            <ProviderMeta label="Asset path" value={provider.modelAssetPath ?? "None"} />
            <ProviderMeta label="Manifest" value={provider.modelManifestPath ?? "None"} />
            <ProviderMeta label="Import" value={provider.modelImportStatus ?? "None"} />
            <ProviderMeta label="Hash" value={provider.modelFileHash ? provider.modelFileHash.slice(0, 12) : "None"} />
            <ProviderMeta label="Load time" value={formatMs(provider.modelLoadTimeMs)} />
            <ProviderMeta label="Last inference" value={formatMs(provider.lastInferenceTimeMs)} />
            <ProviderMeta label="Active tier" value={provider.modelTier} />
            <ProviderMeta label="Recommended tier" value={provider.recommendedModelTier} />
            <ProviderMeta label="Model size" value={provider.modelParameterCountB ? `${provider.modelParameterCountB}B` : "None"} />
            <ProviderMeta label="Quantization" value={provider.modelQuantization ?? "None"} />
            <ProviderMeta label="ABI" value={provider.architecture ?? "Not reported"} />
            <ProviderMeta label="RAM" value={provider.memoryGB !== null ? `${provider.memoryGB.toFixed(1)}GB` : provider.memoryClass ?? "Not exposed"} />
            <ProviderMeta label="Free storage" value={provider.freeStorageGB !== null ? `${provider.freeStorageGB.toFixed(1)}GB` : "Not reported"} />
            <ProviderMeta label="Device class" value={provider.approximateDeviceCapability} />
            <ProviderMeta label="Memory" value={provider.memoryClass ?? "Not exposed"} />
          </View>
          {provider.unavailableReasons.slice(0, 3).map((reason) => (
            <Text key={reason} style={styles.providerReason}>
              {reason}
            </Text>
          ))}
          {provider.modelRejectionReasons.slice(0, 3).map((reason) => (
            <Text key={`model-${reason}`} style={styles.providerReason}>
              {reason}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

export function SettingsCapabilitySection({
  activeMode,
  capabilityReport,
  error,
  expandedProviders,
  loading,
  onToggleProvider
}: {
  activeMode: DeviceAIMode | null;
  capabilityReport: DeviceCapabilityReport | null;
  error: string | null;
  expandedProviders: Record<string, boolean>;
  loading: boolean;
  onToggleProvider: (providerId: string) => void;
}) {
  return (
    <>
      <View style={styles.card}>
        <Cpu color={colors.maroon} size={24} />
        <Text style={styles.cardTitle}>Active local AI status</Text>
        {loading ? (
          <ActivityIndicator color={colors.maroon} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <ActiveLocalStatus activeMode={activeMode} capabilityReport={capabilityReport} />
        )}
      </View>

      {capabilityReport ? (
        <View style={styles.card}>
          <Cpu color={colors.maroon} size={24} />
          <Text style={styles.cardTitle}>Detected local AI providers</Text>
          <View style={styles.providerList}>
            {capabilityReport.providers.map((provider) => (
              <ProviderStatus
                expanded={Boolean(expandedProviders[provider.id])}
                key={provider.id}
                onToggle={() => onToggleProvider(provider.id)}
                provider={provider}
              />
            ))}
          </View>
        </View>
      ) : null}
    </>
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
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  cardText: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  errorText: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  stat: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, padding: 10 },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  statValue: { color: colors.ink, fontSize: 14, fontWeight: "800", marginTop: 3 },
  activeStatusStack: { gap: 10 },
  activeStatusHero: { backgroundColor: colors.maroon, borderRadius: 12, gap: 5, padding: 14 },
  activeStatusEyebrow: { color: colors.goldSoft, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  activeStatusTitle: { color: colors.white, fontSize: 19, fontWeight: "900", lineHeight: 24 },
  activeStatusMeta: { color: colors.white, fontSize: 12, fontWeight: "800", lineHeight: 17, opacity: 0.9 },
  modeExplanation: { color: colors.white, fontSize: 12, fontWeight: "700", lineHeight: 17, opacity: 0.92 },
  statusPriorityGrid: { gap: 8 },
  providerList: { gap: 10 },
  providerCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1, gap: 8, padding: 12 },
  providerHeader: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  providerName: { color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" },
  providerBadge: { borderRadius: 999, fontSize: 11, fontWeight: "900", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4 },
  availableBadge: { backgroundColor: colors.success, color: colors.white },
  unavailableBadge: { backgroundColor: colors.goldSoft, color: colors.ink },
  providerMetaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  providerMeta: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 8, borderWidth: 1, minWidth: "45%", padding: 8 },
  providerMetaLabel: { color: colors.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  providerMetaValue: { color: colors.ink, fontSize: 12, fontWeight: "800", marginTop: 2 },
  providerReason: { color: colors.muted, fontSize: 12, fontWeight: "700", lineHeight: 17 }
});
