import { useCallback } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, CheckCircle2, Cpu, PauseCircle, PlayCircle, RefreshCw, Trash2, Upload } from "lucide-react-native";

import { groupCatalogByRecommendation } from "@/ai/modelCatalog";
import { ModelActionButton } from "@/components/models/ModelActionButton";
import { ModelCatalogSection } from "@/components/models/ModelCatalogSection";
import { ModelOperationHaki } from "@/components/models/ModelOperationHaki";
import { useModelManagerState, type ModelManagerInstalledChatModel } from "@/hooks/useModelManagerState";
import { colors } from "@/theme/colors";

function formatSize(bytes: number): string {
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

export default function ModelsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    activateModel,
    activeModel,
    busy,
    cancelDownload,
    catalog,
    discardPausedDownload,
    downloadModel,
    embeddingStatus,
    error,
    importEmbeddingModel,
    library,
    load,
    loading,
    operation,
    removeEmbeddingModel,
    removeModel,
    resumePausedDownload
  } = useModelManagerState();

  const confirmRemoveModel = useCallback((model: ModelManagerInstalledChatModel) => {
    Alert.alert(
      "Remove chat download",
      `Remove this chat download and free about ${formatSize(model.sizeBytes)}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void removeModel(model.id) }
      ]
    );
  }, [removeModel]);

  const confirmRemoveEmbeddingModel = useCallback(() => {
    Alert.alert(
      "Remove semantic search model",
      "Remove the imported embedding model? Campus source search will still work, but semantic search will turn off until another embedding model is imported.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void removeEmbeddingModel() }
      ]
    );
  }, [removeEmbeddingModel]);

  const groupedCatalog = groupCatalogByRecommendation(catalog?.compatibleModels ?? []);
  const recommendedModels = groupedCatalog.recommended;
  const alternativeModels = groupedCatalog.alternative;
  const experimentalModels = groupedCatalog.experimental;

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
                <ModelActionButton icon={<PlayCircle color={colors.white} size={16} />} label="Resume" onPress={() => void resumePausedDownload()} />
              ) : null}
              <ModelActionButton secondary icon={<Trash2 color={colors.maroon} size={16} />} label="Discard" onPress={() => void discardPausedDownload()} />
            </View>
          ) : operation && ["queued", "downloading", "verifying", "optimizing"].includes(operation.phase) ? (
            <ModelActionButton secondary icon={<PauseCircle color={colors.maroon} size={16} />} label="Cancel" onPress={() => void cancelDownload()} />
          ) : null}

          {error ? <Text selectable style={styles.error}>{error}</Text> : null}
          {loading ? <ActivityIndicator color={colors.maroon} /> : null}

          <View style={styles.reminderCard}>
            <Text selectable style={styles.reminderText}>
              If Haki feels slow, switch to another downloaded model, or remove this model and install a smaller one.
            </Text>
          </View>

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
              <ModelActionButton
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
                    <ModelActionButton disabled={busy} icon={<CheckCircle2 color={colors.white} size={16} />} label="Use" onPress={() => void activateModel(model.id)} />
                  ) : null}
                  <ModelActionButton disabled={busy} secondary icon={<Trash2 color={colors.maroon} size={16} />} label="Remove" onPress={() => confirmRemoveModel(model)} />
                </View>
              </View>
            ))
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
              <ModelActionButton
                disabled={busy}
                icon={<Upload color={colors.white} size={16} />}
                label={embeddingStatus?.state === "available" ? "Replace" : "Import"}
                onPress={() => void importEmbeddingModel()}
              />
              {embeddingStatus?.state !== "missing" ? (
                <ModelActionButton
                  disabled={busy}
                  secondary
                  icon={<Trash2 color={colors.maroon} size={16} />}
                  label="Remove"
                  onPress={confirmRemoveEmbeddingModel}
                />
              ) : null}
            </View>
          </View>

          <ModelCatalogSection
            busy={busy}
            emptyText="No recommended chat download is available right now."
            models={recommendedModels}
            onDownload={(model) => void downloadModel(model)}
            operation={operation}
            title="Recommended for this phone"
          />
          <ModelCatalogSection
            busy={busy}
            emptyText="No compatible alternative downloads are available right now."
            models={alternativeModels}
            onDownload={(model) => void downloadModel(model)}
            operation={operation}
            title="Compatible alternatives"
          />
          <ModelCatalogSection
            busy={busy}
            emptyText="No experimental high-RAM downloads are available for this phone."
            models={experimentalModels}
            onDownload={(model) => void downloadModel(model)}
            operation={operation}
            title="Experimental high-RAM"
          />
        </ScrollView>
      </View>
    </SafeAreaView>
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
  reminderCard: { backgroundColor: colors.goldSoft, borderColor: colors.gold, borderRadius: 14, borderWidth: 1, padding: 12 },
  reminderText: { color: colors.ink, fontSize: 13, fontWeight: "800", lineHeight: 18 },
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
});
