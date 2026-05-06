import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import type { SearchResponse, SearchResult } from "@/types/search";

interface ChatSourceCardProps {
  response: SearchResponse;
  result?: SearchResult | undefined;
}

function uniqueSources(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const sources: SearchResult[] = [];
  for (const result of results) {
    if (!seen.has(result.documentId)) {
      seen.add(result.documentId);
      sources.push(result);
    }
  }
  return sources;
}

function formatSourcePreview(sources: SearchResult[]): string {
  const titles = sources.map((s) => s.documentTitle);
  if (titles.length === 0) return "No saved source";
  const firstTitle = titles[0] ?? "Saved source";
  const preview = firstTitle.length > 42 ? `${firstTitle.slice(0, 39).trim()}...` : firstTitle;
  return titles.length > 1 ? `${preview} +${titles.length - 1} more` : preview;
}

function formatLastUpdated(sources: SearchResult[]): string | null {
  const dates = sources
    .map((s) => s.lastUpdated)
    .filter((d): d is string => Boolean(d));
  return dates.length > 0 ? (dates.sort().at(-1) ?? null) : null;
}

/** Collapsible source citation card shown below a Haki response. */
export function ChatSourceCard({ response, result }: ChatSourceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const sources = uniqueSources(response.results.length ? response.results : result ? [result] : []);
  const lastUpdated = formatLastUpdated(sources);

  if (sources.length === 0) return null;

  return (
    <View style={styles.sourcesWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((c) => !c)}
        style={styles.sourcesToggle}
      >
        <Text style={styles.sourcesToggleText}>
          <Text style={styles.sourcesLabel}>Sources: </Text>
          {formatSourcePreview(sources)}
        </Text>
        {lastUpdated ? <Text style={styles.lastUpdatedText}>Updated {lastUpdated}</Text> : null}
      </Pressable>

      {expanded ? (
        <View style={styles.sourcesList}>
          {sources.map((source) => (
            <View key={source.documentId} style={styles.sourceTitleRow}>
              <Text style={styles.sourceTitleText}>{source.documentTitle}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sourcesWrap: {
    gap: 8,
    marginTop: 10
  },
  sourcesToggle: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  sourcesToggleText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  sourcesLabel: {
    color: colors.maroon,
    fontWeight: "900"
  },
  lastUpdatedText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  sourcesList: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden"
  },
  sourceTitleRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  sourceTitleText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  }
});
