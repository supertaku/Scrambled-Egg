import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import type { SearchResult } from "@/types/search";

import { ConfidenceBadge } from "./ConfidenceBadge";
import { MatchedExcerpt } from "./MatchedExcerpt";

interface SourceCardProps {
  result: SearchResult;
}

function Meta({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === "") {
    return null;
  }

  return (
    <Text style={styles.metaText}>
      <Text style={styles.metaLabel}>{label}: </Text>
      {value}
    </Text>
  );
}

export function SourceCard({ result }: SourceCardProps) {
  const excerpt = result.snippet ?? result.contentHighlight;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{result.sectionTitle ?? result.processName ?? result.documentTitle}</Text>
        <ConfidenceBadge confidence={result.confidence} />
      </View>
      <Text style={styles.replyLead}>Extra note from saved documents:</Text>
      <Text style={styles.content}>{result.answer?.trim() || result.content}</Text>
      <MatchedExcerpt text={excerpt} />
      <View style={styles.meta}>
        <Meta label="Source" value={result.citation ?? result.documentTitle} />
        <Meta label="Document" value={result.documentTitle} />
        <Meta label="Office" value={result.office} />
        <Meta label="Category" value={result.category} />
        <Meta label="Page" value={result.pageNumber} />
        <Meta label="Last updated" value={result.lastUpdated} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 9,
    padding: 14
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  title: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21
  },
  content: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21
  },
  replyLead: {
    color: colors.maroon,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  meta: {
    gap: 4
  },
  metaText: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 17
  },
  metaLabel: {
    color: colors.muted,
    fontWeight: "800"
  }
});
