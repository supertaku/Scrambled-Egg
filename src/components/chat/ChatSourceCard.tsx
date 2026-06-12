import { useState } from "react";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/themes";
import type { SearchResponse, SearchResult } from "@/types/search";
import { hapticTap } from "@/utils/haptics";

interface ChatSourceCardProps {
  response: SearchResponse;
  result?: SearchResult | undefined;
}

function uniqueSources(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const sources: SearchResult[] = [];
  for (const result of results) {
    const key = `${result.documentId}:${result.chunkId}`;
    if (!seen.has(key)) {
      seen.add(key);
      sources.push(result);
    }
  }
  return sources;
}

function formatSourcePreview(sources: SearchResult[]): string {
  const titles = sources.map((s) => s.documentTitle);
  if (titles.length === 0) return "No guide entry";
  const firstTitle = titles[0] ?? "Campus guide";
  const preview = firstTitle.length > 42 ? `${firstTitle.slice(0, 39).trim()}...` : firstTitle;
  return titles.length > 1 ? `${preview} +${titles.length - 1} more` : preview;
}

function formatLastUpdated(sources: SearchResult[]): string | null {
  const dates = sources
    .map((s) => s.lastUpdated)
    .filter((d): d is string => Boolean(d));
  return dates.length > 0 ? (dates.sort().at(-1) ?? null) : null;
}

function sourceDetail(source: SearchResult): string {
  return [
    source.processName || source.sectionTitle,
    source.office ? `Office: ${source.office}` : null,
    source.officeLocation ? `Location: ${source.officeLocation}` : null,
    source.pageNumber ? `Page ${source.pageNumber}` : null
  ]
    .filter(Boolean)
    .join(" · ");
}

function sourceCitation(source: SearchResult): string | null {
  return source.citation || source.answer || source.snippet || null;
}

/** Collapsible source citation card shown below a Haki response. */
export function ChatSourceCard({ response, result }: ChatSourceCardProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const citedIds = new Set(response.citationsUsed);
  const sources = uniqueSources([
    ...response.results,
    ...(response.topResult ? [response.topResult] : []),
    ...(result ? [result] : [])
  ]).filter((source) => citedIds.has(source.chunkId));
  const lastUpdated = formatLastUpdated(sources);

  if (sources.length === 0) return null;

  return (
    <View style={styles.sourcesWrap}>
      <Pressable
        accessibilityLabel={`${expanded ? "Hide" : "Show"} reference information for Haki's answer`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((c) => !c)}
        style={({ pressed }) => [styles.sourcesToggle, pressed ? styles.sourcesTogglePressed : undefined]}
      >
        <View style={styles.sourcesToggleRow}>
          <View style={styles.sourceDot} />
          <Text style={styles.sourcesToggleText} numberOfLines={1}>
            <Text style={styles.sourcesLabel}>Based on: </Text>
            {formatSourcePreview(sources)}
          </Text>
          <Text style={styles.expandHint}>{expanded ? "▲" : "▼"}</Text>
        </View>
        {lastUpdated ? <Text style={styles.lastUpdatedText}>Updated {lastUpdated}</Text> : null}
      </Pressable>

      {expanded ? (
        <View style={styles.sourcesList}>
          {sources.map((source) => (
            <Pressable
              accessibilityHint="Opens the full procedure in the Service Desk."
              accessibilityLabel={`Open ${source.documentTitle} in the Service Desk`}
              accessibilityRole="button"
              key={`${source.documentId}:${source.chunkId}`}
              onPress={() => {
                hapticTap();
                router.push({
                  pathname: "/library-topic/[chunkId]" as never,
                  params: { chunkId: source.chunkId }
                });
              }}
              style={({ pressed }) => [styles.sourceTitleRow, pressed ? styles.sourceRowPressed : undefined]}
            >
              <View style={styles.sourceAccentBar} />
              <View style={styles.sourceContent}>
                <Text selectable style={styles.sourceTitleText}>{source.documentTitle}</Text>
                {sourceDetail(source) ? <Text selectable style={styles.sourceMetaText}>{sourceDetail(source)}</Text> : null}
                {sourceCitation(source) ? <Text selectable style={styles.sourceCitationText}>{sourceCitation(source)}</Text> : null}
                <Text style={styles.sourceOpenHint}>View full details</Text>
              </View>
              <ChevronRight color={colors.maroon} size={16} style={styles.sourceChevron} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  sourcesWrap: {
    gap: 6,
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
  sourcesTogglePressed: {
    backgroundColor: colors.border
  },
  sourcesToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  sourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.maroon,
    flexShrink: 0
  },
  sourcesToggleText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    flex: 1
  },
  expandHint: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800"
  },
  sourcesLabel: {
    color: colors.maroon,
    fontWeight: "900"
  },
  lastUpdatedText: {
    color: colors.mutedLight,
    fontSize: 11,
    fontWeight: "600",
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
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 0,
    overflow: "hidden"
  },
  sourceRowPressed: {
    backgroundColor: colors.border
  },
  sourceOpenHint: {
    color: colors.maroon,
    fontSize: 10,
    fontWeight: "900",
    marginTop: 2
  },
  sourceChevron: {
    marginRight: 8
  },
  sourceAccentBar: {
    width: 3,
    backgroundColor: colors.maroon,
    borderRadius: 0,
    flexShrink: 0
  },
  sourceContent: {
    flex: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  sourceTitleText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  sourceMetaText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
    marginTop: 1
  },
  sourceCitationText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 16,
    marginTop: 4,
    fontStyle: "italic"
  },
});
