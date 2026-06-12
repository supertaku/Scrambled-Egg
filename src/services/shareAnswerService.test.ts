import { describe, expect, it } from "vitest";

import { formatAnswerForSharing } from "./shareAnswerService";

describe("formatAnswerForSharing", () => {
  it("includes question, answer, sources, and attribution", () => {
    const text = formatAnswerForSharing({
      answerText: "Bring your admission slip to the clinic.",
      citations: [
        { citationId: "clinic_001", citation: "TUP-Taguig Clinic Procedures, Pre-enrollment section" },
        { citationId: "clinic_002", documentTitle: "TUP-Taguig Clinic Procedures" }
      ],
      question: "What do I bring to the clinic?"
    });

    expect(text).toContain("Q: What do I bring to the clinic?");
    expect(text).toContain("Bring your admission slip to the clinic.");
    expect(text).toContain("Sources:");
    expect(text).toContain("- TUP-Taguig Clinic Procedures, Pre-enrollment section");
    expect(text).toContain("- TUP-Taguig Clinic Procedures");
    expect(text).toContain("Shared from Haki");
    expect(text).toContain("Verify final requirements with the office.");
  });

  it("omits the question and sources blocks when absent", () => {
    const text = formatAnswerForSharing({ answerText: "General study tip." });
    expect(text).not.toContain("Q:");
    expect(text).not.toContain("Sources:");
    expect(text.startsWith("General study tip.")).toBe(true);
  });

  it("falls back to the citation id when no display text exists", () => {
    const text = formatAnswerForSharing({
      answerText: "Answer.",
      citations: [{ citationId: "osa_003" }]
    });
    expect(text).toContain("- osa_003");
  });
});
