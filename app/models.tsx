import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, CheckCircle2, Cpu, Download, PauseCircle, PlayCircle, RefreshCw, Trash2 } from "lucide-react-native";

import type { GgufDownloadConfig } from "@/ai/modelDownloadConfig";
import {
  activateChatModel,
  cancelGgufDownload,
  discardPausedModelDownload,
  downloadCatalogModel,
  getChatModelLibrary,
  getCompatibleModelCatalog,
  recoverInterruptedModelOperation,
  removeChatModel,
  resumePausedModelDownload,
  subscribeModelOperation,
  type ChatModelLibrary,
  type CompatibleModelCatalog,
  type InstalledChatModel,
  type ModelOperationState
} from "@/ai/localModelManager";
import { ModelOperationHaki } from "@/components/models/ModelOperationHaki";
import { refreshDeviceCapabilities } from "@/services/modeSelectionService";
import { colors } from "@/theme/colors";

function formatSize(bytes: number): string {
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

function operationBusy(operation: ModelOperationState | null): boolean {
  return Boolean(operation && !["paused", "completed", "failed", "canceled"].includes(operation.phase));
}

function catalogOperationLabel(operation: ModelOperationState | null, catalogId: string): string | null {
  if (!operation || operation.catalogId !== catalogId) {
    return null;
  }

  switch (operation.phase) {
    case "queued":
      return "Queued...";
    case "downloading":
      return "Downloading...";
    case "paused":
      return "Paused";
    case "verifying":
    case "validating":
      return "Checking...";
    case "optimizing":
      return "Optimizing...";
    case "waiting_for_chat":
    case "activating":
      return "Preparing...";
    default:
      return null;
  }
}

export default function ModelsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [library, setLibrary] = useState<ChatModelLibrary | null>(null);
  const [catalog, setCatalog] = useState<CompatibleModelCatalog | null>(null);
  const [operation, setOperation] = useState<ModelOperationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const terminalOperationRef = useRef<string | null>(null);

  const load = useCallback(async (refreshMode = false) => {
    setError(null);
    try {
      if (refreshMode) await refreshDeviceCapabilities();
      const [nextLibrary, nextCatalog] = await Promise.all([getChatModelLibrary(), getCompatibleModelCatalog()]);
      setLibrary(nextLibrary);
      setCatalog(nextCatalog);
    } catch {
      setError("Could not load chat options. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void recoverInterruptedModelOperation().then(setOperation);
    void load();
    return subscribeModelOperation((next) => {
      setOperation(next);
      if (next && ["completed", "failed", "canceled"].includes(next.phase) && terminalOperationRef.current !== next.operationId) {
        terminalOperationRef.current = next.operationId;
        void load(next.phase === "completed");
      }
    });
  }, [load]);

  const runAction = useCallback(async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await load(true);
    } catch {
      setError("That change did not finish. Please try again.");
      await load();
    }
  }, [load]);

  const removeModel = useCallback((model: InstalledChatModel) => {
    Alert.alert(
      "Remove chat download",
      `Remove this chat download and free about ${formatSize(model.sizeBytes)}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void runAction(() => removeChatModel(model.id)) }
      ]
    );
  }, [runAction]);

  const activeModel = library?.installedModels.find((model) => model.id === library.activeModelId) ?? null;
  const busy = operationBusy(operation);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.white} size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>Chat Options</Text>
        <View style={styles.headerGap} />
      </View>
      <View style={styles.sheet}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 124 + insets.bottom }]}
          scrollIndicatorInsets={{ bottom: 108 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          <ModelOperationHaki activeModelName={activeModel?.modelName ?? null} operation={operation} />

          {operation?.phase === "paused" ? (
            <View style={styles.pausedActions}>
              {operation.resumable ? (
                <ActionButton icon={<PlayCircle color={colors.white} size={16} />} label="Resume" onPress={() => void runAction(resumePausedModelDownload)} />
              ) : null}
              <ActionButton secondary icon={<Trash2 color={colors.maroon} size={16} />} label="Discard" onPress={() => void runAction(discardPausedModelDownload)} />
            </View>
          ) : operation && ["queued", "downloading", "verifying", "optimizing"].includes(operation.phase) ? (
            <ActionButton secondary icon={<PauseCircle color={colors.maroon} size={16} />} label="Cancel" onPress={() => void cancelGgufDownload()} />
          ) : null}

          {error ? <Text selectable style={styles.error}>{error}</Text> : null}
          {loading ? <ActivityIndicator color={colors.maroon} /> : null}

          <View style={styles.card}>
            <Cpu color={colors.maroon} size={21} />
            <Text style={styles.cardTitle}>Unlock supportive Haki modes</Text>
            <Text selectable style={styles.body}>
              Campus Haki already answers from the saved campus guide. Download a chat model to unlock Friendly Haki and Campus Haki + Friendly Haki.
            </Text>
            <Text selectable style={styles.meta}>Only downloads suited for this phone are shown.</Text>
            {catalog?.hiddenModels.length && catalog.compatibleModels.length > 0 && !catalog.unavailableReason ? (
              <Text selectable style={styles.notice}>
                Some larger downloads are hidden because they may not work well on this phone.
              </Text>
            ) : null}
            {catalog?.unavailableReason ? <Text selectable style={styles.warning}>Chat downloads are not available on this phone right now.</Text> : null}
            {catalog?.unavailableReason ? (
              <ActionButton
                secondary
                icon={<RefreshCw color={colors.maroon} size={16} />}
                label="Check again"
                onPress={() => void load(true)}
              />
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Downloaded chat models</Text>
          {!library?.installedModels.length ? (
            <View style={styles.emptyCard}>
              <Text selectable style={styles.body}>No chat model downloaded yet. Campus Haki is available from the saved campus guide.</Text>
            </View>
          ) : (
            library.installedModels.map((model) => (
              <View key={model.id} style={styles.modelCard}>
                <View style={styles.modelTitleRow}>
                  <Text selectable style={styles.modelName}>{model.modelName}</Text>
                  {model.id === library.activeModelId ? (
                    <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>IN USE</Text></View>
                  ) : null}
                </View>
                <Text selectable style={styles.meta}>
                  {formatSize(model.sizeBytes)}
                  {model.source === "legacy-bundled" ? " | Previously installed" : ""}
                </Text>
                {model.rejectionReasons.length > 0 ? <Text selectable style={styles.warning}>This download cannot be used on this phone.</Text> : null}
                <View style={styles.rowActions}>
                  {model.id !== library.activeModelId ? (
                    <ActionButton disabled={busy} icon={<CheckCircle2 color={colors.white} size={16} />} label="Use" onPress={() => void runAction(() => activateChatModel(model.id))} />
                  ) : null}
                  <ActionButton disabled={busy} secondary icon={<Trash2 color={colors.maroon} size={16} />} label="Remove" onPress={() => removeModel(model)} />
                </View>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Models available for this phone</Text>
          {!catalog?.compatibleModels.length ? (
            <View style={styles.emptyCard}><Text selectable style={styles.body}>No additional chat downloads are available right now.</Text></View>
          ) : (
            catalog.compatibleModels.map((model) => {
              const operationLabel = catalogOperationLabel(operation, model.id);
              const selectedOperation = operationLabel !== null;

              return (
                <View key={model.id} style={styles.modelCard}>
                  <Text selectable style={styles.modelName}>{model.name}</Text>
                  <Text selectable style={styles.meta}>About {model.sizeMB} MB</Text>
                  <Text selectable style={styles.body}>{model.description}</Text>
                  <Text selectable style={styles.meta}>{model.artifactSource} | {model.artifactLicense}</Text>
                  <ActionButton
                    disabled={selectedOperation || busy || operation?.phase === "paused"}
                    inProgress={selectedOperation}
                    icon={
                      selectedOperation
                        ? <ActivityIndicator color={colors.maroonDark} size="small" />
                        : <Download color={colors.white} size={16} />
                    }
                    label={operationLabel ?? "Download"}
                    onPress={() => void runAction(() => downloadCatalogModel(model))}
                  />
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function ActionButton({
  disabled,
  icon,
  inProgress,
  label,
  onPress,
  secondary
}: {
  disabled?: boolean;
  icon: React.ReactNode;
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
  safeArea: { backgroundColor: colors.maroon, flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 15 },
  backButton: { alignItems: "center", backgroundColor: colors.overlayMedium, borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  headerTitle: { color: colors.white, fontSize: 20, fontWeight: "900" },
  headerGap: { width: 40 },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, flex: 1, overflow: "hidden" },
  content: { gap: 14, padding: 16 },
  card: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: 8, padding: 16 },
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "900", marginTop: 4 },
  modelCard: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 14, borderWidth: 1, gap: 8, padding: 14 },
  modelTitleRow: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" },
  modelName: { color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" },
  body: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  meta: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  notice: { backgroundColor: colors.goldSoft, borderRadius: 9, color: colors.ink, fontSize: 12, fontWeight: "700", lineHeight: 17, padding: 9 },
  warning: { color: colors.danger, fontSize: 12, fontWeight: "700", lineHeight: 17 },
  error: { backgroundColor: colors.dangerSoft, borderRadius: 10, color: colors.danger, fontSize: 13, fontWeight: "800", padding: 12 },
  emptyCard: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 14, borderWidth: 1, padding: 14 },
  activeBadge: { backgroundColor: colors.successSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  activeBadgeText: { color: colors.success, fontSize: 10, fontWeight: "900" },
  rowActions: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  pausedActions: { flexDirection: "row", gap: 10, justifyContent: "center" },
  button: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.maroon, borderRadius: 10, flexDirection: "row", gap: 7, minHeight: 40, paddingHorizontal: 13, paddingVertical: 9 },
  secondaryButton: { backgroundColor: colors.white, borderColor: colors.maroon, borderWidth: 1 },
  buttonText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  secondaryButtonText: { color: colors.maroon },
  inProgressButton: { backgroundColor: colors.goldSoft, borderColor: colors.gold, borderWidth: 1 },
  inProgressButtonText: { color: colors.maroonDark },
  disabled: { opacity: 0.5 }
});
