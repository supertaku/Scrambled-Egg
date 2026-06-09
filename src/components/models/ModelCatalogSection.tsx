import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Download } from "lucide-react-native";

import type { CompatibleModelCatalog, ModelOperationState } from "@/ai/localModelManager";
import { colors } from "@/theme/colors";

import { ModelActionButton } from "./ModelActionButton";

type CatalogModel = CompatibleModelCatalog["compatibleModels"][number];

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

function runtimeLabel(model: CatalogModel): string {
  switch (model.runtimeFormat) {
    case "litert-lm":
      return "LiteRT-LM";
    case "onnx-genai":
      return "ONNX GenAI";
    default:
      return "GGUF";
  }
}

function catalogModelMeta(model: CatalogModel): string {
  return [
    runtimeLabel(model),
    `About ${model.sizeMB} MB`,
    `${model.minimumRamGB}GB+ RAM`,
    `${model.artifactLicense}`
  ].join(" | ");
}

export function ModelCatalogSection({
  busy,
  emptyText,
  models,
  onDownload,
  operation,
  title
}: {
  busy: boolean;
  emptyText: string;
  models: CompatibleModelCatalog["compatibleModels"];
  onDownload: (model: CatalogModel) => void;
  operation: ModelOperationState | null;
  title: string;
}) {
  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!models.length ? (
        <View style={styles.emptyCard}><Text selectable style={styles.body}>{emptyText}</Text></View>
      ) : (
        models.map((model) => {
          const operationLabel = catalogOperationLabel(operation, model.id);
          const selectedOperation = operationLabel !== null;

          return (
            <View key={model.id} style={styles.modelCard}>
              <Text selectable style={styles.modelName}>{model.name}</Text>
              <Text selectable style={styles.meta}>{catalogModelMeta(model)}</Text>
              <Text selectable style={styles.body}>{model.description}</Text>
              <Text selectable style={styles.meta}>{model.artifactSource}</Text>
              {model.lifecycleChannel === "evaluation" && model.activationPolicy === "manual" ? (
                <Text selectable style={styles.notice}>Experimental: manual activation after on-device smoke testing.</Text>
              ) : null}
              <ModelActionButton
                disabled={selectedOperation || busy || operation?.phase === "paused"}
                inProgress={selectedOperation}
                icon={
                  selectedOperation
                    ? <ActivityIndicator color={colors.maroonDark} size="small" />
                    : <Download color={colors.white} size={16} />
                }
                label={operationLabel ?? "Download"}
                onPress={() => onDownload(model)}
              />
            </View>
          );
        })
      )}
    </>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  emptyCard: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 14, borderWidth: 1, padding: 14 },
  meta: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  modelCard: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 14, borderWidth: 1, gap: 8, padding: 14 },
  modelName: { color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" },
  notice: { backgroundColor: colors.goldSoft, borderRadius: 9, color: colors.ink, fontSize: 12, fontWeight: "700", lineHeight: 17, padding: 9 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "900", marginTop: 4 }
});
