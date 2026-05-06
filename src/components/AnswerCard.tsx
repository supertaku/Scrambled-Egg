import { useState } from "react";
import { ChevronDown, ChevronUp, CircleCheck } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import type { SearchResult } from "@/types/search";
import type { AnswerProvenance } from "@/ai/DeviceAIMode";

import { ConfidenceBadge } from "./ConfidenceBadge";
import { MatchedExcerpt } from "./MatchedExcerpt";

interface AnswerCardProps {
  result: SearchResult;
  answerText?: string;
  provenance?: AnswerProvenance;
  verificationNote?: string;
}

function Field({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === "") {
    return null;
  }

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export function AnswerCard({ result, answerText, provenance, verificationNote }: AnswerCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const body = answerText?.trim() || result.answer?.trim() || result.content;
  const excerpt = result.snippet ?? result.contentHighlight;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>Source-backed sagot</Text>
        <ConfidenceBadge confidence={result.confidence} />
      </View>
      <Text style={styles.replyLead}>Gotchu, TUPian. Based sa saved info, ito ang sagot:</Text>
      <Text style={styles.answer}>{body}</Text>
      {verificationNote ? <Text style={styles.verifyNote}>{verificationNote}</Text> : null}
      {provenance ? <Text style={styles.provenance}>{provenance}</Text> : null}
      <MatchedExcerpt text={excerpt} />

      {result.steps && result.steps.length > 0 && (
        <View style={styles.stepsContainer}>
          <Text style={styles.stepsTitle}>Steps na sundan</Text>
          {result.steps.map((step, index) => (
            <View key={index} style={styles.stepItem}>
              <View style={styles.stepBullet}>
                <CircleCheck color={colors.success} size={16} />
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      )}

      {result.officeLocation || result.contactInfo ? (
        <View style={styles.infoRow}>
          {result.officeLocation && (
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>{result.officeLocation}</Text>
            </View>
          )}
          {result.contactInfo && (
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Contact</Text>
              <Text style={styles.infoValue}>{result.contactInfo}</Text>
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.divider} />

      <Pressable onPress={() => setShowDetails(!showDetails)} style={styles.detailToggle}>
        <Text style={styles.detailToggleText}>{showDetails ? "Hide receipts" : "Show receipts"}</Text>
        {showDetails ? <ChevronUp color={colors.maroon} size={16} /> : <ChevronDown color={colors.maroon} size={16} />}
      </Pressable>

      {showDetails && (
        <View style={styles.detailsContent}>
          <Field label="Source" value={result.citation ?? result.documentTitle} />
          <Field label="Document" value={result.documentTitle} />
          <Field label="Section" value={result.sectionTitle} />
          <Field label="Office" value={result.office} />
          <Field label="Category" value={result.category} />
          <Field label="Page" value={result.pageNumber} />
          <Field label="Last updated" value={result.lastUpdated} />
          {result.confidenceScore !== undefined && (
            <Field label="Relevance score" value={(result.confidenceScore * 100).toFixed(0) + "%"} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 16,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  eyebrow: {
    color: colors.maroon,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  answer: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24
  },
  replyLead: {
    color: colors.maroon,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  verifyNote: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  provenance: {
    color: colors.grayhawkDark,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  stepsContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
    padding: 12
  },
  stepsTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4
  },
  stepItem: {
    flexDirection: "row",
    gap: 10
  },
  stepBullet: {
    paddingTop: 2
  },
  stepText: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    lineHeight: 20
  },
  infoRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 4
  },
  infoBlock: {
    flex: 1,
    gap: 2
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  infoValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700"
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
    marginTop: 4
  },
  detailToggle: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 4
  },
  detailToggleText: {
    color: colors.maroon,
    fontSize: 13,
    fontWeight: "800"
  },
  detailsContent: {
    gap: 10,
    marginTop: 4
  },
  field: {
    gap: 2
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  fieldValue: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20
  }
});
