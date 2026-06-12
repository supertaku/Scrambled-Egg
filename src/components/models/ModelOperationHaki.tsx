import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { ModelOperationState } from "@/ai/localModelManager";
import { HakiMascotCompat, HD_MODEL_OPERATION_IMAGES } from "@/mascot";
import type { ImageSourcePropType } from "react-native";
import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/themes";
import type { MascotStatus } from "../mascot/mascotConfig";

function formatPercent(progress: number | null): string {
  return `${Math.round((progress ?? 0) * 100)}%`;
}

function messageForOperation(operation: ModelOperationState | null, activeModelName: string | null): string {
  if (!operation) {
    return activeModelName
      ? "All Haki modes are ready."
      : "Campus Haki is ready. Download a chat model to unlock supportive modes.";
  }
  switch (operation.phase) {
    case "queued":
      return "Your chat download is queued and may continue while you use another app.";
    case "downloading":
      return `I'm downloading the Haki model: ${formatPercent(operation.progress)} complete.`;
    case "paused":
      return operation.resumable
        ? "The download is paused. Tap Resume when you're ready."
        : "This interrupted download cannot be resumed. Discard it and try again.";
    case "verifying":
      return "The download is complete. I'm checking the file before using it.";
    case "validating":
      return "I'm checking whether this download will work on this phone.";
    case "optimizing":
      return "I'm checking the fastest safe way to run this Haki model.";
    case "waiting_for_chat":
      return "I'll use the new Haki model after I finish the current answer.";
    case "activating":
      return "I'm getting this Haki model ready. Campus Haki is still available.";
    case "removing":
      return "I'm removing this chat download.";
    case "completed":
      return operation.error
        ? "The download was saved, but it cannot be used right now."
        : "Ready. Your local AI option is set up.";
    case "canceled":
      return "The change was canceled. Your current setup was not changed.";
    case "failed":
      return "I could not finish setting up that Haki model. Please try again.";
  }
}

function statusForOperation(operation: ModelOperationState | null): MascotStatus {
  const phase = operation?.phase;
  if (phase === "queued" || phase === "downloading" || phase === "paused") {
    return "thinking";
  }
  if (phase === "verifying" || phase === "validating" || phase === "optimizing") {
    return "teaching";
  }
  if (phase === "activating" || phase === "waiting_for_chat" || phase === "removing") {
    return "thinking";
  }
  if (phase === "completed") return operation?.error ? "error" : "success";
  return phase === "failed" ? "error" : "idle";
}

/** Dedicated HD poses for download lifecycle phases. */
function imageForOperation(operation: ModelOperationState | null): ImageSourcePropType | undefined {
  switch (operation?.phase) {
    case "queued":
    case "downloading":
    case "paused":
      return HD_MODEL_OPERATION_IMAGES.downloading;
    case "verifying":
    case "validating":
    case "optimizing":
      return HD_MODEL_OPERATION_IMAGES.verifying;
    case "activating":
    case "waiting_for_chat":
    case "removing":
      return HD_MODEL_OPERATION_IMAGES.switching;
    case "completed":
      return operation.error ? undefined : HD_MODEL_OPERATION_IMAGES.ready;
    default:
      return undefined;
  }
}

export function ModelOperationHaki({
  activeModelName,
  operation
}: {
  activeModelName: string | null;
  operation: ModelOperationState | null;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [, setClockTick] = useState(0);

  useEffect(() => {
    if (!operation || ["completed", "failed", "canceled"].includes(operation.phase)) return undefined;
    const timer = setInterval(() => setClockTick((tick) => tick + 1), 1000);
    return () => clearInterval(timer);
  }, [operation?.operationId, operation?.phase]);

  return (
    <View style={styles.container}>
      <HakiMascotCompat
        height={158}
        source={imageForOperation(operation)}
        status={statusForOperation(operation)}
        style={styles.mascot}
        width={112}
      />
      <View style={styles.bubble}>
        <View pointerEvents="none" style={styles.tailBorder} />
        <View pointerEvents="none" style={styles.tail} />
        <Text style={styles.name}>HAKI</Text>
        <Text selectable style={styles.message}>{messageForOperation(operation, activeModelName)}</Text>
        {operation && !["completed", "failed", "canceled"].includes(operation.phase) ? (
          <Text style={styles.elapsed}>Working for {Math.max(0, Math.round((Date.now() - Date.parse(operation.startedAt)) / 1000))}s</Text>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  container: { alignItems: "center", flexDirection: "row", minHeight: 168, paddingHorizontal: 12, paddingTop: 8 },
  mascot: { marginRight: -8, zIndex: 2 },
  bubble: {
    backgroundColor: colors.card,
    borderColor: colors.borderStrong,
    borderRadius: 18,
    borderTopLeftRadius: 8,
    borderWidth: 1.5,
    flex: 1,
    gap: 5,
    marginLeft: 4,
    paddingHorizontal: 16,
    paddingVertical: 13,
    position: "relative"
  },
  tailBorder: {
    borderBottomColor: "transparent", borderBottomWidth: 11, borderRightColor: colors.borderStrong,
    borderRightWidth: 16, borderTopColor: "transparent", borderTopWidth: 11, height: 0, left: -16,
    position: "absolute", top: 34, width: 0
  },
  tail: {
    borderBottomColor: "transparent", borderBottomWidth: 9, borderRightColor: colors.white,
    borderRightWidth: 14, borderTopColor: "transparent", borderTopWidth: 9, height: 0, left: -12,
    position: "absolute", top: 36, width: 0
  },
  name: { color: colors.maroon, fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  message: { color: colors.ink, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  elapsed: { color: colors.muted, fontSize: 11, fontWeight: "700" }
});
