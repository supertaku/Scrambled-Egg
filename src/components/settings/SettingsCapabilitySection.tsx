import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown, ChevronRight, Cpu, RefreshCw } from "lucide-react-native";

import type { DeviceCapabilityReport, ProviderCapabilityReport } from "@/ai/CapabilityDetector";
import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import type { LocalModelEvaluationReport } from "@/ai/localModelEvaluation";
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
      <Text selectable style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ProviderMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.providerMeta}>
      <Text style={styles.providerMetaLabel}>{label}</Text>
      <Text selectable style={styles.providerMetaValue}>{value}</Text>
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
    return <Text selectable style={styles.cardText}>Haki has not finished checking chat options yet.</Text>;
  }

  const capabilities = activeMode.capabilities;
  const readiness = capabilities.safeChat ? "All Haki modes available" : "Campus Haki ready";
  const statusTitle = capabilities.safeChat ? "Friendly Haki is available" : "Campus Haki is ready";

  return (
    <View style={styles.activeStatusStack}>
      <View style={styles.activeStatusHero}>
        <Text style={styles.activeStatusEyebrow}>{readiness}</Text>
        <Text style={styles.activeStatusTitle}>{statusTitle}</Text>
        <Text selectable style={styles.activeStatusMeta}>
          Haki automatically chooses what works best on this phone.
        </Text>
        <Text selectable style={styles.modeExplanation}>
          {capabilities.safeChat
            ? "Friendly Haki and Campus Haki + Friendly Haki are unlocked. Campus facts remain source-backed."
            : "Campus Haki can answer using the saved campus guide. Download a chat model to unlock supportive modes."}
        </Text>
      </View>
      <View style={styles.statusPriorityGrid}>
        <Stat label="Conversation" value={capabilities.safeChat ? "Available" : "Guide only"} />
        <Stat label="Live replies" value={capabilities.streamingSupported ? "Available" : "Unavailable"} />
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
        <ProviderMeta label="Backend" value={capabilities.executionBackend ?? "Unknown"} />
        <ProviderMeta label="Acceleration" value={capabilities.accelerationStatus ?? "Not checked"} />
        <ProviderMeta label="Thermal" value={capabilities.thermalState ?? "Unknown"} />
        <ProviderMeta label="First token" value={formatMs(capabilities.performanceProfile?.firstTokenTimeMs)} />
        <ProviderMeta
          label="Decode rate"
          value={capabilities.performanceProfile?.decodeTokensPerSecond == null
            ? "Not reported"
            : `${capabilities.performanceProfile.decodeTokensPerSecond.toFixed(1)} tok/s`}
        />
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
            <ProviderMeta label="Backend" value={provider.executionBackend} />
            <ProviderMeta label="Acceleration" value={provider.accelerationStatus} />
            <ProviderMeta label="Thermal" value={provider.thermalState} />
            <ProviderMeta label="First token" value={formatMs(provider.performanceProfile?.firstTokenTimeMs)} />
            <ProviderMeta
              label="Decode rate"
              value={provider.performanceProfile?.decodeTokensPerSecond == null
                ? "Not reported"
                : `${provider.performanceProfile.decodeTokensPerSecond.toFixed(1)} tok/s`}
            />
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
            <Text selectable key={reason} style={styles.providerReason}>
              {reason}
            </Text>
          ))}
          {provider.modelRejectionReasons.slice(0, 3).map((reason) => (
            <Text selectable key={`model-${reason}`} style={styles.providerReason}>
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
  onRefreshCapabilities,
  onToggleProvider,
  refreshingCapabilities,
  evaluationReport,
  evaluatingModel,
  onEvaluateModel
}: {
  activeMode: DeviceAIMode | null;
  capabilityReport: DeviceCapabilityReport | null;
  error: string | null;
  expandedProviders: Record<string, boolean>;
  loading: boolean;
  onRefreshCapabilities: () => void;
  onToggleProvider: (providerId: string) => void;
  refreshingCapabilities: boolean;
  evaluationReport: LocalModelEvaluationReport | null;
  evaluatingModel: boolean;
  onEvaluateModel: () => void;
}) {
  return (
    <>
      <View style={styles.card}>
        <Cpu color={colors.maroon} size={24} />
        <Text style={styles.cardTitle}>Haki answer options</Text>
        {loading ? (
          <ActivityIndicator color={colors.maroon} />
        ) : error ? (
          <Text selectable style={styles.errorText}>{error}</Text>
        ) : (
          <ActiveLocalStatus activeMode={activeMode} capabilityReport={capabilityReport} />
        )}
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
          <Text style={styles.refreshButtonText}>{refreshingCapabilities ? "Checking..." : "Check again"}</Text>
        </Pressable>
      </View>

      {capabilityReport ? (
        <View style={styles.card}>
          <Cpu color={colors.maroon} size={24} />
          <Text style={styles.cardTitle}>Technical details for administrators</Text>
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
          <Text style={styles.cardTitle}>On-device model evaluation</Text>
          <Text selectable style={styles.cardText}>
            Runs short grounded, English-only, and ambiguity checks against the active generated-chat provider on this phone.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={evaluatingModel}
            onPress={onEvaluateModel}
            style={[styles.refreshButton, evaluatingModel ? styles.disabledButton : undefined]}
          >
            {evaluatingModel ? <ActivityIndicator color={colors.white} size="small" /> : <Cpu color={colors.white} size={16} />}
            <Text style={styles.refreshButtonText}>{evaluatingModel ? "Evaluating..." : "Evaluate active model"}</Text>
          </Pressable>
          {evaluationReport ? (
            <View style={styles.evaluationResults}>
              <Text selectable style={styles.cardText}>
                {evaluationReport.unavailableReason ??
                  `${evaluationReport.passed}/${evaluationReport.total} checks passed - ${evaluationReport.modelName ?? evaluationReport.providerName ?? "active model"}`}
              </Text>
              {evaluationReport.metrics.map((metric) => (
                <Text selectable key={metric.id} style={metric.passed ? styles.evaluationPass : styles.providerReason}>
                  {metric.passed ? "PASS" : "FAIL"}: {metric.label}
                </Text>
              ))}
            </View>
          ) : null}
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
  providerReason: { color: colors.muted, fontSize: 12, fontWeight: "700", lineHeight: 17 },
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
  refreshButtonText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  disabledButton: { backgroundColor: colors.grayhawk },
  evaluationResults: { gap: 5, marginTop: 4 },
  evaluationPass: { color: colors.success, fontSize: 12, fontWeight: "800", lineHeight: 17 }
});
