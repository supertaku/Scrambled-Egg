import type { SafeChatInput, SourceChunkForSummary } from "./LocalAIProvider";
import type { LocalModelManifest } from "./localModelMetadata";
import { DISABLE_MODEL_THINKING_INSTRUCTION, NO_RELIABLE_ANSWER } from "./prompts";

/**
 * Prompt-assembly helpers shared by every local chat provider (llama.rn,
 * LiteRT-LM). Keep these provider-agnostic: anything specific to one
 * runtime's sampling or stop-token behavior belongs next to that provider.
 */

export function sourceBlock(sources: SourceChunkForSummary[] | undefined): string {
  if (!sources?.length) return "";

  return [
    "Saved university sources:",
    ...sources.map((source) => {
      const body = source.answer?.trim() || source.content.trim();
      return `[${source.citationId}] ${source.documentTitle}${source.sectionTitle ? ` - ${source.sectionTitle}` : ""}: ${body}`;
    })
  ].join("\n");
}

export function conversationMessages(input: SafeChatInput) {
  return (input.conversationContext ?? []).map((turn) => ({
    role: turn.sender === "user" ? "user" as const : "assistant" as const,
    content: turn.text
  }));
}

export function citationIdsFromText(text: string, sources: SourceChunkForSummary[] | undefined): string[] {
  if (!sources?.length) return [];
  return sources
    .map((source) => source.citationId)
    .filter((citationId) => text.includes(citationId) || text.includes(`[${citationId}]`));
}

export function isNoReliableAnswer(text: string): boolean {
  return text.trim().toUpperCase().includes(NO_RELIABLE_ANSWER);
}

export function thinkingDisabledForManifest(manifest: LocalModelManifest): boolean {
  return manifest.generationPolicy?.thinkingMode === "disabled" ||
    /qwen\s*3|qwen3/i.test(`${manifest.modelName} ${manifest.originalName}`);
}

export function instructionForManifest(instruction: string, manifest: LocalModelManifest): string {
  return thinkingDisabledForManifest(manifest)
    ? `${instruction}\n\n${DISABLE_MODEL_THINKING_INSTRUCTION}`
    : instruction;
}
