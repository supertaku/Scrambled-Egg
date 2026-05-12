import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AlertTriangle, CheckCircle2, Cpu, Download, Trash2, Upload } from "lucide-react-native";

import { ANDROID_LOCAL_MODEL_REQUIREMENTS, ANDROID_LOCAL_MODEL_TIERS, ANDROID_MODEL_TIER_ORDER } from "@/ai/localModelRequirements";
import type { ImportedModelStatus } from "@/ai/localModelManager";
import { GGUF_MODELS, type GgufDownloadConfig } from "@/ai/modelDownloadConfig";
import { colors } from "@/theme/colors";

type RecommendationLabel = { text: string; color: string; bg: string } | null;

function activeDownloadId(status: ImportedModelStatus | null): string | null {
  return status?.manifest?.downloadId ?? status?.manifest?.sourceId ?? null;
}

function matchesActiveModel(status: ImportedModelStatus | null, model: GgufDownloadConfig): boolean {
  if (status?.state !== "available" || !status.manifest) return false;
  const id = activeDownloadId(status);
  if (id === model.id) return true;
  if (model.bundled && status.manifest.source === "bundled") return true;

  const normalizedName = status.manifest.originalName.toLowerCase();
  return normalizedName === decodeURIComponent(model.url.split("/").pop()?.split("?")[0] ?? "").toLowerCase();
}

function downloadedLabel(status: ImportedModelStatus | null, model: GgufDownloadConfig): "active" | "downloaded" | null {
  if (matchesActiveModel(status, model)) return "active";
  if (status?.manifest?.downloadId === model.id || status?.manifest?.sourceId === model.id) return "downloaded";
  return null;
}

function formatMs(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not reported" : `${Math.round(value)}ms`;
}

function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Not reported";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)}GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)}MB`;
  return `${Math.round(value / 1024)}KB`;
}

function ProviderMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.providerMeta}>
      <Text style={styles.providerMetaLabel}>{label}</Text>
      <Text style={styles.providerMetaValue}>{value}</Text>
    </View>
  );
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

export function SettingsModelsSection({
  chatModelStatus,
  downloadProgress,
  downloadingId,
  getModelRecommendationLabel,
  modelBusy,
  modelMessage,
  onCancelDownload,
  onDownloadModel,
  onImportChatModel,
  onRemoveChatModel
}: {
  chatModelStatus: ImportedModelStatus | null;
  downloadProgress: number | null;
  downloadingId: string | null;
  getModelRecommendationLabel: (modelTier: string) => RecommendationLabel;
  modelBusy: boolean;
  modelMessage: string | null;
  onCancelDownload: () => void;
  onDownloadModel: (model: GgufDownloadConfig) => void;
  onImportChatModel: () => void;
  onRemoveChatModel: () => void;
}) {
  return (
    <View style={styles.card}>
      <Cpu color={colors.maroon} size={24} />
      <Text style={styles.cardTitle}>Android GGUF chat model</Text>
      <Text style={styles.cardText}>
        Llama 3.2 1B is the bundled default for most 6GB+ phones. Tiny GGUF stays available as a downloadable
        fallback for older devices.
      </Text>
      {chatModelStatus ? <ModelStatus status={chatModelStatus} /> : null}
      <View style={styles.modelActions}>
        <Pressable
          accessibilityRole="button"
          disabled={modelBusy}
          onPress={onImportChatModel}
          style={[styles.modelButton, modelBusy ? styles.disabledButton : undefined]}
        >
          {modelBusy ? <ActivityIndicator color={colors.white} size="small" /> : <Upload color={colors.white} size={16} />}
          <Text style={styles.modelButtonText}>Import GGUF</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={modelBusy || chatModelStatus?.state === "missing"}
          onPress={onRemoveChatModel}
          style={[
            styles.modelButton,
            styles.removeModelButton,
            modelBusy || chatModelStatus?.state === "missing" ? styles.disabledOutlineButton : undefined
          ]}
        >
          <Trash2 color={colors.maroon} size={16} />
          <Text style={styles.removeModelButtonText}>Remove Model</Text>
        </Pressable>
      </View>
      {modelMessage ? <Text style={styles.modelMessage}>{modelMessage}</Text> : null}

      <View style={styles.requirementTable}>
        <View style={[styles.requirementRow, styles.requirementHeaderRow]}>
          <Text style={[styles.requirementCell, styles.requirementTierCell, styles.requirementHeaderCell]}>Tier</Text>
          <Text style={[styles.requirementCell, styles.requirementModelCell, styles.requirementHeaderCell]}>Model</Text>
          <Text style={[styles.requirementCell, styles.requirementHeaderCell]}>RAM</Text>
          <Text style={[styles.requirementCell, styles.requirementHeaderCell]}>Storage</Text>
          <Text style={[styles.requirementCell, styles.requirementActionCell, styles.requirementHeaderCell]}>Status</Text>
          <Text style={[styles.requirementIconCell, styles.requirementHeaderCell]}> </Text>
        </View>
        {ANDROID_MODEL_TIER_ORDER.map((tier) => {
          const requirement = ANDROID_LOCAL_MODEL_TIERS[tier];
          const model = GGUF_MODELS.find((item) => item.tier === tier);
          if (!model) return null;

          const labelInfo = getModelRecommendationLabel(tier);
          const isDownloading = downloadingId === model.id;
          const percentage = downloadProgress === null ? 0 : Math.round(downloadProgress * 100);
          const rowStatus = downloadedLabel(chatModelStatus, model);
          const isActive = rowStatus === "active";
          const isDownloaded = rowStatus === "downloaded";
          const buttonDisabled = modelBusy || isActive || isDownloaded || model.bundled;
          const Icon =
            isActive || isDownloaded || model.bundled ? CheckCircle2 : labelInfo?.text === "Overloads" ? AlertTriangle : Download;
          const iconColor =
            isActive || isDownloaded || model.bundled ? colors.success : labelInfo?.text === "Overloads" ? colors.danger : colors.maroon;

          return (
            <View key={tier} style={styles.requirementRow}>
              <Text style={[styles.requirementCell, styles.requirementTierCell]}>{tier}</Text>
              <View style={[styles.requirementCell, styles.requirementModelCell]}>
                <Text style={styles.requirementModelName}>{model.name}</Text>
                <Text style={styles.requirementModelMeta}>
                  {model.sizeMB} MB - {requirement.summary}
                </Text>
                <Text style={styles.requirementDescription}>{model.description}</Text>
                {labelInfo ? (
                  <View style={[styles.downloadLabelBadge, { backgroundColor: labelInfo.bg }]}>
                    <Text style={[styles.downloadLabelText, { color: labelInfo.color }]}>{labelInfo.text}</Text>
                  </View>
                ) : null}
                {isDownloading && downloadProgress !== null ? (
                  <View style={styles.inlineProgress}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressText}>{percentage}%</Text>
                      <Text style={styles.progressText}>Downloading</Text>
                    </View>
                    <View style={styles.progressContainer}>
                      <View style={[styles.progressBar, { width: `${percentage}%` }]} />
                    </View>
                  </View>
                ) : null}
              </View>
              <Text style={styles.requirementCell}>{requirement.minimumRamGB}GB+</Text>
              <Text style={styles.requirementCell}>{requirement.minimumFreeStorageGB}GB+</Text>
              <View style={[styles.requirementCell, styles.requirementActionCell]}>
                {isDownloading ? (
                  <Pressable accessibilityRole="button" onPress={onCancelDownload} style={styles.cancelDownloadBtn}>
                    <Text style={styles.cancelDownloadText}>Cancel</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    disabled={buttonDisabled}
                    onPress={() => onDownloadModel(model)}
                    style={[
                      styles.startDownloadBtn,
                      buttonDisabled ? styles.disabledOutlineButton : undefined,
                      isActive || isDownloaded || model.bundled ? styles.downloadedButton : undefined
                    ]}
                  >
                    <Text
                      style={[
                        styles.startDownloadText,
                        isActive || isDownloaded || model.bundled ? styles.downloadedButtonText : undefined
                      ]}
                    >
                      {isActive ? "Active" : isDownloaded ? "Downloaded" : model.bundled ? "Bundled" : "Download"}
                    </Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.requirementIconCell}>
                <Icon color={iconColor} size={18} />
              </View>
            </View>
          );
        })}
      </View>
      <Text style={styles.cardText}>
        Android baseline: API {ANDROID_LOCAL_MODEL_REQUIREMENTS.minimumAndroidApi}+ and {ANDROID_LOCAL_MODEL_REQUIREMENTS.requiredAbi}.
      </Text>
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
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  cardText: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  modelActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
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
  removeModelButton: { backgroundColor: colors.white },
  modelButtonText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  removeModelButtonText: { color: colors.maroon, fontSize: 13, fontWeight: "900" },
  disabledButton: { backgroundColor: colors.grayhawk },
  disabledOutlineButton: { borderColor: colors.border, opacity: 0.55 },
  modelMessage: { color: colors.maroonDark, fontSize: 13, fontWeight: "800", lineHeight: 18 },
  modelStatusCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12
  },
  providerHeader: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  providerName: { color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" },
  providerBadge: { borderRadius: 999, fontSize: 11, fontWeight: "900", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4 },
  availableBadge: { backgroundColor: colors.success, color: colors.white },
  unavailableBadge: { backgroundColor: colors.goldSoft, color: colors.ink },
  providerMetaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  providerMeta: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: "45%",
    padding: 8
  },
  providerMetaLabel: { color: colors.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  providerMetaValue: { color: colors.ink, fontSize: 12, fontWeight: "800", marginTop: 2 },
  providerReason: { color: colors.muted, fontSize: 12, fontWeight: "700", lineHeight: 17 },
  requirementTable: { borderColor: colors.border, borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  requirementRow: { alignItems: "stretch", backgroundColor: colors.white, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row" },
  requirementHeaderRow: { backgroundColor: colors.surface, borderTopWidth: 0 },
  requirementCell: { color: colors.ink, flex: 1, fontSize: 11, fontWeight: "800", paddingHorizontal: 6, paddingVertical: 9 },
  requirementTierCell: { flex: 0.8, textTransform: "capitalize" },
  requirementModelCell: { flex: 2.7, gap: 4 },
  requirementActionCell: { alignItems: "center", flex: 1.2, justifyContent: "center" },
  requirementIconCell: { alignItems: "center", justifyContent: "center", paddingVertical: 9, width: 30 },
  requirementHeaderCell: { color: colors.maroon, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  requirementModelName: { color: colors.ink, fontSize: 12, fontWeight: "900", lineHeight: 16 },
  requirementModelMeta: { color: colors.maroon, fontSize: 10, fontWeight: "900", lineHeight: 14 },
  requirementDescription: { color: colors.muted, fontSize: 10, fontWeight: "700", lineHeight: 14 },
  downloadLabelBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  downloadLabelText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  inlineProgress: { marginTop: 4 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  progressText: { color: colors.maroon, fontSize: 11, fontWeight: "900" },
  progressContainer: { backgroundColor: colors.border, borderRadius: 4, height: 4, marginTop: 6, overflow: "hidden", width: "100%" },
  progressBar: { backgroundColor: colors.maroon, height: "100%" },
  startDownloadBtn: {
    alignItems: "center",
    backgroundColor: colors.maroon,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 78,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  startDownloadText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  downloadedButton: { backgroundColor: colors.successSoft, borderColor: colors.success, borderWidth: 1 },
  downloadedButtonText: { color: colors.success },
  cancelDownloadBtn: {
    alignItems: "center",
    backgroundColor: colors.grayhawk,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 78,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  cancelDownloadText: { color: colors.white, fontSize: 12, fontWeight: "900" }
});
