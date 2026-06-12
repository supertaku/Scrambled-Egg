/**
 * Minimal markdown for chat bubbles: **bold**, *italic* / _italic_, dash or
 * star bullets, and numbered lists. Pure functions, no React imports, so the
 * parser is unit-testable. Anything unrecognized renders as plain text —
 * never throw on model output.
 */

export interface InlineSegment {
  bold: boolean;
  italic: boolean;
  text: string;
}

export interface MarkdownBlock {
  /** Bullet/numbered marker rendered before the content ("•", "1."). */
  marker: string | null;
  segments: InlineSegment[];
  type: "bullet" | "numbered" | "paragraph";
}

const INLINE_PATTERN = /(\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g;

export function parseInlineSegments(line: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let lastIndex = 0;

  for (const match of line.matchAll(INLINE_PATTERN)) {
    const raw = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ bold: false, italic: false, text: line.slice(lastIndex, index) });
    }
    if (raw.startsWith("***")) {
      segments.push({ bold: true, italic: true, text: raw.slice(3, -3) });
    } else if (raw.startsWith("**")) {
      segments.push({ bold: true, italic: false, text: raw.slice(2, -2) });
    } else {
      segments.push({ bold: false, italic: true, text: raw.slice(1, -1) });
    }
    lastIndex = index + raw.length;
  }

  if (lastIndex < line.length) {
    segments.push({ bold: false, italic: false, text: line.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ bold: false, italic: false, text: line }];
}

const BULLET_PATTERN = /^\s*[-*•]\s+(.*)$/;
const NUMBERED_PATTERN = /^\s*(\d{1,3})[.)]\s+(.*)$/;

export function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      continue;
    }

    const bullet = BULLET_PATTERN.exec(line);
    if (bullet?.[1] !== undefined) {
      blocks.push({ marker: "•", segments: parseInlineSegments(bullet[1]), type: "bullet" });
      continue;
    }

    const numbered = NUMBERED_PATTERN.exec(line);
    if (numbered?.[1] !== undefined && numbered[2] !== undefined) {
      blocks.push({ marker: `${numbered[1]}.`, segments: parseInlineSegments(numbered[2]), type: "numbered" });
      continue;
    }

    blocks.push({ marker: null, segments: parseInlineSegments(line), type: "paragraph" });
  }

  return blocks;
}

// Non-global copy: a /g regex used with .test() is stateful via lastIndex.
const INLINE_TEST_PATTERN = new RegExp(INLINE_PATTERN.source);

/** True when the text contains formatting worth the block renderer. */
export function hasMarkdownFormatting(text: string): boolean {
  return (
    INLINE_TEST_PATTERN.test(text) ||
    text.split("\n").some((line) => BULLET_PATTERN.test(line) || NUMBERED_PATTERN.test(line))
  );
}
