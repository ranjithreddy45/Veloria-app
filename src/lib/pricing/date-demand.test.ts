import { describe, it, expect } from "vitest";
import { classifyDateDemand, recommendedFloorPreTax, DEFAULT_DEMAND_CONFIG } from "./date-demand";

const cfg = DEFAULT_DEMAND_CONFIG; // Conservative: muhurtham 20, festival 15, sat 12, sun 8, scarcity step 5 cap 30

describe("classifyDateDemand", () => {
  it("applies the Muhurtham premium on an auspicious date (regardless of weekday)", () => {
    const d = classifyDateDemand(cfg, 3 /*Wed*/, { type: "MUHURTHAM", label: "Akshaya Tritiya", premiumPct: null }, 0);
    expect(d.tier).toBe("MUHURTHAM");
    expect(d.premiumPct).toBe(20);
    expect(d.noDiscount).toBe(true);
  });

  it("honours a per-date premium override", () => {
    const d = classifyDateDemand(cfg, 1, { type: "MUHURTHAM", label: "Peak", premiumPct: 45 }, 0);
    expect(d.premiumPct).toBe(45);
  });

  it("charges a weekend premium (Saturday > Sunday)", () => {
    expect(classifyDateDemand(cfg, 6, null, 0).premiumPct).toBe(12); // Sat
    expect(classifyDateDemand(cfg, 0, null, 0).premiumPct).toBe(8); // Sun
    expect(classifyDateDemand(cfg, 6, null, 0).tier).toBe("WEEKEND");
  });

  it("takes the STRONGER of peak-vs-weekend, then adds scarcity", () => {
    // Muhurtham on a Saturday with 2 slots already booked: max(20,12)=20 + 2*5=10 → 30
    const d = classifyDateDemand(cfg, 6, { type: "MUHURTHAM", label: "M", premiumPct: null }, 2);
    expect(d.basePremiumPct).toBe(20);
    expect(d.scarcityBumpPct).toBe(10);
    expect(d.premiumPct).toBe(30);
  });

  it("caps the scarcity bump", () => {
    const d = classifyDateDemand(cfg, 6, { type: "MUHURTHAM", label: "M", premiumPct: null }, 100);
    expect(d.scarcityBumpPct).toBe(30); // cap
    expect(d.premiumPct).toBe(50); // 20 + 30
  });

  it("a plain weekday is REGULAR with no premium (and discountable)", () => {
    const d = classifyDateDemand(cfg, 3, null, 0);
    expect(d.tier).toBe("REGULAR");
    expect(d.premiumPct).toBe(0);
    expect(d.noDiscount).toBe(false);
  });

  it("respects the global disable switch", () => {
    const d = classifyDateDemand({ ...cfg, enabled: false }, 6, { type: "MUHURTHAM", label: "M", premiumPct: 50 }, 5);
    expect(d.premiumPct).toBe(0);
    expect(d.tier).toBe("REGULAR");
  });

  it("recommendedFloorPreTax lifts the subtotal by the premium", () => {
    expect(recommendedFloorPreTax(500000, 20)).toBe(600000);
    expect(recommendedFloorPreTax(500000, 0)).toBe(500000);
  });
});
