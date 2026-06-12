import { describe, expect, it, vi } from "vitest";

import { FTSRetriever } from "./FTSRetriever";

const OFFICES = [
  { office: "Office of the Student Affairs" },
  { office: "TUP-Taguig Clinic" },
  { office: "TUP-Taguig Dental Clinic" },
  { office: "Guidance and Counselling Office" },
  { office: "Security / Admin" }
];

const SEARCH_ROW = {
  id: 1,
  chunk_id: "clinic_001",
  document_id: "clinic",
  document_title: "Clinic procedures",
  document_type: "guide",
  section_title: "Consultation",
  process_name: null,
  content: "Visit the clinic for consultation.",
  answer: "Visit the clinic.",
  citation: "Clinic procedures",
  page_number: 1,
  category: "Student Welfare",
  office: "TUP-Taguig Clinic",
  tags: "clinic consultation",
  synonyms: null,
  steps: null,
  prerequisites: null,
  office_location: null,
  contact_info: null,
  priority: 1,
  last_updated: "2026-06-01",
  snippet: "Visit the [match]clinic[/match].",
  content_highlight: null,
  score: -1
};

function createRetriever() {
  const ftsParams: unknown[][] = [];
  const getAllAsync = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes("SELECT DISTINCT office")) return OFFICES;
    if (sql.includes("FROM chunks_fts")) {
      ftsParams.push(params);
      return [SEARCH_ROW];
    }
    return [];
  });
  return {
    ftsParams,
    retriever: new FTSRetriever({ getAllAsync } as never)
  };
}

describe("FTSRetriever office scope aliases", () => {
  it("derives matching office names from the current corpus", async () => {
    const { ftsParams, retriever } = createRetriever();

    await retriever.search("dental consultation", { scope: { office: "Dental Clinic" } });

    expect(ftsParams[0]).toContain("Dental Clinic");
    expect(ftsParams[0]).toContain("TUP-Taguig Dental Clinic");
  });

  it("keeps the seeded short Clinic scope working", async () => {
    const { ftsParams, retriever } = createRetriever();

    await retriever.search("medical consultation", { scope: { office: "Clinic" } });

    expect(ftsParams[0]).toContain("Clinic");
    expect(ftsParams[0]).toContain("TUP-Taguig Clinic");
  });

  it("does not expand a generic office scope to every office", async () => {
    const { ftsParams, retriever } = createRetriever();

    await retriever.search("student help", { scope: { office: "Office" } });

    expect(ftsParams[0]).toContain("Office");
    expect(ftsParams[0]).not.toContain("Office of the Student Affairs");
    expect(ftsParams[0]).not.toContain("Guidance and Counselling Office");
  });
});
