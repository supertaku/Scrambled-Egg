import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Download } from "lucide-react-native";

import type { CompatibleModelCatalog, ModelOperationState } from "@/ai/localModelManager";
import { forecastStorageForModel } from "@/ai/storageForecast";
import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/themes";

type CatalogModel = CompatibleModelCatalog["compatibleModels"][number];

function operationLabel(operation: ModelOperationState | null, catalogId: string): string | null {
  if (!operation || operation.catalogId !== catalogId) return null;
  switch (operation.phase) {
    case "queued": return "Queued...";
    case "downloading": return "Downloading...";
    case "paused": return "Paused";
    case "verifying":
    case "validating": return "Checking...";
    case "optimizing": return "Optimizing...";
    case "waiting_for_chat":
    case "activating": return "Preparing...";
    default: return null;
  }
}

function runtimeLabel(model: CatalogModel): string {
  return model.runtimeFormat === "litert-lm" ? "LiteRT-LM" : "GGUF";
}

function downloadSizeLabel(sizeMB: number): string {
  return sizeMB >= 1024 ? `${(sizeMB / 1024).toFixed(2)} GB` : `${Math.round(sizeMB)} MB`;
}

export function ModelCatalogSection({
  busy,
  catalog,
  disabledReason,
  emptyText,
  models,
  onDownload,
  operation,
  title
}: {
  busy: boolean;
  catalog: CompatibleModelCatalog | null;
  disabledReason?: (model: CatalogModel) => string | null;
  emptyText: string;
  models: CatalogModel[];
  onDownload: (model: CatalogModel) => void;
  operation: ModelOperationState | null;
  title: string;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!models.length ? (
        <View style={styles.emptyCard}><Text selectable style={styles.body}>{emptyText}</Text></View>
      ) : models.map((model) => {
        const activeLabel = operationLabel(operation, model.id);
        const selectedOperation = activeLabel !== null;
        const reason = disabledReason?.(model) ?? null;
        const forecast = catalog ? forecastStorageForModel(model, catalog.hardware) : null;

        return (
          <View key={model.id} style={styles.modelCard}>
            <Text selectable style={styles.modelName}>{model.name}</Text>
            <Text selectable style={styles.meta}>
              Download: {downloadSizeLabel(model.sizeMB)} | Device RAM: {model.minimumRamGB} GB minimum, {model.recommendedRamGB} GB recommended | {runtimeLabel(model)}
            </Text>
            <Text selectable style={styles.body}>{model.description}</Text>
            {forecast?.summary ? <Text selectable style={styles.forecast}>{forecast.summary}</Text> : null}
            <Text selectable style={styles.meta}>{model.artifactSource} | {model.artifactLicense}</Text>
            {reason ? <Text selectable style={styles.warning}>{reason}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={Boolean(reason) || selectedOperation || busy || operation?.phase === "paused"}
              onPress={() => onDownload(model)}
              style={[styles.button, (Boolean(reason) || busy) && !selectedOperation ? styles.disabled : undefined]}
            >
              {selectedOperation
                ? <ActivityIndicator color={colors.white} size="small" />
                : <Download color={colors.white} size={16} />}
              <Text style={styles.buttonText}>{activeLabel ?? "Download"}</Text>
            </Pressable>
          </View>
        );
      })}
    </>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  body: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  button: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.maroon, borderRadius: 10, flexDirection: "row", gap: 7, minHeight: 40, paddingHorizontal: 13, paddingVertical: 9 },
  buttonText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  emptyCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, padding: 14 },
  forecast: { color: colors.success, fontSize: 12, fontWeight: "700", lineHeight: 17 },
  meta: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  modelCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, gap: 8, padding: 14 },
  modelName: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "900", marginTop: 4 },
  warning: { color: colors.danger, fontSize: 12, fontWeight: "700", lineHeight: 17 }
});
