import assert from "node:assert/strict";

import seedDocuments from "../src/data/seed-documents.json";
import type { StructuredDocument } from "../src/types/document";

const MAX_CHUNK_TOKENS = 400;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MOJIBAKE_PATTERN = /â|Â|Ã|�/;

function estimateTokens(text: string): number {
  return Math.ceil(text.trim().length / 4);
}

function assertNoMojibake(path: string, value: unknown): void {
  if (typeof value === "string") {
    assert.equal(MOJIBAKE_PATTERN.test(value), false, `${path} contains mojibake-like characters.`);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoMojibake(`${path}[${index}]`, entry));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      assertNoMojibake(`${path}.${key}`, entry);
    }
  }
}

const documents = seedDocuments as StructuredDocument[];
const chunkIds = new Set<string>();
let chunkCount = 0;

assert.ok(documents.length > 0, "Seed data must include at least one document.");
assertNoMojibake("seedDocuments", documents);

for (const document of documents) {
  assert.ok(document.document_id?.trim(), "Every document needs document_id.");
  assert.ok(document.document_title?.trim(), `${document.document_id} needs document_title.`);
  assert.ok(document.last_updated?.trim(), `${document.document_id} needs last_updated.`);
  assert.ok(ISO_DATE_PATTERN.test(document.last_updated), `${document.document_id} needs ISO last_updated.`);
  assert.ok(document.authored_by?.trim(), `${document.document_id} needs authored_by.`);
  assert.ok(document.source_url?.trim(), `${document.document_id} needs source_url or source evidence label.`);
  assert.notEqual(document.document_type, "placeholder", `${document.document_id} must not be a placeholder document.`);
  assert.ok(Array.isArray(document.chunks) && document.chunks.length > 0, `${document.document_id} needs chunks.`);

  for (const chunk of document.chunks) {
    chunkCount += 1;
    const path = `${document.document_id}.${chunk.chunk_id}`;
    assert.ok(chunk.chunk_id?.trim(), `${document.document_id} has a chunk without chunk_id.`);
    assert.equal(chunkIds.has(chunk.chunk_id), false, `Duplicate chunk_id: ${chunk.chunk_id}`);
    chunkIds.add(chunk.chunk_id);
    assert.ok(chunk.content?.trim(), `${path} needs content.`);
    assert.ok(chunk.citation?.trim(), `${path} needs citation.`);
    assert.equal(/\b(to be confirmed|placeholder|provisional draft)\b/i.test(chunk.content), false, `${path} contains provisional wording.`);
    assert.ok(estimateTokens(chunk.content) <= MAX_CHUNK_TOKENS, `${path} exceeds ${MAX_CHUNK_TOKENS} estimated tokens.`);
  }
}

console.log(`Seed data QA passed: ${documents.length} documents, ${chunkCount} chunks.`);
