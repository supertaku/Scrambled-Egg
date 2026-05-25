import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AdminGate } from "@/components/AdminGate";
import type { DeviceCapabilityReport } from "@/ai/CapabilityDetector";
import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import {
  getLastLocalModelEvaluation,
  runActiveLocalModelEvaluation,
  type LocalModelEvaluationReport
} from "@/ai/localModelEvaluation";
import { getAppDatabase } from "@/data/appRepository";
import { getAppMetaValue, getDatabaseStats, getDocumentSummaries, type DatabaseStats } from "@/db/documentRepository";
import { getCurrentAIMode, getDeviceCapabilityReport, refreshDeviceCapabilities } from "@/services/modeSelectionService";
import { clearChatMemory } from "@/services/historyService";
import {
  getChatPrivacySettings,
  setUseProfileContext,
  setUseRelatedHistory
} from "@/services/chatPrivacySettingsService";
import { getVoiceAutoSend, setVoiceAutoSend } from "@/services/voiceSettingsService";
import { colors } from "@/theme/colors";
import type { DocumentSummary } from "@/types/document";

import { SettingsCapabilitySection } from "./SettingsCapabilitySection";
import { SettingsDbSection } from "./SettingsDbSection";
import { SettingsPreferencesSection } from "./SettingsPreferencesSection";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const mountedRef = useRef(true);
  const [activeMode, setActiveMode] = useState<DeviceAIMode | null>(null);
  const [autoSendVoice, setAutoSendVoiceState] = useState(false);
  const [useProfileContext, setUseProfileContextState] = useState(false);
  const [useRelatedHistory, setUseRelatedHistoryState] = useState(false);
  const [capabilityReport, setCapabilityReport] = useState<DeviceCapabilityReport | null>(null);
  const [clearingMemory, setClearingMemory] = useState(false);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const [evaluationReport, setEvaluationReport] = useState<LocalModelEvaluationReport | null>(null);
  const [evaluatingModel, setEvaluatingModel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshingCapabilities, setRefreshingCapabilities] = useState(false);
  const [seedVersion, setSeedVersion] = useState<string | null>(null);
  const [stats, setStats] = useState<DatabaseStats | null>(null);

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
      const [nextCapabilityReport, nextVoiceAutoSend, nextEvaluationReport, privacySettings] = await Promise.all([
        getDeviceCapabilityReport(),
        getVoiceAutoSend(),
        getLastLocalModelEvaluation(),
        getChatPrivacySettings()
      ]);

      if (!mountedRef.current) return;
      setActiveMode(nextMode);
      setAutoSendVoiceState(nextVoiceAutoSend);
      setUseProfileContextState(privacySettings.useProfileContext);
      setUseRelatedHistoryState(privacySettings.useRelatedHistory);
      setCapabilityReport(nextCapabilityReport);
      setDocuments(nextDocuments);
      setEvaluationReport(nextEvaluationReport);
      setSeedVersion(nextSeedVersion);
      setStats(nextStats);
    } catch {
      if (mountedRef.current) {
        setError("Could not load saved guide details. Please try again.");
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

  const toggleAutoSendVoice = useCallback(async (value: boolean) => {
    setAutoSendVoiceState(value);
    await setVoiceAutoSend(value);
  }, []);

  const toggleUseProfileContext = useCallback(async (value: boolean) => {
    setUseProfileContextState(value);
    await setUseProfileContext(value);
  }, []);

  const toggleUseRelatedHistory = useCallback(async (value: boolean) => {
    setUseRelatedHistoryState(value);
    await setUseRelatedHistory(value);
  }, []);

  const toggleProvider = useCallback((providerId: string) => {
    setExpandedProviders((current) => ({ ...current, [providerId]: !current[providerId] }));
  }, []);

  const handleClearChatMemory = useCallback(() => {
    Alert.alert(
      "Clear recent chat activity",
      "This removes recent questions and remembered replies from this phone. Your profile stays saved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            setClearingMemory(true);
            void clearChatMemory()
              .then(() => Alert.alert("Recent chat activity cleared", "Recent questions and remembered replies were removed from this phone."))
              .catch(() => {
                setError("Could not clear recent chat activity. Please try again.");
              })
              .finally(() => {
                if (mountedRef.current) setClearingMemory(false);
              });
          }
        }
      ]
    );
  }, []);

  const handleEvaluateModel = useCallback(async () => {
    setEvaluatingModel(true);
    setError(null);
    try {
      const report = await runActiveLocalModelEvaluation();
      if (mountedRef.current) setEvaluationReport(report);
    } catch {
      if (mountedRef.current) setError("Could not evaluate the active local model on this device.");
    } finally {
      if (mountedRef.current) setEvaluatingModel(false);
    }
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
          onToggleUseProfileContext={toggleUseProfileContext}
          onToggleUseRelatedHistory={toggleUseRelatedHistory}
          useProfileContext={useProfileContext}
          useRelatedHistory={useRelatedHistory}
        />
        <AdminGate label="Saved guide and app check details are for administrators only.">
          <SettingsDbSection documents={documents} error={error} loading={loading} seedVersion={seedVersion} stats={stats} />
          <SettingsCapabilitySection
            activeMode={activeMode}
            capabilityReport={capabilityReport}
            error={error}
            expandedProviders={expandedProviders}
            loading={loading}
            evaluationReport={evaluationReport}
            evaluatingModel={evaluatingModel}
            onEvaluateModel={() => void handleEvaluateModel()}
            onRefreshCapabilities={() => void loadSettings(true)}
            onToggleProvider={toggleProvider}
            refreshingCapabilities={refreshingCapabilities}
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
