import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, CheckCircle2, Lightbulb, PauseCircle, PlayCircle, RefreshCw, Trash2, Upload } from "lucide-react-native";

import {
  activateChatModel,
  cancelGgufDownload,
  discardPausedModelDownload,
  downloadCatalogModel,
  getChatModelLibrary,
  getCompatibleModelCatalog,
  getImportedModelStatus,
  pickAndImportGgufModel,
  recoverInterruptedModelOperation,
  removeImportedModel,
  removeChatModel,
  resumePausedModelDownload,
  subscribeModelOperation,
  type ChatModelLibrary,
  type CompatibleModelCatalog,
  type ImportedModelStatus,
  type InstalledChatModel,
  type ModelOperationState
} from "@/ai/localModelManager";
import type { LocalAIProviderId } from "@/ai/LocalAIProvider";
import { evaluateModelActivation } from "@/ai/modelActivationState";
import { groupCatalogByRecommendation } from "@/ai/modelCatalog";
import { ModelCatalogSection } from "@/components/models/ModelCatalogSection";
import { ModelOperationHaki } from "@/components/models/ModelOperationHaki";
import {
  getCurrentAIMode,
  prewarmLocalAIForChat,
  refreshDeviceCapabilities
} from "@/services/modeSelectionService";
import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/themes";

function formatSize(bytes: number): string {
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

function operationBusy(operation: ModelOperationState | null): boolean {
  return Boolean(operation && !["paused", "completed", "failed", "canceled"].includes(operation.phase));
}

export default function ModelsScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [library, setLibrary] = useState<ChatModelLibrary | null>(null);
  const [embeddingStatus, setEmbeddingStatus] = useState<ImportedModelStatus | null>(null);
  const [catalog, setCatalog] = useState<CompatibleModelCatalog | null>(null);
  const [operation, setOperation] = useState<ModelOperationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<LocalAIProviderId | null>(null);
  const terminalOperationRef = useRef<string | null>(null);

  const load = useCallback(async (refreshMode = false, preserveError = false) => {
    if (!preserveError) setError(null);
    try {
      const mode = refreshMode ? await refreshDeviceCapabilities() : await getCurrentAIMode();
      setSelectedProviderId(mode.summaryProviderId);
      const [nextLibrary, nextCatalog, nextEmbeddingStatus] = await Promise.all([
        getChatModelLibrary(),
        getCompatibleModelCatalog(),
        getImportedModelStatus("embedding")
      ]);
      setLibrary(nextLibrary);
      setCatalog(nextCatalog);
      setEmbeddingStatus(nextEmbeddingStatus);
    } catch {
      if (!preserveError) setError("Could not load Haki Models. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void recoverInterruptedModelOperation()
      .then(setOperation)
      .catch(() => setError("Could not recover the interrupted model download. Discard it and try again."));
    void load();
    return subscribeModelOperation((next) => {
      setOperation(next);
      if (next && ["completed", "failed", "canceled"].includes(next.phase) && terminalOperationRef.current !== next.operationId) {
        terminalOperationRef.current = next.operationId;
        void load(next.phase === "completed", next.phase === "failed");
        if (next.phase === "completed") void prewarmLocalAIForChat();
      }
    });
  }, [load]);

  const runAction = useCallback(async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That change did not finish. Please try again.");
      await load(false, true);
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

  const removeEmbeddingModel = useCallback(() => {
    Alert.alert(
      "Remove semantic search model",
      "Remove the imported embedding model? Campus source search will still work, but semantic search will turn off until another embedding model is imported.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void runAction(() => removeImportedModel("embedding")) }
      ]
    );
  }, [runAction]);

  const activeModel = library?.installedModels.find((model) => model.id === library.activeModelId) ?? null;
  const busy = operationBusy(operation);
  const groupedCatalog = groupCatalogByRecommendation(catalog?.compatibleModels ?? []);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.white} size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>Haki Models</Text>
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

          <View style={styles.notesCard}>
            <View style={styles.notesAccent} />
            <View style={styles.notesHeader}>
              <View style={styles.notesIconBadge}>
                <Lightbulb color={colors.white} size={21} />
              </View>
              <Text style={styles.notesTitle}>Haki Notes</Text>
            </View>
            <View style={styles.notesList}>
              <NoteBullet text="Haki only shows models that are suitable for this phone." />
              <NoteBullet text="Downloaded models run on this phone and can work offline." />
              <NoteBullet text="If Haki feels slow, switch to a smaller downloaded model." />
            </View>
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
            library.installedModels.map((model) => {
              const activation = evaluateModelActivation({
                activeModelId: library.activeModelId,
                filePresent: model.filePresent === true,
                manifestPresent: model.manifestPresent === true,
                modelId: model.id,
                runtimeAvailable: model.runtimeAvailable === true,
                runtimeFormat: model.runtimeFormat ?? "gguf",
                selectedProviderId,
                smokeTestStatus: model.evaluationStatus ?? "pending",
                smokeTestFailureReason: model.activationFailureReason ?? null
              });
              return (
              <View key={model.id} style={styles.modelCard}>
                <View style={styles.modelTitleRow}>
                  <Text selectable style={styles.modelName}>{model.modelName}</Text>
                  {activation.ready ? (
                    <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>IN USE</Text></View>
                  ) : null}
                </View>
                <Text selectable style={styles.meta}>
                  {formatSize(model.sizeBytes)}
                  {model.source === "legacy-bundled" ? " | Previously installed" : ""}
                </Text>
                {!activation.ready && (model.activationFailureReason || model.rejectionReasons.length > 0) ? (
                  <Text selectable style={styles.warning}>
                    {model.activationFailureReason ?? model.rejectionReasons[0] ?? "This download cannot be used on this phone."}
                  </Text>
                ) : null}
                <View style={styles.rowActions}>
                  {!activation.ready ? (
                    <ActionButton disabled={busy} icon={<CheckCircle2 color={colors.white} size={16} />} label="Use" onPress={() => void runAction(() => activateChatModel(model.id))} />
                  ) : null}
                  <ActionButton disabled={busy} secondary icon={<Trash2 color={colors.maroon} size={16} />} label="Remove" onPress={() => removeModel(model)} />
                </View>
              </View>
              );
            })
          )}

          <Text style={styles.sectionTitle}>Semantic search model</Text>
          <View style={styles.modelCard}>
            <View style={styles.modelTitleRow}>
              <Text selectable style={styles.modelName}>
                {embeddingStatus?.state === "available"
                  ? embeddingStatus.manifest?.modelName ?? "Imported embedding GGUF"
                  : "No embedding model imported"}
              </Text>
              {embeddingStatus?.state === "available" ? (
                <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>READY</Text></View>
              ) : null}
            </View>
            <Text selectable style={styles.body}>
              Semantic search improves source matching for wording that does not exactly match the saved campus guide. It stays off until you import a verified GGUF embedding model.
            </Text>
            {embeddingStatus?.state === "rejected" ? (
              <Text selectable style={styles.warning}>{embeddingStatus.rejectionReasons[0] ?? "This embedding model cannot be used on this phone."}</Text>
            ) : null}
            {embeddingStatus?.state === "available" && embeddingStatus.manifest ? (
              <Text selectable style={styles.meta}>About {formatSize(embeddingStatus.manifest.sizeBytes)}</Text>
            ) : null}
            <View style={styles.rowActions}>
              <ActionButton
                disabled={busy}
                icon={<Upload color={colors.white} size={16} />}
                label={embeddingStatus?.state === "available" ? "Replace" : "Import"}
                onPress={() => void runAction(() => pickAndImportGgufModel("embedding"))}
              />
              {embeddingStatus?.state !== "missing" ? (
                <ActionButton
                  disabled={busy}
                  secondary
                  icon={<Trash2 color={colors.maroon} size={16} />}
                  label="Remove"
                  onPress={removeEmbeddingModel}
                />
              ) : null}
            </View>
          </View>

          <ModelCatalogSection
            busy={busy}
            catalog={catalog}
            disabledReason={(model) => model.runtimeFormat === "litert-lm" && catalog?.runtimeAvailability["litert-lm"] !== true
              ? "Updated Android build required: LiteRT-LM bridge is not available."
              : null}
            emptyText="No recommended chat download is available right now."
            models={groupedCatalog.recommended}
            onDownload={(model) => void runAction(() => downloadCatalogModel(model))}
            operation={operation}
            title="Recommended for this phone"
          />
          <ModelCatalogSection
            busy={busy}
            catalog={catalog}
            disabledReason={(model) => model.runtimeFormat === "litert-lm" && catalog?.runtimeAvailability["litert-lm"] !== true
              ? "Updated Android build required: LiteRT-LM bridge is not available."
              : null}
            emptyText="No other compatible chat downloads are available right now."
            models={groupedCatalog.alternative}
            onDownload={(model) => void runAction(() => downloadCatalogModel(model))}
            operation={operation}
            title="Other compatible models"
          />
          {groupedCatalog.experimental.length > 0 ? (
            <ModelCatalogSection
              busy={busy}
              catalog={catalog}
              disabledReason={(model) => model.runtimeFormat === "litert-lm" && catalog?.runtimeAvailability["litert-lm"] !== true
                ? "Updated Android build required: LiteRT-LM bridge is not available."
                : null}
              emptyText="No experimental high-RAM downloads are available for this phone."
              models={groupedCatalog.experimental}
              onDownload={(model) => void runAction(() => downloadCatalogModel(model))}
              operation={operation}
              title="Experimental high-RAM"
            />
          ) : null}

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function NoteBullet({ text }: { text: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.notesBulletRow}>
      <View style={styles.notesBulletDot} />
      <Text selectable style={styles.notesBulletText}>{text}</Text>
    </View>
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
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
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

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  safeArea: { backgroundColor: colors.maroon, flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 15 },
  backButton: { alignItems: "center", backgroundColor: colors.overlayMedium, borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  headerTitle: { color: colors.white, fontSize: 20, fontWeight: "900" },
  headerGap: { width: 40 },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, flex: 1, overflow: "hidden" },
  content: { gap: 14, padding: 16 },
  notesCard: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.goldBorder,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 3,
    gap: 14,
    overflow: "hidden",
    padding: 16,
    paddingLeft: 21,
    shadowColor: colors.maroon,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 8
  },
  notesAccent: { backgroundColor: colors.maroon, bottom: 0, left: 0, position: "absolute", top: 0, width: 5 },
  notesHeader: { alignItems: "center", flexDirection: "row", gap: 11 },
  notesIconBadge: { alignItems: "center", backgroundColor: colors.maroon, borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  notesTitle: { color: colors.ink, fontSize: 19, fontWeight: "900" },
  notesList: { gap: 10 },
  notesBulletRow: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  notesBulletDot: { backgroundColor: colors.maroon, borderRadius: 4, height: 8, marginTop: 6, width: 8 },
  notesBulletText: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 20 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "900", marginTop: 4 },
  modelCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, gap: 8, padding: 14 },
  modelTitleRow: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" },
  modelName: { color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" },
  body: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  meta: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  notice: { backgroundColor: colors.goldSoft, borderRadius: 9, color: colors.ink, fontSize: 12, fontWeight: "700", lineHeight: 17, padding: 9 },
  warning: { color: colors.danger, fontSize: 12, fontWeight: "700", lineHeight: 17 },
  forecast: { color: colors.success, fontSize: 12, fontWeight: "700", lineHeight: 17 },
  recommendedBadge: { alignItems: "center", backgroundColor: colors.warningSoft, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  recommendedText: { color: colors.warning, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  error: { backgroundColor: colors.dangerSoft, borderRadius: 10, color: colors.danger, fontSize: 13, fontWeight: "800", padding: 12 },
  emptyCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, padding: 14 },
  activeBadge: { backgroundColor: colors.successSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  activeBadgeText: { color: colors.success, fontSize: 10, fontWeight: "900" },
  rowActions: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  pausedActions: { flexDirection: "row", gap: 10, justifyContent: "center" },
  button: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.maroon, borderRadius: 10, flexDirection: "row", gap: 7, minHeight: 40, paddingHorizontal: 13, paddingVertical: 9 },
  secondaryButton: { backgroundColor: colors.card, borderColor: colors.maroon, borderWidth: 1 },
  buttonText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  secondaryButtonText: { color: colors.maroon },
  inProgressButton: { backgroundColor: colors.goldSoft, borderColor: colors.gold, borderWidth: 1 },
  inProgressButtonText: { color: colors.maroonDark },
  disabled: { opacity: 0.5 }
});
