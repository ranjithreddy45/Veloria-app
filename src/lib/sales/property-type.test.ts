import { describe, expect, it } from "vitest";

import { computeQuotation, QUOTE_TAX_RATE } from "./quotation-calc";
import {
  defaultGstFor,
  defaultSlabsFor,
  propertyTypeLabel,
  PROPERTY_TYPES,
} from "./property-type";

describe("defaultGstFor", () => {
  it("charges 18% at 4- and 5-star hotels", () => {
    expect(defaultGstFor("HOTEL_5_STAR")).toBe(18);
    expect(defaultGstFor("HOTEL_4_STAR")).toBe(18);
  });

  it("charges 5% everywhere else", () => {
    expect(defaultGstFor("BANQUET_HALL")).toBe(5);
    expect(defaultGstFor("LAWN_FARMHOUSE")).toBe(5);
    expect(defaultGstFor("HOTEL_3_STAR")).toBe(5);
  });

  it("falls back to 5% for a property with no type, or an unknown one", () => {
    expect(defaultGstFor(null)).toBe(5);
    expect(defaultGstFor(undefined)).toBe(5);
    expect(defaultGstFor("SOMETHING_ELSE")).toBe(5);
  });
});

describe("defaultSlabsFor", () => {
  it("always offers both rates, so a hall let without food can still be 18%", () => {
    for (const type of PROPERTY_TYPES) {
      const slabs = defaultSlabsFor(type.value);
      expect(slabs).toHaveLength(2);
      expect(slabs.map((s) => s.cgstRate + s.sgstRate + s.igstRate).sort((a, b) => a - b)).toEqual([
        5, 18,
      ]);
    }
  });

  it("preselects the rate the property type implies", () => {
    const hotel = defaultSlabsFor("HOTEL_5_STAR").find((s) => s.isDefault);
    expect(hotel && hotel.cgstRate + hotel.sgstRate).toBe(18);

    const hall = defaultSlabsFor("BANQUET_HALL").find((s) => s.isDefault);
    expect(hall && hall.cgstRate + hall.sgstRate).toBe(5);
  });

  it("marks exactly one rate as the default", () => {
    for (const type of PROPERTY_TYPES) {
      expect(defaultSlabsFor(type.value).filter((s) => s.isDefault)).toHaveLength(1);
    }
  });

  it("splits every rate evenly into CGST and SGST, with no IGST", () => {
    for (const slab of defaultSlabsFor("HOTEL_4_STAR")) {
      expect(slab.cgstRate).toBe(slab.sgstRate);
      expect(slab.igstRate).toBe(0);
    }
  });
});

describe("propertyTypeLabel", () => {
  it("says so plainly when nothing is set", () => {
    expect(propertyTypeLabel(null)).toBe("Not set");
    expect(propertyTypeLabel("HOTEL_5_STAR")).toBe("5-star hotel");
  });
});

describe("computeQuotation with a property rate", () => {
  const input = { guestCount: 100, foodPackageId: undefined, customLines: [{ label: "Hall", amount: 100000 }] };

  it("keeps the planner's 5% when no rate is supplied", () => {
    const out = computeQuotation(input);
    expect(out.taxRate).toBe(QUOTE_TAX_RATE);
    expect(out.tax).toBe(5000);
    expect(out.grandTotal).toBe(105000);
  });

  it("charges the hotel rate when one is supplied", () => {
    const out = computeQuotation({ ...input, taxRate: 0.18 });
    expect(out.taxRate).toBe(0.18);
    expect(out.tax).toBe(18000);
    expect(out.grandTotal).toBe(118000);
  });

  it("applies the rate after the discount, not before", () => {
    const out = computeQuotation({ ...input, taxRate: 0.18, discountPct: 10 });
    expect(out.taxableAmount).toBe(90000);
    expect(out.tax).toBe(16200);
  });

  it("ignores a nonsense rate rather than charging it", () => {
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(computeQuotation({ ...input, taxRate: bad }).taxRate).toBe(QUOTE_TAX_RATE);
    }
  });

  it("charges nothing at 0%, which is a real rate and not a missing one", () => {
    const out = computeQuotation({ ...input, taxRate: 0 });
    expect(out.tax).toBe(0);
    expect(out.grandTotal).toBe(100000);
  });
});
