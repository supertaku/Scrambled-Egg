export function sanitizeAssistantText(value: string): string {
  let text = value.trim();
  const promptEchoScanLimit = 200;
  const promptEchoHead = text.slice(0, promptEchoScanLimit);
  const promptEchoPattern =
    /(?:^|\n)\s*(?:<\|im_start\|>(?:system|user|assistant)|System:|App context:|User:|Assistant:)/i;

  if (promptEchoPattern.test(promptEchoHead)) {
    const assistantMatch = [
      ...text.matchAll(/(?:<\|im_start\|>assistant\s*|(?:^|\n)\s*Assistant:\s*)/gi)
    ].at(-1);
    if (assistantMatch?.index !== undefined) {
      text = text.slice(assistantMatch.index + assistantMatch[0].length).trim();
    }
  }

  return text
    .replace(/^<\|im_start\|>assistant\s*/i, "")
    .replace(/^Assistant:\s*/i, "")
    .replace(/<\|im_end\|>\s*$/i, "")
    .trim();
}

export function sanitizeAssistantDisplayText(value: string): string {
  return sanitizeAssistantText(value)
    .replace(/(?:^|\n)\s*(?:CITATIONS?|SOURCE_IDS?|SOURCES?)\s*:[\s\S]*$/i, "")
    .trim();
}
