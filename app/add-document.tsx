import { useMemo, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { CheckCircle2, FileJson, FilePlus, Upload } from "lucide-react-native";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminGate } from "@/components/AdminGate";
import { MascotHeader } from "@/components/MascotHeader";
import { importDocumentsFromJson, validateImportText } from "@/services/documentImportService";
import { colors } from "@/theme/colors";
import type { ImportResult, ValidationResult } from "@/types/document";

const placeholderJson = `[
  {
    "document_id": "official_registrar_2026",
    "document_title": "Registrar Procedure Guide",
    "document_type": "office_procedure",
    "category": "Office Procedures",
    "office": "Registrar",
    "version": "2026",
    "last_updated": "2026-04-30",
    "chunks": [
      {
        "chunk_id": "official_registrar_2026_001",
        "section_title": "Document Requests",
        "process_name": "Certificate Request",
        "content": "Searchable source passage here.",
        "answer": "Preferred answer here.",
        "citation": "Registrar Procedure Guide, Document Requests section",
        "page_number": 1,
        "tags": ["registrar", "documents"]
      }
    ]
  }
]`;

export default function AddDocumentScreen() {
  const [jsonText, setJsonText] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canImport = useMemo(() => validation?.ok === true && !loading, [loading, validation]);

  function handleValidate() {
    setImportResult(null);
    setError(null);
    setValidation(validateImportText(jsonText));
  }

  const handleFilePicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (file) {
        const content = await FileSystem.readAsStringAsync(file.uri);
        setJsonText(content);
        setImportResult(null);
        setError(null);
        setValidation(validateImportText(content));
      }
    } catch (err) {
      setError("Failed to read the selected file.");
    }
  };

  async function handleImport() {
    setLoading(true);
    setError(null);
    setImportResult(null);

    try {
      const result = await importDocumentsFromJson(jsonText);
      setImportResult(result);
      setValidation(validateImportText(jsonText));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <MascotHeader
          message="Paste or pick a file lang. I-check ko muna bago idagdag, para clean."
          subtitle="Import campus documents"
        />

        <AdminGate label="Document import is available in admin mode only.">
          <View style={styles.introCard}>
            <FileJson color={colors.maroon} size={22} />
            <View style={styles.introCopy}>
              <Text style={styles.introTitle}>Import source documents</Text>
              <Text style={styles.introText}>
                Paste JSON or select a file to add it to this device.
              </Text>
              <Pressable onPress={handleFilePicker} style={styles.pickerButton}>
                <FilePlus color={colors.maroon} size={16} />
                <Text style={styles.pickerButtonText}>Pick JSON file</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.editorBlock}>
            <Text style={styles.label}>Document JSON</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              onChangeText={(text) => {
                setJsonText(text);
                setValidation(null);
                setImportResult(null);
                setError(null);
              }}
              placeholder={placeholderJson}
              placeholderTextColor={colors.muted}
              style={styles.textArea}
              textAlignVertical="top"
              value={jsonText}
            />
          </View>

          <View style={styles.actions}>
            <Pressable onPress={handleValidate} style={[styles.actionButton, styles.secondaryButton]}>
              <CheckCircle2 color={colors.maroon} size={18} />
              <Text style={styles.secondaryButtonText}>Validate</Text>
            </Pressable>
            <Pressable disabled={!canImport} onPress={handleImport} style={[styles.actionButton, !canImport ? styles.disabledButton : undefined]}>
              {loading ? <ActivityIndicator color={colors.white} /> : <Upload color={colors.white} size={18} />}
              <Text style={styles.primaryButtonText}>Import JSON</Text>
            </Pressable>
          </View>

          {validation?.ok ? (
            <View style={styles.successCard}>
              <Text style={styles.cardTitle}>Valid JSON</Text>
              <Text style={styles.cardText}>
                {validation.preview.documentCount} document(s), {validation.preview.chunkCount} chunk(s) ready to import.
              </Text>
              {validation.preview.documents.map((document) => (
                <Text key={document.documentId} style={styles.previewItem}>
                  {document.documentTitle} ({document.chunkCount} topics)
                </Text>
              ))}
            </View>
          ) : null}

          {validation && !validation.ok ? (
            <View style={styles.errorCard}>
              <Text style={styles.cardTitle}>Validation errors</Text>
              {validation.issues.slice(0, 8).map((issue) => (
                <Text key={`${issue.path}-${issue.message}`} style={styles.errorText}>
                  {issue.path}: {issue.message}
                </Text>
              ))}
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.cardTitle}>Import failed</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {importResult ? (
            <View style={styles.successCard}>
              <Text style={styles.cardTitle}>Import complete</Text>
              <Text style={styles.cardText}>
                Inserted {importResult.insertedDocuments} document(s) and {importResult.insertedChunks} chunk(s). Skipped{" "}
                {importResult.skippedDocuments} duplicate document(s) and {importResult.skippedChunks} duplicate chunk(s).
              </Text>
              <Text style={styles.cardText}>The campus guide has been updated.</Text>
            </View>
          ) : null}
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
    paddingBottom: 28
  },
  introCard: {
    alignItems: "flex-start",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 18,
    padding: 16
  },
  introCopy: {
    flex: 1,
    gap: 4
  },
  introTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  introText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  pickerButton: {
    alignItems: "center",
    backgroundColor: colors.maroonSoft,
    borderRadius: 8,
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start"
  },
  pickerButtonText: {
    color: colors.maroon,
    fontSize: 13,
    fontWeight: "800"
  },
  editorBlock: {
    gap: 8,
    paddingHorizontal: 18
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  textArea: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: "monospace",
    fontSize: 12,
    minHeight: 260,
    padding: 14
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.maroon,
    borderRadius: 14,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 12
  },
  secondaryButton: {
    backgroundColor: colors.white,
    borderColor: colors.maroon,
    borderWidth: 1
  },
  disabledButton: {
    backgroundColor: colors.grayhawk
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "900"
  },
  secondaryButtonText: {
    color: colors.maroon,
    fontSize: 14,
    fontWeight: "900"
  },
  successCard: {
    backgroundColor: "#EFFCF4",
    borderColor: "#A6F4C5",
    borderRadius: 16,
    borderWidth: 1,
    gap: 7,
    marginHorizontal: 18,
    padding: 16
  },
  errorCard: {
    backgroundColor: "#FFF1F0",
    borderColor: "#FDA29B",
    borderRadius: 16,
    borderWidth: 1,
    gap: 7,
    marginHorizontal: 18,
    padding: 16
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  cardText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20
  },
  previewItem: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19
  }
});
