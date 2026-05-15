import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AdminGate } from "@/components/AdminGate";
import type { DeviceCapabilityReport } from "@/ai/CapabilityDetector";
import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import {
  cancelGgufDownload,
  downloadGgufModel,
  getImportedModelStatus,
  pickAndImportGgufModel,
  removeImportedModel,
  type ImportedModelStatus
} from "@/ai/localModelManager";
import type { GgufDownloadConfig } from "@/ai/modelDownloadConfig";
import { getAppDatabase } from "@/data/appRepository";
import { getAppMetaValue, getDatabaseStats, getDocumentSummaries, type DatabaseStats } from "@/db/documentRepository";
import { getCurrentAIMode, getDeviceCapabilityReport, refreshDeviceCapabilities } from "@/services/modeSelectionService";
import { clearChatMemory } from "@/services/historyService";
import { getVoiceAutoSend, setVoiceAutoSend } from "@/services/voiceSettingsService";
import { colors } from "@/theme/colors";
import type { DocumentSummary } from "@/types/document";

import { SettingsAdminSection } from "./SettingsAdminSection";
import { SettingsCapabilitySection } from "./SettingsCapabilitySection";
import { SettingsDbSection } from "./SettingsDbSection";
import { SettingsModelsSection } from "./SettingsModelsSection";
import { SettingsPreferencesSection } from "./SettingsPreferencesSection";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const mountedRef = useRef(true);
  const [activeMode, setActiveMode] = useState<DeviceAIMode | null>(null);
  const [autoSendVoice, setAutoSendVoiceState] = useState(false);
  const [capabilityReport, setCapabilityReport] = useState<DeviceCapabilityReport | null>(null);
  const [chatModelStatus, setChatModelStatus] = useState<ImportedModelStatus | null>(null);
  const [clearingMemory, setClearingMemory] = useState(false);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [modelBusy, setModelBusy] = useState(false);
  const [modelMessage, setModelMessage] = useState<string | null>(null);
  const [refreshingCapabilities, setRefreshingCapabilities] = useState(false);
  const [seedVersion, setSeedVersion] = useState<string | null>(null);
  const [stats, setStats] = useState<DatabaseStats | null>(null);

  const getModelRecommendationLabel = useCallback((modelTier: string) => {
    if (!capabilityReport?.recommendedModelTier) return null;

    const tierScores = { tiny: 1, minimum: 2, good: 3, enhanced: 4, flagship: 5 };
    const deviceScore = tierScores[capabilityReport.recommendedModelTier as keyof typeof tierScores] || 0;
    const modelScore = tierScores[modelTier as keyof typeof tierScores] || 0;

    if (deviceScore === 0 || modelScore === 0) return null;
    if (modelScore > deviceScore) return { text: "Overloads", color: colors.danger, bg: colors.dangerSoft };
    if (modelScore < deviceScore) return { text: "Underperforms", color: colors.gold, bg: colors.goldSoft };
    return { text: "Recommended", color: colors.success, bg: colors.successSoft };
  }, [capabilityReport]);

  const loadSettings = useCallback(async (refreshCapabilities: boolean) => {
    if (refreshCapabilities) setRefreshingCapabilities(true);
    else setLoading(true);
    setError(null);

    try {
      const db = await getAppDatabase();
      const [nextStats, nextSeedVersion, nextDocuments] = await Promise.all([
        getDatabaseStats(db),
        getAppMetaValue(db, "seed_version"),
        getDocumentSummaries(db)
      ]);
      const nextMode = refreshCapabilities ? await refreshDeviceCapabilities() : await getCurrentAIMode();
      const [nextCapabilityReport, nextChatModelStatus, nextVoiceAutoSend] = await Promise.all([
        getDeviceCapabilityReport(),
        getImportedModelStatus("chat"),
        getVoiceAutoSend()
      ]);

      if (!mountedRef.current) return;
      setActiveMode(nextMode);
      setAutoSendVoiceState(nextVoiceAutoSend);
      setCapabilityReport(nextCapabilityReport);
      setChatModelStatus(nextChatModelStatus);
      setDocuments(nextDocuments);
      setSeedVersion(nextSeedVersion);
      setStats(nextStats);
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

  const handleDownloadModel = useCallback(async (model: GgufDownloadConfig) => {
    setModelBusy(true);
    setModelMessage(null);
    setError(null);
    setDownloadProgress(0);
    setDownloadingId(model.id);

    try {
      const result = await downloadGgufModel(
        "chat",
        model.url,
        (progress) => {
          if (mountedRef.current) setDownloadProgress(progress);
        },
        { downloadId: model.id, sourceId: model.id, expectedSha256Hex: model.sha256Hex }
      );
      if (result.status) {
        setModelMessage(
          result.success
            ? `Successfully downloaded and activated ${model.name}.`
            : `${model.name} downloaded, but this device cannot safely activate it yet.`
        );
        setChatModelStatus(result.status);
        await loadSettings(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download GGUF model.");
    } finally {
      if (mountedRef.current) {
        setDownloadProgress(null);
        setDownloadingId(null);
        setModelBusy(false);
      }
    }
  }, [loadSettings]);

  const handleImportChatModel = useCallback(async () => {
    setModelBusy(true);
    setModelMessage(null);
    setError(null);

    try {
      const result = await pickAndImportGgufModel("chat");
      if (!result.canceled && result.status) {
        setChatModelStatus(result.status);
        setModelMessage(result.status.state === "available" ? "GGUF chat model imported and activated." : "GGUF copied, but this device cannot safely activate it yet.");
        await loadSettings(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import GGUF model.");
    } finally {
      if (mountedRef.current) setModelBusy(false);
    }
  }, [loadSettings]);

  const handleRemoveChatModel = useCallback(async () => {
    setModelBusy(true);
    setModelMessage(null);
    setError(null);

    try {
      setChatModelStatus(await removeImportedModel("chat"));
      setModelMessage("Chat model removed. The bundled default GGUF will reactivate after capability check.");
      await loadSettings(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove imported GGUF model.");
    } finally {
      if (mountedRef.current) setModelBusy(false);
    }
  }, [loadSettings]);

  const confirmRemoveChatModel = useCallback(() => {
    Alert.alert("Remove Downloaded Model", "Are you sure you want to remove the downloaded model to save space?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: handleRemoveChatModel }
    ]);
  }, [handleRemoveChatModel]);

  const toggleAutoSendVoice = useCallback(async (value: boolean) => {
    setAutoSendVoiceState(value);
    await setVoiceAutoSend(value);
  }, []);

  const toggleProvider = useCallback((providerId: string) => {
    setExpandedProviders((current) => ({ ...current, [providerId]: !current[providerId] }));
  }, []);

  const handleClearChatMemory = useCallback(() => {
    Alert.alert(
      "Clear local chat memory",
      "This removes saved recent questions and reusable answer memories from this device. Your profile stays saved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            setClearingMemory(true);
            void clearChatMemory()
              .then(() => setModelMessage("Local chat memory cleared."))
              .catch((err) => {
                setError(err instanceof Error ? err.message : "Failed to clear local chat memory.");
              })
              .finally(() => {
                if (mountedRef.current) setClearingMemory(false);
              });
          }
        }
      ]
    );
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 176 + insets.bottom }]}
        scrollIndicatorInsets={{ bottom: 132 + insets.bottom }}
      >
        <SettingsPreferencesSection
          autoSendVoice={autoSendVoice}
          clearingMemory={clearingMemory}
          onClearChatMemory={handleClearChatMemory}
          onToggleAutoSendVoice={toggleAutoSendVoice}
        />
        <AdminGate label="About and document details are available in admin mode only.">
          <SettingsAdminSection
            activeMode={activeMode}
            capabilityReport={capabilityReport}
            onRefreshCapabilities={() => void loadSettings(true)}
            refreshingCapabilities={refreshingCapabilities}
          />
          <SettingsModelsSection
            chatModelStatus={chatModelStatus}
            downloadProgress={downloadProgress}
            downloadingId={downloadingId}
            getModelRecommendationLabel={getModelRecommendationLabel}
            modelBusy={modelBusy}
            modelMessage={modelMessage}
            onCancelDownload={() => void cancelGgufDownload()}
            onDownloadModel={(model) => void handleDownloadModel(model)}
            onImportChatModel={() => void handleImportChatModel()}
            onRemoveChatModel={confirmRemoveChatModel}
          />
          <SettingsDbSection documents={documents} error={error} loading={loading} seedVersion={seedVersion} stats={stats} />
          <SettingsCapabilitySection
            activeMode={activeMode}
            capabilityReport={capabilityReport}
            error={error}
            expandedProviders={expandedProviders}
            loading={loading}
            onToggleProvider={toggleProvider}
          />
        </AdminGate>
      </ScrollView>
    </SafeAreaView>
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
    paddingTop: 16
  }
});
