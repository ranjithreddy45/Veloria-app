import { describe, it, expect } from "vitest";
import { computeQuotation, computePackageLine, QUOTE_CATALOG } from "@/lib/sales/quotation-calc";
import {
  REQUEST_TEXT_MAX,
  cateringCatalog,
  estimateCatering,
  estimatePackage,
  estimateQuantity,
  estimateSelection,
  packageLine,
  packageRequestText,
  priceBasis,
  priceUnitLabel,
  quantityLabel,
  type PricedPackage,
} from "./package-pricing";
import { MAX_INLINE_IMAGE_CHARS, customerImageUrl, describeInclusions, groupPackages, humanizeKey, isOfferedAtVenue, type PublicPackage } from "./package-catalog";

const pkg = (over: Partial<PricedPackage> = {}): PricedPackage => ({
  id: "vp1",
  name: "Royal Buffet",
  categoryLabel: "Catering",
  unitPrice: 850,
  priceUnit: "PER_PLATE",
  minPax: null,
  ...over,
});

describe("price display uses the team's units", () => {
  it("labels every VendorPackage price unit with the team's words", () => {
    expect(priceUnitLabel("PER_PLATE")).toBe("per plate");
    expect(priceUnitLabel("PER_EVENT")).toBe("per event");
    expect(priceUnitLabel("PER_PIECE")).toBe("per piece");
    expect(priceUnitLabel("PER_HOUR")).toBe("per hour");
    expect(priceUnitLabel("PER_DAY")).toBe("per day");
    expect(priceUnitLabel("PER_WEEK")).toBe("per week");
  });

  it("classifies per plate as per guest, per event as flat, the rest as per unit", () => {
    expect(priceBasis("PER_PLATE")).toBe("PER_GUEST");
    expect(priceBasis("PER_EVENT")).toBe("FLAT");
    for (const u of ["PER_PIECE", "PER_HOUR", "PER_DAY"]) expect(priceBasis(u)).toBe("PER_UNIT");
  });

  it("names quantities in the unit", () => {
    expect(quantityLabel("PER_PLATE", 1)).toBe("1 plate");
    expect(quantityLabel("PER_PLATE", 1200)).toBe("1,200 plates");
    expect(quantityLabel("PER_HOUR", 4)).toBe("4 hours");
    expect(quantityLabel("SOMETHING", 2)).toBe("2 units");
  });
});

describe("estimateQuantity follows the quote builder's default quantity", () => {
  it("per plate uses the guest count", () => {
    expect(estimateQuantity({ priceUnit: "PER_PLATE", minPax: null }, 120)).toEqual({ qty: 120, basis: "GUESTS" });
    expect(estimateQuantity({ priceUnit: "PER_PLATE", minPax: 50 }, 120)).toEqual({ qty: 120, basis: "GUESTS" });
  });
  it("never goes below the package minimum the team enforces", () => {
    expect(estimateQuantity({ priceUnit: "PER_PLATE", minPax: 100 }, 80)).toEqual({ qty: 100, basis: "MINIMUM" });
    expect(estimateQuantity({ priceUnit: "PER_PIECE", minPax: 50 }, 300)).toEqual({ qty: 50, basis: "MINIMUM" });
  });
  it("flat and per-unit packages without a minimum count once", () => {
    expect(estimateQuantity({ priceUnit: "PER_EVENT", minPax: null }, 300)).toEqual({ qty: 1, basis: "ONE" });
    expect(estimateQuantity({ priceUnit: "PER_HOUR", minPax: 0 }, 300)).toEqual({ qty: 1, basis: "ONE" });
  });
});

describe("estimates are the team's quotation engine output", () => {
  it("per plate = unit price × guests, identical to computeQuotation and computePackageLine", () => {
    const est = estimatePackage(pkg(), 120)!;
    const line = { vendorPackageId: "vp1", name: "Royal Buffet", category: "Catering", unitPrice: 850, qty: 120 };
    expect(est.amount).toBe(computeQuotation({ guestCount: 120, packageLines: [line] }).subtotal);
    expect(est.amount).toBe(computePackageLine(line).amount);
    expect(est.amount).toBe(102_000);
    expect(est.qtyLabel).toBe("120 plates");
  });

  it("per event is flat: the guest count doesn't multiply it", () => {
    const est = estimatePackage(pkg({ unitPrice: 45_000, priceUnit: "PER_EVENT" }), 300)!;
    expect(est.amount).toBe(45_000);
    expect(est.basis).toBe("ONE");
  });

  it("per unit with a minimum is priced at the minimum", () => {
    const p = pkg({ unitPrice: 120, priceUnit: "PER_PIECE", minPax: 50 });
    const est = estimatePackage(p, 300)!;
    expect(est.amount).toBe(computeQuotation({ guestCount: 300, packageLines: [packageLine(p, 300)] }).subtotal);
    expect(est.amount).toBe(6_000);
    expect(est.qtyLabel).toBe("50 pieces");
  });

  it("per hour and per day without a minimum count one unit", () => {
    expect(estimatePackage(pkg({ unitPrice: 5_000, priceUnit: "PER_HOUR" }), 200)!.amount).toBe(5_000);
    expect(estimatePackage(pkg({ unitPrice: 9_000, priceUnit: "PER_DAY" }), 200)!.amount).toBe(9_000);
  });

  it("a per-plate package below its minimum is estimated at the minimum", () => {
    const est = estimatePackage(pkg({ unitPrice: 500, minPax: 100 }), 80)!;
    expect(est).toMatchObject({ qty: 100, basis: "MINIMUM", amount: 50_000 });
  });

  it("Veloria catering is per plate from QUOTE_CATALOG, via the engine's Food Plan line", () => {
    const est = estimateCatering("veg_gold", 120)!;
    expect(est.amount).toBe(computeQuotation({ guestCount: 120, foodPackageId: "veg_gold" }).subtotal);
    expect(est.amount).toBe(83_880);
    expect(cateringCatalog()).toEqual(QUOTE_CATALOG.food.map(({ id, label, perPlate, veg }) => ({ id, label, perPlate, veg })));
  });

  it("gives no estimate without a guest count, or for an unknown catering package", () => {
    expect(estimatePackage(pkg(), 0)).toBeNull();
    expect(estimateCatering("veg_gold", Number.NaN)).toBeNull();
    expect(estimateCatering("no_such_package", 100)).toBeNull();
    expect(estimateSelection({ guests: 0, cateringId: "veg_gold", packages: [pkg()] })).toBeNull();
    expect(estimateSelection({ guests: 100, cateringId: null, packages: [] })).toBeNull();
  });

  it("a mixed selection totals exactly like one quotation with the same lines", () => {
    const perPlate = pkg();
    const flat = pkg({ id: "vp2", name: "Mandap Décor", categoryLabel: "Décor", unitPrice: 45_000, priceUnit: "PER_EVENT" });
    const est = estimateSelection({ guests: 120, cateringId: "veg_gold", packages: [perPlate, flat] })!;
    const quote = computeQuotation({ guestCount: 120, foodPackageId: "veg_gold", packageLines: [packageLine(perPlate, 120), packageLine(flat, 120)] });
    expect(est.subtotal).toBe(quote.subtotal);
    expect(est.subtotal).toBe(83_880 + 102_000 + 45_000);
    expect(est.lines.reduce((s, l) => s + l.amount, 0)).toBe(est.subtotal);
  });

  it("regression: per-plate prices are no longer added up as if they were flat", () => {
    const naiveSum = 850 + 45_000; // what the old screen showed as the total
    const est = estimateSelection({ guests: 120, cateringId: null, packages: [pkg(), pkg({ id: "vp2", unitPrice: 45_000, priceUnit: "PER_EVENT" })] })!;
    expect(est.subtotal).not.toBe(naiveSum);
    expect(est.subtotal).toBe(147_000);
  });
});

describe("packageRequestText", () => {
  const vendor = (p: PricedPackage) => ({ ...p, vendorName: "Partner Co." });

  it("quotes each price with its unit and states the estimate's guest count and taxes", () => {
    const packages = [vendor(pkg()), vendor(pkg({ id: "vp2", name: "Mandap Décor", unitPrice: 45_000, priceUnit: "PER_EVENT", minPax: 2 }))];
    const catering = cateringCatalog().find((c) => c.id === "veg_gold")!;
    const estimate = estimateSelection({ guests: 120, cateringId: "veg_gold", packages });
    const text = packageRequestText({ catering, packages, estimate });
    expect(text).toContain("Veg Gold package (Veloria catering, ₹699 per plate)");
    expect(text).toContain("Royal Buffet (Partner Co., ₹850 per plate)");
    expect(text).toContain("Mandap Décor (Partner Co., ₹45,000 per event, minimum 2 events)");
    // 699 × 120 + 850 × 120 + 45,000 × 2 (the décor package's minimum of 2 events).
    expect(text).toContain("App estimate for 120 guests: ₹2,75,880 before taxes");
  });

  it("asks the team to price it when there is no guest count", () => {
    const text = packageRequestText({ catering: null, packages: [vendor(pkg())], estimate: null });
    expect(text).toContain("Please confirm prices for my guest count");
  });

  it("stays within what requestFromConcierge keeps", () => {
    const many = Array.from({ length: 80 }, (_, i) => vendor(pkg({ id: `p${i}`, name: `A long partner package name number ${i}` })));
    const text = packageRequestText({ catering: null, packages: many, estimate: estimateSelection({ guests: 100, cateringId: null, packages: many }) });
    expect(text.length).toBeLessThanOrEqual(REQUEST_TEXT_MAX);
    expect(text).toMatch(/…and \d+ more/);
    expect(text).toContain("before taxes");
  });
});

describe("package catalog helpers", () => {
  const scoped = (allVenues: boolean, venueIds: string[], vendor: { allVenues: boolean; venueIds: string[] } | null) => ({ allVenues, venueIds, vendor });

  it("applies the quote builder's hall rule", () => {
    expect(isOfferedAtVenue(scoped(false, ["h2"], null), null)).toBe(true);
    expect(isOfferedAtVenue(scoped(false, ["h1"], { allVenues: true, venueIds: [] }), "h1")).toBe(true);
    expect(isOfferedAtVenue(scoped(false, ["h2"], { allVenues: true, venueIds: [] }), "h1")).toBe(false);
    expect(isOfferedAtVenue(scoped(true, [], { allVenues: true, venueIds: [] }), "h1")).toBe(true);
    expect(isOfferedAtVenue(scoped(true, [], { allVenues: false, venueIds: ["h1"] }), "h1")).toBe(true);
    expect(isOfferedAtVenue(scoped(true, [], { allVenues: false, venueIds: ["h2"] }), "h1")).toBe(false);
    expect(isOfferedAtVenue(scoped(true, [], { allVenues: false, venueIds: [] }), "h1")).toBe(true);
  });

  it("only passes image urls a phone can load safely", () => {
    expect(customerImageUrl("https://cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg");
    expect(customerImageUrl("/uploads/a.jpg")).toBe("/uploads/a.jpg");
    expect(customerImageUrl("//evil.example.com/a.jpg")).toBeNull();
    expect(customerImageUrl("javascript:alert(1)")).toBeNull();
    expect(customerImageUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(customerImageUrl(`data:image/png;base64,${"A".repeat(MAX_INLINE_IMAGE_CHARS)}`)).toBeNull();
    expect(customerImageUrl(null)).toBeNull();
  });

  it("describes inclusions the way the package builder defines them", () => {
    const out = describeInclusions([
      {
        title: "Starters",
        items: [
          { name: "Welcome drink", type: "FIXED", options: [], chooseCount: null },
          { name: "Soup", type: "SINGLE_CHOICE", options: ["Tomato", "Sweet corn"], chooseCount: null },
          { name: "Veg starters", type: "MULTI_CHOICE", options: ["Paneer tikka", "Hara bhara kebab", "Corn cheese balls"], chooseCount: 2 },
          { name: "  ", type: "FIXED", options: [], chooseCount: null },
        ],
      },
      { title: "Empty", items: [] },
    ]);
    expect(out).toEqual([
      { title: "Starters", items: ["Welcome drink", "Soup: choose 1 of Tomato, Sweet corn", "Veg starters: choose 2 of Paneer tikka, Hara bhara kebab, Corn cheese balls"] },
    ]);
  });

  it("groups packages by the team's category order, then label", () => {
    const p = (id: string, category: string, categoryLabel: string): PublicPackage => ({
      id, name: id, category, categoryLabel, vendorName: "V", description: null, unitPrice: 1, priceUnit: "PER_EVENT", minPax: null, imageUrl: null, inclusions: [],
    });
    const groups = groupPackages([p("a", "decor", "Décor"), p("b", "catering", "Catering"), p("c", "decor", "Décor"), p("d", "zeta", "Zeta")], new Map([["catering", 0], ["decor", 1]]));
    expect(groups.map((g) => g.key)).toEqual(["catering", "decor", "zeta"]);
    expect(groups[1].packages.map((x) => x.id)).toEqual(["a", "c"]);
    expect(humanizeKey("av_lighting")).toBe("Av lighting");
  });
});
