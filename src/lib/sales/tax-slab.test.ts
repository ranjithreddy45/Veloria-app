import { describe, it, expect } from "vitest";
import {
  resolveTaxSlab,
  blocksApproval,
  computeTax,
  totalRate,
  type TaxSlabLike,
} from "./tax-slab";

const slab = (over: Partial<TaxSlabLike> = {}): TaxSlabLike => ({
  id: "s1",
  name: "GST 18%",
  cgstRate: 9,
  sgstRate: 9,
  igstRate: 0,
  isDefault: false,
  isActive: true,
  ...over,
});

describe("resolveTaxSlab", () => {
  it("auto-applies when a property has exactly one slab", () => {
    const r = resolveTaxSlab([slab()]);
    expect(r.kind).toBe("AUTO");
    expect(blocksApproval(r)).toBe(false);
  });

  it("MUST ask when there are several and none is chosen", () => {
    // The expensive failure this prevents: a quote sent at the wrong rate is a
    // number the customer has already agreed to.
    const r = resolveTaxSlab([slab({ id: "a" }), slab({ id: "b", name: "GST 5%" })]);
    expect(r.kind).toBe("MUST_ASK");
    expect(blocksApproval(r)).toBe(true);
    if (r.kind === "MUST_ASK") expect(r.options).toHaveLength(2);
  });

  it("uses the default instead of asking, when exactly one is marked default", () => {
    const r = resolveTaxSlab([
      slab({ id: "a" }),
      slab({ id: "b", name: "GST 5%", isDefault: true }),
    ]);
    expect(r.kind).toBe("AUTO");
    if (r.kind === "AUTO") expect(r.slab.id).toBe("b");
  });

  it("asks when TWO slabs are marked default — a misconfiguration must not be hidden", () => {
    const r = resolveTaxSlab([
      slab({ id: "a", isDefault: true }),
      slab({ id: "b", name: "GST 5%", isDefault: true }),
    ]);
    expect(r.kind).toBe("MUST_ASK");
  });

  it("honours an explicit choice over the default", () => {
    const r = resolveTaxSlab(
      [slab({ id: "a" }), slab({ id: "b", name: "GST 5%", isDefault: true })],
      "a"
    );
    expect(r.kind).toBe("CHOSEN");
    if (r.kind === "CHOSEN") expect(r.slab.id).toBe("a");
  });

  it("keeps a retired slab on the quote that already used it", () => {
    // Retiring a rate must not silently re-price last month's quotation.
    const r = resolveTaxSlab([slab({ id: "old", isActive: false })], "old");
    expect(r.kind).toBe("CHOSEN");
  });

  it("ignores inactive slabs when nothing is chosen", () => {
    const r = resolveTaxSlab([slab({ id: "old", isActive: false })]);
    expect(r.kind).toBe("NONE");
  });

  it("re-asks rather than inventing a rate when the stored slab has vanished", () => {
    const r = resolveTaxSlab([slab({ id: "a" }), slab({ id: "b", name: "x" })], "deleted");
    expect(r.kind).toBe("MUST_ASK");
  });

  it("reports NONE when the property has no slabs at all", () => {
    expect(resolveTaxSlab([]).kind).toBe("NONE");
  });
});

describe("computeTax", () => {
  it("splits GST the way an invoice must print it", () => {
    expect(computeTax(100000, slab())).toEqual({
      cgst: 9000,
      sgst: 9000,
      igst: 0,
      total: 18000,
    });
  });

  it("handles inter-state IGST", () => {
    const r = computeTax(50000, slab({ cgstRate: 0, sgstRate: 0, igstRate: 18 }));
    expect(r).toEqual({ cgst: 0, sgst: 0, igst: 9000, total: 9000 });
  });

  it("rounds each component so the parts add back up to the total", () => {
    // An invoice whose three tax lines disagree with its tax total is one an
    // auditor rejects. 2.5% of 1033.33 lands mid-paise on both halves.
    const r = computeTax(1033.33, slab({ cgstRate: 2.5, sgstRate: 2.5 }));
    expect(r.cgst + r.sgst + r.igst).toBeCloseTo(r.total, 2);
  });

  it("is zero for a zero-rated slab rather than throwing", () => {
    const r = computeTax(1000, slab({ cgstRate: 0, sgstRate: 0, igstRate: 0 }));
    expect(r.total).toBe(0);
  });

  it("totalRate sums the split for display", () => {
    expect(totalRate(slab())).toBe(18);
    expect(totalRate(slab({ cgstRate: 0, sgstRate: 0, igstRate: 5 }))).toBe(5);
  });
});
