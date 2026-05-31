import { describe, expect, it } from "vitest";

import { parseAndValidateDocuments } from "./validation";

const validDocument = [
  {
    document_id: "official_test_doc",
    document_title: "Official Test Document",
    document_type: "office_procedure",
    category: "Student Services",
    office: "Student Affairs",
    version: "2026",
    last_updated: "2026-05-31",
    authored_by: "Official Test Office",
    source_url: "Signed test source package",
    chunks: [
      {
        chunk_id: "official_test_doc_001",
        section_title: "Test Section",
        content: "Students submit the official form to the listed office.",
        citation: "Official Test Document, Test Section"
      }
    ]
  }
];

describe("document import validation", () => {
  it("requires source provenance for production imports", () => {
    const missingProvenance = [{ ...validDocument[0], authored_by: undefined, source_url: undefined }];

    const result = parseAndValidateDocuments(JSON.stringify(missingProvenance));

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(["$[0].authored_by", "$[0].source_url"])
    );
  });

  it("accepts a bounded official document shape", () => {
    const result = parseAndValidateDocuments(JSON.stringify(validDocument));

    expect(result.ok).toBe(true);
    expect(result.ok ? result.preview.chunkCount : 0).toBe(1);
  });
});
