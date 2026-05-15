import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { BookOpenText, FilePlus, RefreshCw } from "lucide-react-native";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminGate } from "@/components/AdminGate";
import { MascotHeader } from "@/components/MascotHeader";
import { getAppDatabase } from "@/data/appRepository";
import { getDocumentSummaries } from "@/db/documentRepository";
import { colors } from "@/theme/colors";
import type { DocumentSummary } from "@/types/document";

export default function DocumentsScreen() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = await getAppDatabase();
      setDocuments(await getDocumentSummaries(db));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDocuments();
    }, [loadDocuments])
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <MascotHeader message="Admin view ito, TUPian. Dito mo makikita ang saved campus documents." subtitle="Document library" />

        <AdminGate label="Document metadata is available in admin mode only.">
          <View style={styles.toolbar}>
            <View style={styles.toolbarTitle}>
              <BookOpenText color={colors.maroon} size={22} />
              <Text style={styles.title}>Local documents</Text>
            </View>
            <View style={styles.toolbarActions}>
              <Pressable
                accessibilityLabel="Import source document JSON"
                accessibilityRole="button"
                onPress={() => router.push("/add-document")}
                style={styles.refreshButton}
              >
                <FilePlus color={colors.maroon} size={18} />
              </Pressable>
              <Pressable accessibilityLabel="Refresh documents" accessibilityRole="button" onPress={loadDocuments} style={styles.refreshButton}>
                <RefreshCw color={colors.maroon} size={18} />
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={styles.statusCard}>
              <ActivityIndicator color={colors.maroon} />
              <Text style={styles.statusText}>Loading local document metadata...</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!loading && documents.length === 0 ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>No documents indexed</Text>
              <Text style={styles.statusText}>Import campus document files or restart the app to load bundled demo documents.</Text>
            </View>
          ) : null}

          <View style={styles.list}>
            {documents.map((document) => (
              <View key={document.documentId} style={styles.card}>
                <Text style={styles.documentTitle}>{document.documentTitle}</Text>
                <View style={styles.metaGrid}>
                  <Meta label="Category" value={document.category} />
                  <Meta label="Office" value={document.office} />
                  <Meta label="Type" value={document.documentType} />
                  <Meta label="Version" value={document.version} />
                  <Meta label="Chunks" value={document.chunkCount} />
                  <Meta label="Last updated" value={document.lastUpdated} />
                </View>
              </View>
            ))}
          </View>
        </AdminGate>
      </ScrollView>
    </SafeAreaView>
  );
}

function Meta({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === "") {
    return null;
  }

  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.maroon,
    flex: 1
  },
  content: {
    backgroundColor: colors.surface,
    gap: 18,
    paddingBottom: 28
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18
  },
  toolbarTitle: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  toolbarActions: {
    flexDirection: "row",
    gap: 8
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900"
  },
  refreshButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  list: {
    gap: 12,
    paddingHorizontal: 18
  },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  documentTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 23
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  metaItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: "45%",
    padding: 10
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  metaValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3
  },
  statusCard: {
    alignItems: "flex-start",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    marginHorizontal: 18,
    padding: 16
  },
  statusTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  statusText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  errorCard: {
    backgroundColor: "#FFF1F0",
    borderColor: "#FDA29B",
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 18,
    padding: 14
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20
  }
});
