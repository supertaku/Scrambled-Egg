import { memo } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";

import { hasMarkdownFormatting, parseMarkdownBlocks, type InlineSegment } from "@/utils/simpleMarkdown";

interface ChatMarkdownTextProps {
  style?: StyleProp<TextStyle> | undefined;
  text: string;
}

function segmentStyle(segment: InlineSegment): TextStyle | undefined {
  if (segment.bold && segment.italic) {
    return styles.boldItalic;
  }
  if (segment.bold) {
    return styles.bold;
  }
  if (segment.italic) {
    return styles.italic;
  }
  return undefined;
}

/**
 * Renders Haki answers with lightweight formatting (bold, italics, bullets,
 * numbered lists). Plain answers skip block parsing and render as one Text.
 */
function ChatMarkdownTextComponent({ style, text }: ChatMarkdownTextProps) {
  if (!hasMarkdownFormatting(text)) {
    return (
      <Text selectable style={style}>
        {text}
      </Text>
    );
  }

  const blocks = parseMarkdownBlocks(text);
  return (
    <View style={styles.blocks}>
      {blocks.map((block, index) => (
        <View key={index} style={block.marker ? styles.listRow : undefined}>
          {block.marker ? <Text style={[style, styles.marker]}>{block.marker}</Text> : null}
          <Text selectable style={[style, block.marker ? styles.listText : undefined]}>
            {block.segments.map((segment, segmentIndex) => (
              <Text key={segmentIndex} style={segmentStyle(segment)}>
                {segment.text}
              </Text>
            ))}
          </Text>
        </View>
      ))}
    </View>
  );
}

export const ChatMarkdownText = memo(ChatMarkdownTextComponent);

const styles = StyleSheet.create({
  blocks: {
    gap: 5
  },
  listRow: {
    flexDirection: "row",
    gap: 6,
    paddingLeft: 2
  },
  marker: {
    fontWeight: "800"
  },
  listText: {
    // flexBasis "auto" (not the flexBasis:0 that `flex: 1` implies) lets the
    // text contribute its real content width to the row, so the shrink-wrapped
    // bubble expands to its maxWidth instead of collapsing to one word per line.
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "auto"
  },
  bold: {
    fontWeight: "800"
  },
  italic: {
    fontStyle: "italic"
  },
  boldItalic: {
    fontStyle: "italic",
    fontWeight: "800"
  }
});
