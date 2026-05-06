import seedDocuments from "@/data/seed-documents.json";
import type { StructuredDocument } from "@/types/document";

export interface TriviaItem {
  title: string;
  body: string;
  source: string;
}

function cleanDemoPrefix(text: string): string {
  return text.replace(/^\[DEMO\]\s*/i, "").trim();
}

function buildTriviaFromSeedDocuments(documents: StructuredDocument[]): TriviaItem[] {
  return documents.flatMap((document) =>
    document.chunks.slice(0, 2).map((chunk) => {
      const title = chunk.process_name ?? chunk.section_title ?? cleanDemoPrefix(document.document_title);
      const body = chunk.answer?.trim() || chunk.content.replace(/^Demo placeholder content\.\s*/i, "").trim();
      const source = `${cleanDemoPrefix(document.document_title)}${chunk.section_title ? `, ${chunk.section_title}` : ""}`;

      return {
        title,
        body,
        source
      };
    })
  );
}

export function getSeedTriviaItems(): TriviaItem[] {
  return buildTriviaFromSeedDocuments(seedDocuments as StructuredDocument[]);
}
