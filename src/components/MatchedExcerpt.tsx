import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";

interface MatchedExcerptProps {
  text: string | null;
  label?: string;
}

function normalizeExcerpt(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function MatchedExcerpt({ text, label = "Matched source excerpt" }: MatchedExcerptProps) {
  if (!text) {
    return null;
  }

  const normalized = normalizeExcerpt(text);
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(/(\[match\][\s\S]*?\[\/match\])/g).filter(Boolean);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.excerpt}>
        {parts.map((part, index) => {
          const isMatch = part.startsWith("[match]") && part.endsWith("[/match]");
          const content = isMatch ? part.replace("[match]", "").replace("[/match]", "") : part;
          return (
            <Text key={`${index}-${content}`} style={isMatch ? styles.match : undefined}>
              {content}
            </Text>
          );
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 10
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  excerpt: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19
  },
  match: {
    color: colors.maroon,
    fontWeight: "900"
  }
});
