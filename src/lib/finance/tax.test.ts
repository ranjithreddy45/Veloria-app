import { describe, it, expect } from "vitest";
import { splitGst, computeTds, stateCodeOf, HOME_STATE_CODE } from "./tax";

describe("stateCodeOf", () => {
  it("reads a bare state code", () => expect(stateCodeOf("36")).toBe("36"));
  it("reads the leading digits of a GSTIN", () => expect(stateCodeOf("36ABCDE1234F1Z5")).toBe("36"));
  it("returns null for empty / non-numeric", () => {
    expect(stateCodeOf(null)).toBeNull();
    expect(stateCodeOf("Telangana")).toBeNull();
  });
});

describe("splitGst — place of supply", () => {
  it("splits intra-state into equal CGST + SGST", () => {
    const r = splitGst({ taxable: 100000, ratePct: 18, placeOfSupply: HOME_STATE_CODE });
    expect(r.interState).toBe(false);
    expect(r.cgst).toBe(9000);
    expect(r.sgst).toBe(9000);
    expect(r.igst).toBe(0);
    expect(r.total).toBe(18000);
  });
  it("charges IGST inter-state", () => {
    const r = splitGst({ taxable: 100000, ratePct: 18, placeOfSupply: "07" }); // Delhi
    expect(r.interState).toBe(true);
    expect(r.igst).toBe(18000);
    expect(r.cgst).toBe(0);
    expect(r.sgst).toBe(0);
    expect(r.total).toBe(18000);
  });
  it("never loses a paisa on an odd half-split", () => {
    // 18% of 100.05 = 18.009 → 1800.9 paise → rounds to 1801 paise total.
    const r = splitGst({ taxable: 100.05, ratePct: 18, placeOfSupply: "36" });
    const totalPaise = Math.round(r.total * 100);
    const cgstPaise = Math.round(r.cgst * 100);
    const sgstPaise = Math.round(r.sgst * 100);
    expect(cgstPaise + sgstPaise).toBe(totalPaise);
  });
  it("treats an unknown place of supply as intra-state (conservative)", () => {
    const r = splitGst({ taxable: 1000, ratePct: 18, placeOfSupply: null });
    expect(r.interState).toBe(false);
  });
});

describe("computeTds — sections + thresholds", () => {
  it("deducts 194J professional fees at 10%", () => {
    const r = computeTds({ section: "194J", amount: 100000 });
    expect(r.applied).toBe(true);
    expect(r.tds).toBe(10000);
  });
  it("skips TDS below the section threshold", () => {
    const r = computeTds({ section: "194C", amount: 20000 }); // < 30000
    expect(r.applied).toBe(false);
    expect(r.tds).toBe(0);
  });
  it("applies when cumulative crosses the threshold", () => {
    const r = computeTds({ section: "194C", amount: 20000, cumulativeForYear: 40000 });
    expect(r.applied).toBe(true);
    expect(r.tds).toBe(400); // 2% of this bill
  });
  it("throws on an unknown section", () => {
    expect(() => computeTds({ section: "999X", amount: 1000 })).toThrow();
  });
});
