import { describe, expect, it } from "vitest";

import { hasMarkdownFormatting, parseInlineSegments, parseMarkdownBlocks } from "./simpleMarkdown";

describe("parseInlineSegments", () => {
  it("returns plain text untouched", () => {
    expect(parseInlineSegments("hello world")).toEqual([
      { bold: false, italic: false, text: "hello world" }
    ]);
  });

  it("parses bold and italic spans", () => {
    expect(parseInlineSegments("go to the **Registrar** for the *original* copy")).toEqual([
      { bold: false, italic: false, text: "go to the " },
      { bold: true, italic: false, text: "Registrar" },
      { bold: false, italic: false, text: " for the " },
      { bold: false, italic: true, text: "original" },
      { bold: false, italic: false, text: " copy" }
    ]);
  });

  it("parses underscore italics and triple-star bold italic", () => {
    expect(parseInlineSegments("_soon_ and ***now***")).toEqual([
      { bold: false, italic: true, text: "soon" },
      { bold: false, italic: false, text: " and " },
      { bold: true, italic: true, text: "now" }
    ]);
  });

  it("leaves unbalanced markers as plain text", () => {
    expect(parseInlineSegments("2 * 3 = 6")).toEqual([
      { bold: false, italic: false, text: "2 * 3 = 6" }
    ]);
  });
});

describe("parseMarkdownBlocks", () => {
  it("classifies bullets, numbered items, and paragraphs", () => {
    const blocks = parseMarkdownBlocks("Steps:\n- bring your ID\n* pay the fee\n1. claim the slip\n2) wait");
    expect(blocks.map((block) => block.type)).toEqual([
      "paragraph",
      "bullet",
      "bullet",
      "numbered",
      "numbered"
    ]);
    expect(blocks[3]?.marker).toBe("1.");
    expect(blocks[4]?.marker).toBe("2.");
  });

  it("skips blank lines", () => {
    expect(parseMarkdownBlocks("a\n\n\nb")).toHaveLength(2);
  });
});

describe("hasMarkdownFormatting", () => {
  it("detects formatting and stays false for plain prose", () => {
    expect(hasMarkdownFormatting("just a sentence.")).toBe(false);
    expect(hasMarkdownFormatting("a **key** point")).toBe(true);
    expect(hasMarkdownFormatting("- a list item")).toBe(true);
  });

  it("is not stateful across calls", () => {
    expect(hasMarkdownFormatting("a **key** point")).toBe(true);
    expect(hasMarkdownFormatting("a **key** point")).toBe(true);
  });
});
