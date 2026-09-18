import { describe, it, expect } from "vitest";
import { policyBlocks } from "./policy-blocks";

describe("policyBlocks", () => {
  it("returns nothing for an empty policy", () => {
    expect(policyBlocks("")).toEqual([]);
    expect(policyBlocks(null)).toEqual([]);
  });

  it("splits paragraphs on blank lines and keeps single line breaks", () => {
    expect(policyBlocks("First line\nsecond line\n\nNew paragraph")).toEqual([
      { kind: "paragraph", text: "First line\nsecond line" },
      { kind: "paragraph", text: "New paragraph" },
    ]);
    expect(policyBlocks("a\r\n\r\nb")).toEqual([
      { kind: "paragraph", text: "a" },
      { kind: "paragraph", text: "b" },
    ]);
  });

  it("reads headings, bullets and numbered items", () => {
    expect(policyBlocks("# Timings\n- Doors open\n* Music stops\n• Clean up\n\nAfter the list")).toEqual([
      { kind: "heading", text: "Timings" },
      { kind: "bullets", items: ["Doors open", "Music stops", "Clean up"] },
      { kind: "paragraph", text: "After the list" },
    ]);
    expect(policyBlocks("3. Third\n4) Fourth")).toEqual([{ kind: "numbered", items: ["Third", "Fourth"], start: 3 }]);
  });

  it("keeps a list together across blank lines but splits it around a paragraph", () => {
    expect(policyBlocks("- one\n\n- two")).toEqual([{ kind: "bullets", items: ["one", "two"] }]);
    expect(policyBlocks("- one\ntext\n- two")).toEqual([
      { kind: "bullets", items: ["one"] },
      { kind: "paragraph", text: "text" },
      { kind: "bullets", items: ["two"] },
    ]);
  });

  it("does not mistake ordinary text for markup", () => {
    expect(policyBlocks("1.5 hours of setup are included")).toEqual([{ kind: "paragraph", text: "1.5 hours of setup are included" }]);
    expect(policyBlocks("#no-space")).toEqual([{ kind: "paragraph", text: "#no-space" }]);
    expect(policyBlocks("<b>bold</b>")).toEqual([{ kind: "paragraph", text: "<b>bold</b>" }]);
  });
});
