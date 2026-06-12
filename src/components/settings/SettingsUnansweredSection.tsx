import { SearchX } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import type { UnansweredQuestionEntry } from "@/services/historyService";
import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/themes";

export function SettingsUnansweredSection({
  entries,
  error,
  loading
}: {
  entries: UnansweredQuestionEntry[];
  error: string | null;
  loading: boolean;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.card}>
      <SearchX color={colors.maroon} size={24} />
      <Text style={styles.cardTitle}>Questions without saved answers</Text>
      <Text style={styles.cardSubtitle}>
        Recent questions on this phone that Haki could not answer from saved campus sources. Use this list to
        prioritize which official documents to add next.
      </Text>
      {loading ? (
        <ActivityIndicator color={colors.maroon} />
      ) : error ? (
        <Text selectable style={styles.errorText}>{error}</Text>
      ) : entries.length === 0 ? (
        <Text selectable style={styles.cardText}>No unanswered questions recorded recently.</Text>
      ) : (
        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.questionCell, styles.headerCell]}>Question</Text>
            <Text style={[styles.countCell, styles.headerCell]}>Times</Text>
          </View>
          {entries.map((entry) => (
            <View key={entry.question.toLowerCase()} style={styles.row}>
              <Text selectable numberOfLines={3} style={styles.questionCell}>{entry.question}</Text>
              <Text selectable style={styles.countCell}>{entry.occurrences}</Text>
            </View>
          ))}
        </View>
      )}
      <Text selectable style={styles.footer}>
        Counts cover recent encrypted chat activity stored on this phone and reset when chat memory is cleared.
      </Text>
    </View>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
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
  cardSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  cardText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21
  },
  table: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden"
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  headerRow: {
    backgroundColor: colors.surface,
    borderTopWidth: 0
  },
  headerCell: {
    color: colors.maroon,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  questionCell: {
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16
  },
  countCell: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
    width: 44
  },
  footer: {
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
