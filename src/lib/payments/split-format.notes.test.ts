import { describe, expect, it } from "vitest";
import { splitIdFromPaymentNotes, splitPaymentNote } from "./split-format";

describe("split payment notes", () => {
  it("round-trips the split id through the pending payment note", () => {
    const note = splitPaymentNote("Asha Rao", "cm1split42");
    expect(note).toBe("Split payment by Asha Rao [split:cm1split42]");
    expect(splitIdFromPaymentNotes(note)).toBe("cm1split42");
  });

  it("finds no split in ordinary or older notes", () => {
    expect(splitIdFromPaymentNotes("Split payment by Asha Rao")).toBeNull();
    expect(splitIdFromPaymentNotes("Customer-submitted payment proof")).toBeNull();
    expect(splitIdFromPaymentNotes(null)).toBeNull();
    expect(splitIdFromPaymentNotes(undefined)).toBeNull();
  });
});
