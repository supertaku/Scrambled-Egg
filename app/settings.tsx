import { useCallback, useEffect, useRef, useState } from "react";
import { Cpu, Database, Info, RefreshCw, ShieldCheck, Trash2, Upload } from "lucide-react-native";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminGate } from "@/components/AdminGate";
import { MascotHeader } from "@/components/MascotHeader";
import { ModeStatusBadge } from "@/components/ModeStatusBadge";
import { getDatabase } from "@/db/database";
import { getAppMetaValue, getDatabaseStats, type DatabaseStats } from "@/db/documentRepository";
import {
  getCurrentAIMode,
  getDeviceCapabilityReport,
  refreshDeviceCapabilities
} from "@/services/modeSelectionService";
import { colors } from "@/theme/colors";
import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import type { DeviceCapabilityReport, ProviderCapabilityReport } from "@/ai/CapabilityDetector";
import { getLocalModelRequirementSummary } from "@/ai/localModelRequirements";
import {
  getImportedModelStatus,
  pickAndImportGgufModel,
  removeImportedModel,
  type ImportedModelStatus
} from "@/ai/localModelManager";

const localModelRequirementSummary = getLocalModelRequirementSummary();

function formatMs(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not reported" : `${Math.round(value)}ms`;
}

export default function SettingsScreen() {
  const mountedRef = useRef(true);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [seedVersion, setSeedVersion] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<DeviceAIMode | null>(null);
  const [capabilityReport, setCapabilityReport] = useState<DeviceCapabilityReport | null>(null);
  const [chatModelStatus, setChatModelStatus] = useState<ImportedModelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingCapabilities, setRefreshingCapabilities] = useState(false);
  const [modelBusy, setModelBusy] = useState(false);
  const [modelMessage, setModelMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async (refreshCapabilities: boolean) => {
    if (refreshCapabilities) {
      setRefreshingCapabilities(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const db = await getDatabase();
      const [nextStats, nextSeedVersion] = await Promise.all([
        getDatabaseStats(db),
        getAppMetaValue(db, "seed_version")
      ]);
      const nextMode = refreshCapabilities ? await refreshDeviceCapabilities() : await getCurrentAIMode();
      const [nextCapabilityReport, nextChatModelStatus] = await Promise.all([
        getDeviceCapabilityReport(),
        getImportedModelStatus("chat")
      ]);

      if (mountedRef.current) {
        setStats(nextStats);
        setSeedVersion(nextSeedVersion);
        setActiveMode(nextMode);
        setCapabilityReport(nextCapabilityReport);
        setChatModelStatus(nextChatModelStatus);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load saved document details.");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshingCapabilities(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadSettings(false);
    return () => {
      mountedRef.current = false;
    };
  }, [loadSettings]);

  const handleRefreshCapabilities = useCallback(() => {
    void loadSettings(true);
  }, [loadSettings]);

  const handleImportChatModel = useCallback(async () => {
    setModelBusy(true);
    setModelMessage(null);
    setError(null);

    try {
      const result = await pickAndImportGgufModel("chat");
      if (!result.canceled && result.status) {
        setChatModelStatus(result.status);
        setModelMessage(
          result.status.state === "available"
            ? "GGUF chat model imported and activated."
            : "GGUF copied, but this device cannot safely activate it yet."
        );
        await loadSettings(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import GGUF model.");
    } finally {
      if (mountedRef.current) {
        setModelBusy(false);
      }
    }
  }, [loadSettings]);

  const handleRemoveChatModel = useCallback(async () => {
    setModelBusy(true);
    setModelMessage(null);
    setError(null);

    try {
      const nextStatus = await removeImportedModel("chat");
      setChatModelStatus(nextStatus);
      setModelMessage("Imported GGUF chat model removed.");
      await loadSettings(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove imported GGUF model.");
    } finally {
      if (mountedRef.current) {
        setModelBusy(false);
      }
    }
  }, [loadSettings]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <MascotHeader
          message="No drama dito. Haki only answers from saved campus documents."
          subtitle="About Haki"
        />

        <AdminGate label="About and document details are available in admin mode only.">
          <View style={styles.card}>
            <ShieldCheck color={colors.maroon} size={24} />
            <Text style={styles.cardTitle}>Haki</Text>
            <Text style={styles.cardText}>
              Haki works offline on your phone. The local documents are the source of truth; local AI can only improve
              retrieval or summarize retrieved chunks.
            </Text>
            {activeMode ? <ModeStatusBadge label={activeMode.label} /> : null}
            <Pressable
              accessibilityRole="button"
              disabled={refreshingCapabilities}
              onPress={handleRefreshCapabilities}
              style={[styles.refreshCapabilitiesButton, refreshingCapabilities ? styles.disabledButton : undefined]}
            >
              {refreshingCapabilities ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <RefreshCw color={colors.white} size={16} />
              )}
              <Text style={styles.refreshCapabilitiesText}>
                {refreshingCapabilities ? "Checking..." : "Re-check device capability"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Info color={colors.gold} size={24} />
            <Text style={styles.cardTitle}>Official confirmation still matters</Text>
            <Text style={styles.cardText}>
              Haki does not replace office confirmation. If the saved information is missing or unclear, Haki refuses to
              answer instead of guessing.
            </Text>
          </View>

          <View style={styles.card}>
            <Cpu color={colors.maroon} size={24} />
            <Text style={styles.cardTitle}>Android GGUF chat model</Text>
            <Text style={styles.cardText}>
              Import a quantized GGUF chat model. Haki stores one active model privately on this device and validates RAM,
              storage, ABI, quantization, and tier before enabling llama.rn.
            </Text>
            {chatModelStatus ? <ModelStatus status={chatModelStatus} /> : null}
            <View style={styles.modelActions}>
              <Pressable
                accessibilityRole="button"
                disabled={modelBusy}
                onPress={handleImportChatModel}
                style={[styles.modelButton, modelBusy ? styles.disabledButton : undefined]}
              >
                {modelBusy ? <ActivityIndicator color={colors.white} size="small" /> : <Upload color={colors.white} size={16} />}
                <Text style={styles.modelButtonText}>Import GGUF</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={modelBusy || chatModelStatus?.state === "missing"}
                onPress={handleRemoveChatModel}
                style={[
                  styles.modelButton,
                  styles.removeModelButton,
                  modelBusy || chatModelStatus?.state === "missing" ? styles.disabledOutlineButton : undefined
                ]}
              >
                <Trash2 color={colors.maroon} size={16} />
                <Text style={styles.removeModelButtonText}>Remove</Text>
              </Pressable>
            </View>
            {modelMessage ? <Text style={styles.modelMessage}>{modelMessage}</Text> : null}
          </View>

          <View style={styles.card}>
            <Info color={colors.maroon} size={24} />
            <Text style={styles.cardTitle}>Real local model requirements</Text>
            {localModelRequirementSummary.map((requirement) => (
              <Text key={requirement} style={styles.requirementText}>
                {requirement}
              </Text>
            ))}
            <Text style={styles.cardText}>
              If any requirement is missing, Haki stays on FTS5 source search so students still get grounded offline
              answers.
            </Text>
          </View>

          <View style={styles.card}>
            <Database color={colors.maroon} size={24} />
            <Text style={styles.cardTitle}>Saved documents</Text>
            {loading ? (
              <ActivityIndicator color={colors.maroon} />
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : (
              <View style={styles.statsGrid}>
                <Stat label="Storage" value="On this device" />
                <Stat label="Seed version" value={seedVersion ?? "Not seeded"} />
                <Stat label="Documents" value={stats?.documentCount ?? 0} />
                <Stat label="Chunks" value={stats?.chunkCount ?? 0} />
                <Stat label="Latest document update" value={stats?.latestUpdate ?? "No date"} />
                {activeMode ? (
                  <>
                    <Stat label="Active mode" value={activeMode.label} />
                    <Stat label="Detected platform" value={capabilityReport?.platform ?? activeMode.platform} />
                    <Stat label="Detected OS version" value={capabilityReport?.osVersion ?? activeMode.platformVersion} />
                    <Stat
                      label="Approx. device class"
                      value={capabilityReport?.approximateDeviceCapability ?? activeMode.capabilities.approximateDeviceCapability}
                    />
                    <Stat label="Memory/RAM class" value={capabilityReport?.memoryClass ?? "Not exposed"} />
                    <Stat label="Base FTS5" value={capabilityReport?.baseFtsAvailable ? "Available" : "Unavailable"} />
                    <Stat label="Local summary" value={activeMode.capabilities.summary ? "Available" : "Unavailable"} />
                    <Stat
                      label="General safe chat"
                      value={activeMode.capabilities.safeChat ? "Available" : "Unavailable"}
                    />
                    <Stat label="Local embeddings" value={activeMode.capabilities.embeddings ? "Available" : "Unavailable"} />
                    <Stat label="Summary provider" value={activeMode.summaryProviderName ?? "None"} />
                    <Stat label="Embedding provider" value={activeMode.embeddingProviderName ?? "None"} />
                    <Stat label="Native bridge" value={activeMode.capabilities.bridgePresent ? "Present" : "Missing"} />
                    <Stat label="Model name" value={activeMode.capabilities.modelName ?? "None"} />
                    <Stat label="Model asset path" value={activeMode.capabilities.modelAssetPath ?? "Not reported"} />
                    <Stat label="Active model tier" value={activeMode.capabilities.modelTier ?? "unknown"} />
                    <Stat label="Recommended model tier" value={activeMode.capabilities.recommendedModelTier ?? "unknown"} />
                    <Stat
                      label="Streaming"
                      value={activeMode.capabilities.streamingSupported ? "Supported" : "Unavailable"}
                    />
                    <Stat label="Model load time" value={formatMs(activeMode.capabilities.modelLoadTimeMs)} />
                    <Stat label="Last inference" value={formatMs(activeMode.capabilities.lastInferenceTimeMs)} />
                    <Stat
                      label="Model size"
                      value={
                        activeMode.capabilities.modelParameterCountB
                          ? `${activeMode.capabilities.modelParameterCountB}B parameters`
                          : "Not active"
                      }
                    />
                    <Stat label="Model quantization" value={activeMode.capabilities.modelQuantization ?? "Not active"} />
                    <Stat label="Device ABI" value={activeMode.capabilities.architecture ?? "Not reported"} />
                    <Stat
                      label="Reported RAM"
                      value={
                        activeMode.capabilities.memoryGB !== null && activeMode.capabilities.memoryGB !== undefined
                          ? `${activeMode.capabilities.memoryGB.toFixed(1)}GB`
                          : "Not reported"
                      }
                    />
                    <Stat
                      label="Reported free storage"
                      value={
                        activeMode.capabilities.freeStorageGB !== null &&
                        activeMode.capabilities.freeStorageGB !== undefined
                          ? `${activeMode.capabilities.freeStorageGB.toFixed(1)}GB`
                          : "Not reported"
                      }
                    />
                    <Stat label="Last capability check" value={capabilityReport?.lastCheckedAt ?? activeMode.detectedAt} />
                  </>
                ) : null}
              </View>
            )}
          </View>

          {capabilityReport ? (
            <View style={styles.card}>
              <Info color={colors.maroon} size={24} />
              <Text style={styles.cardTitle}>Detected local AI providers</Text>
              <View style={styles.providerList}>
                {capabilityReport.providers.map((provider) => (
                  <ProviderStatus key={provider.id} provider={provider} />
                ))}
              </View>
              {capabilityReport.unavailableReasons.length > 0 ? (
                <View style={styles.reasonBlock}>
                  <Text style={styles.reasonTitle}>Why higher modes may be unavailable</Text>
                  {capabilityReport.unavailableReasons.slice(0, 8).map((reason) => (
                    <Text key={reason} style={styles.reasonText}>
                      {reason}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>Current limitation</Text>
            <Text style={styles.cardText}>
              ExecuTorch, llama.rn, and Apple Foundation Models require a custom Expo development build before Haki can
              run real local models.
            </Text>
          </View>
        </AdminGate>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Not reported";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)}GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)}MB`;
  return `${Math.round(value / 1024)}KB`;
}

function ModelStatus({ status }: { status: ImportedModelStatus }) {
  const manifest = status.manifest;

  return (
    <View style={styles.modelStatusCard}>
      <View style={styles.providerHeader}>
        <Text style={styles.providerName}>Chat model</Text>
        <Text style={[styles.providerBadge, status.state === "available" ? styles.availableBadge : styles.unavailableBadge]}>
          {status.state === "available" ? "Active" : status.state === "rejected" ? "Rejected" : "Missing"}
        </Text>
      </View>
      <View style={styles.providerMetaGrid}>
        <ProviderMeta label="Model" value={manifest?.modelName ?? "None"} />
        <ProviderMeta label="Tier" value={manifest?.modelTier ?? "unknown"} />
        <ProviderMeta label="Recommended" value={manifest?.recommendedModelTier ?? "unknown"} />
        <ProviderMeta label="Params" value={manifest?.modelParameterCountB ? `${manifest.modelParameterCountB}B` : "Unknown"} />
        <ProviderMeta label="Quantization" value={manifest?.modelQuantization ?? "Unknown"} />
        <ProviderMeta label="Size" value={formatBytes(manifest?.sizeBytes)} />
        <ProviderMeta label="Hash" value={manifest?.fileHash ? manifest.fileHash.slice(0, 12) : "None"} />
        <ProviderMeta label="Path" value={manifest?.uri ?? status.modelDirectory ?? "Not created"} />
      </View>
      {status.rejectionReasons.slice(0, 4).map((reason) => (
        <Text key={reason} style={styles.providerReason}>
          {reason}
        </Text>
      ))}
    </View>
  );
}

function ProviderStatus({ provider }: { provider: ProviderCapabilityReport }) {
  return (
    <View style={styles.providerCard}>
      <View style={styles.providerHeader}>
        <Text style={styles.providerName}>{provider.name}</Text>
        <Text style={[styles.providerBadge, provider.available ? styles.availableBadge : styles.unavailableBadge]}>
          {provider.available ? "Available" : "Unavailable"}
        </Text>
      </View>
      <View style={styles.providerMetaGrid}>
        <ProviderMeta label="Bridge" value={provider.bridgePresent ? "Present" : "Missing"} />
        <ProviderMeta label="Runtime" value={provider.runtimeAvailable ? "Yes" : "No"} />
        <ProviderMeta label="Summary" value={provider.summaryAvailable ? "Yes" : "No"} />
        <ProviderMeta label="Safe chat" value={provider.safeChatAvailable ? "Yes" : "No"} />
        <ProviderMeta label="Streaming" value={provider.streamingSupported ? "Yes" : "No"} />
        <ProviderMeta label="Embeddings" value={provider.embeddingsAvailable ? "Yes" : "No"} />
        <ProviderMeta
          label="Model assets"
          value={provider.modelAssetsAvailable === null ? "Unknown" : provider.modelAssetsAvailable ? "Yes" : "No"}
        />
        <ProviderMeta label="Model" value={provider.modelName ?? "None"} />
        <ProviderMeta label="Asset path" value={provider.modelAssetPath ?? "None"} />
        <ProviderMeta label="Manifest" value={provider.modelManifestPath ?? "None"} />
        <ProviderMeta label="Import" value={provider.modelImportStatus ?? "None"} />
        <ProviderMeta label="Hash" value={provider.modelFileHash ? provider.modelFileHash.slice(0, 12) : "None"} />
        <ProviderMeta label="Load time" value={formatMs(provider.modelLoadTimeMs)} />
        <ProviderMeta label="Last inference" value={formatMs(provider.lastInferenceTimeMs)} />
        <ProviderMeta label="Active tier" value={provider.modelTier} />
        <ProviderMeta label="Recommended tier" value={provider.recommendedModelTier} />
        <ProviderMeta
          label="Model size"
          value={provider.modelParameterCountB ? `${provider.modelParameterCountB}B` : "None"}
        />
        <ProviderMeta label="Quantization" value={provider.modelQuantization ?? "None"} />
        <ProviderMeta label="ABI" value={provider.architecture ?? "Not reported"} />
        <ProviderMeta
          label="RAM"
          value={provider.memoryGB !== null ? `${provider.memoryGB.toFixed(1)}GB` : provider.memoryClass ?? "Not exposed"}
        />
        <ProviderMeta
          label="Free storage"
          value={provider.freeStorageGB !== null ? `${provider.freeStorageGB.toFixed(1)}GB` : "Not reported"}
        />
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

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.maroon,
    flex: 1
  },
  content: {
    backgroundColor: colors.surface,
    gap: 16,
    paddingBottom: 28
  },
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
  requirementText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19
  },
  refreshCapabilitiesButton: {
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
  refreshCapabilitiesText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900"
  },
  disabledButton: {
    backgroundColor: colors.grayhawk
  },
  disabledOutlineButton: {
    borderColor: colors.border,
    opacity: 0.55
  },
  modelActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  modelButton: {
    alignItems: "center",
    backgroundColor: colors.maroon,
    borderColor: colors.maroon,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  removeModelButton: {
    backgroundColor: colors.white
  },
  modelButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900"
  },
  removeModelButtonText: {
    color: colors.maroon,
    fontSize: 13,
    fontWeight: "900"
  },
  modelStatusCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12
  },
  modelMessage: {
    color: colors.maroonDark,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
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
  providerList: {
    gap: 10
  },
  providerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12
  },
  providerHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  providerName: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "900"
  },
  providerBadge: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  availableBadge: {
    backgroundColor: colors.success,
    color: colors.white
  },
  unavailableBadge: {
    backgroundColor: colors.goldSoft,
    color: colors.ink
  },
  providerMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  providerMeta: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: "45%",
    padding: 8
  },
  providerMetaLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  providerMetaValue: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2
  },
  providerReason: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  reasonBlock: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 12
  },
  reasonTitle: {
    color: colors.maroonDark,
    fontSize: 13,
    fontWeight: "900"
  },
  reasonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  noteCard: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    marginHorizontal: 18,
    padding: 16
  },
  noteTitle: {
    color: colors.maroonDark,
    fontSize: 16,
    fontWeight: "900"
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20
  }
});
