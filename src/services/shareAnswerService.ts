import type { BookmarkCitation } from "./bookmarkService";

export interface ShareAnswerInput {
  answerText: string;
  citations?: BookmarkCitation[] | undefined;
  question?: string | null | undefined;
}

/** Pure formatter (unit-testable): question, answer, sources, attribution. */
export function formatAnswerForSharing(input: ShareAnswerInput): string {
  const sections: string[] = [];
  if (input.question?.trim()) {
    sections.push(`Q: ${input.question.trim()}`);
  }
  sections.push(input.answerText.trim());
  const sourceLines = (input.citations ?? [])
    .map((citation) => (citation.citation ?? citation.documentTitle ?? citation.citationId).trim())
    .filter(Boolean);
  if (sourceLines.length) {
    sections.push(["Sources:", ...sourceLines.map((line) => `- ${line}`)].join("\n"));
  }
  sections.push("Shared from Haki, the TUP-Taguig student assistant. Verify final requirements with the office.");
  return sections.join("\n\n");
}

/** Open the system share sheet for a Haki answer. */
export async function shareAnswer(input: ShareAnswerInput): Promise<void> {
  // Lazy import keeps this module react-native-free for vitest, which only
  // exercises the pure formatter above.
  const { Share } = await import("react-native");
  await Share.share({ message: formatAnswerForSharing(input) });
}
