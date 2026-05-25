import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Database, FilePlus, LibraryBig } from "lucide-react-native";

import type { DatabaseStats } from "@/db/documentRepository";
import type { DocumentSummary } from "@/types/document";
import { colors } from "@/theme/colors";

function formatDate(value: string | null | undefined): string {
  return value?.trim() || "No date";
}

export function SettingsDbSection({
  documents,
  error,
  loading,
  seedVersion,
  stats
}: {
  documents: DocumentSummary[];
  error: string | null;
  loading: boolean;
  seedVersion: string | null;
  stats: DatabaseStats | null;
}) {
  const router = useRouter();

  return (
    <View style={styles.card}>
      <Database color={colors.maroon} size={24} />
      <Text style={styles.cardTitle}>Saved campus files</Text>
      <View style={styles.actionRow}>
        <Pressable
          accessibilityLabel="Open campus files"
          accessibilityRole="button"
          onPress={() => router.push("/documents")}
          style={styles.actionButton}
        >
          <LibraryBig color={colors.maroon} size={16} />
          <Text style={styles.actionButtonText}>Library</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Add a campus file"
          accessibilityRole="button"
          onPress={() => router.push("/add-document")}
          style={styles.actionButton}
        >
          <FilePlus color={colors.maroon} size={16} />
          <Text style={styles.actionButtonText}>Add</Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.maroon} />
      ) : error ? (
        <Text selectable style={styles.errorText}>{error}</Text>
      ) : documents.length === 0 ? (
        <Text selectable style={styles.cardText}>No campus files saved yet.</Text>
      ) : (
        <View style={styles.documentTable}>
          <View style={[styles.documentRow, styles.documentHeaderRow]}>
            <Text style={[styles.documentTitleCell, styles.documentHeaderCell]}>Title</Text>
            <Text style={[styles.documentDateCell, styles.documentHeaderCell]}>Last updated</Text>
          </View>
          {documents.map((document) => (
            <View key={document.documentId} style={styles.documentRow}>
              <Text selectable numberOfLines={2} style={styles.documentTitleCell}>
                {document.documentTitle}
              </Text>
              <Text selectable style={styles.documentDateCell}>{formatDate(document.lastUpdated)}</Text>
            </View>
          ))}
        </View>
      )}
      <Text selectable style={styles.documentFooter}>
        {stats?.documentCount ?? 0} campus files - {stats?.chunkCount ?? 0} topics - guide version {seedVersion ?? "not ready"}
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
  actionRow: {
    flexDirection: "row",
    gap: 8
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.maroonSoft,
    borderColor: "#E8C7D0",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 12
  },
  actionButtonText: {
    color: colors.maroon,
    fontSize: 13,
    fontWeight: "900"
  },
  documentTable: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden"
  },
  documentRow: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  documentHeaderRow: {
    backgroundColor: colors.surface,
    borderTopWidth: 0
  },
  documentHeaderCell: {
    color: colors.maroon,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  documentTitleCell: {
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16
  },
  documentDateCell: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
    width: 98
  },
  documentFooter: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20
  }
});
