import { z } from "zod";

import type { ImportPreview, StructuredDocument, ValidationIssue, ValidationResult } from "@/types/document";

const optionalTrimmedString = z.string().trim().optional();

const stringArraySchema = z
  .array(z.string().trim())
  .transform((items) => items.filter((item) => item.length > 0))
  .optional();

export const documentChunkSchema = z.object({
  chunk_id: z.string().trim().min(1, "chunk_id is required."),
  section_title: optionalTrimmedString,
  process_name: optionalTrimmedString,
  content: z.string().trim().min(1, "content is required."),
  answer: optionalTrimmedString,
  citation: optionalTrimmedString,
  page_number: z.number().finite().int().positive().optional(),
  tags: stringArraySchema,
  synonyms: stringArraySchema,
  steps: stringArraySchema,
  prerequisites: stringArraySchema,
  office_location: optionalTrimmedString,
  contact_info: optionalTrimmedString,
  priority: z.number().finite().int().min(0).max(10).optional()
});

export const structuredDocumentSchema = z.object({
  document_id: z.string().trim().min(1, "document_id is required."),
  document_title: z.string().trim().min(1, "document_title is required."),
  document_type: optionalTrimmedString,
  category: optionalTrimmedString,
  office: optionalTrimmedString,
  version: optionalTrimmedString,
  last_updated: optionalTrimmedString,
  authored_by: optionalTrimmedString,
  source_url: optionalTrimmedString,
  chunks: z.array(documentChunkSchema).min(1, "chunks must be a non-empty array.")
});

export const structuredDocumentsSchema = z.array(structuredDocumentSchema);

function issuePath(path: readonly PropertyKey[]): string {
  if (path.length === 0) {
    return "$";
  }

  let formattedPath = "$";
  for (const part of path) {
    if (typeof part === "number") {
      formattedPath += `[${part}]`;
    } else {
      formattedPath += `.${String(part)}`;
    }
  }

  return formattedPath;
}

function buildPreview(documents: StructuredDocument[]): ImportPreview {
  return {
    documentCount: documents.length,
    chunkCount: documents.reduce((total, document) => total + document.chunks.length, 0),
    documents: documents.map((document) => ({
      documentId: document.document_id,
      documentTitle: document.document_title,
      chunkCount: document.chunks.length
    }))
  };
}

function validateUniqueIds(documents: StructuredDocument[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const documentIds = new Set<string>();
  const chunkIds = new Set<string>();

  documents.forEach((document, documentIndex) => {
    if (documentIds.has(document.document_id)) {
      issues.push({
        path: `$[${documentIndex}].document_id`,
        message: `Duplicate document_id "${document.document_id}" in imported JSON.`
      });
    }
    documentIds.add(document.document_id);

    document.chunks.forEach((chunk, chunkIndex) => {
      if (chunkIds.has(chunk.chunk_id)) {
        issues.push({
          path: `$[${documentIndex}].chunks[${chunkIndex}].chunk_id`,
          message: `Duplicate chunk_id "${chunk.chunk_id}" in imported JSON.`
        });
      }
      chunkIds.add(chunk.chunk_id);
    });
  });

  return issues;
}

export function validateStructuredDocuments(input: unknown): ValidationResult {
  const parsed = structuredDocumentsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issuePath(issue.path),
        message: issue.message
      }))
    };
  }

  const documents: StructuredDocument[] = parsed.data;
  const duplicateIssues = validateUniqueIds(documents);
  if (duplicateIssues.length > 0) {
    return { ok: false, issues: duplicateIssues };
  }

  return {
    ok: true,
    documents,
    preview: buildPreview(documents)
  };
}

export function parseAndValidateDocuments(jsonText: string): ValidationResult {
  if (jsonText.trim().length === 0) {
    return { ok: false, issues: [{ path: "$", message: "Paste a JSON array before validating." }] };
  }

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    return validateStructuredDocuments(parsed);
  } catch (error) {
    return {
      ok: false,
      issues: [
        {
          path: "$",
          message: error instanceof Error ? error.message : "Invalid JSON."
        }
      ]
    };
  }
}
