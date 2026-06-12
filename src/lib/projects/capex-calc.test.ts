import { describe, it, expect } from "vitest";
import {
  computeCapex,
  validateCapexInput,
  defaultCapexInput,
  CAPEX_CATEGORIES,
  type CapexInput,
} from "./capex-calc";

describe("computeCapex — basis math", () => {
  it("AREA = rate × built-up area; UNIT = rate × qty; LUMPSUM = flat", () => {
    const input: CapexInput = {
      builtUpAreaSqft: 5000,
      guestSeats: 300,
      contingencyPct: 10,
      lines: [
        { key: "painting", included: true }, // AREA 65 × 5000 = 325000
        { key: "furniture", included: true }, // UNIT (per seat) 2200 × 300 = 660000
        { key: "lift_elevator", included: true, qty: 2 }, // UNIT 2,800,000 × 2 = 5,600,000
        { key: "av_systems", included: true }, // LUMPSUM 3,500,000
      ],
    };
    const r = computeCapex(input);
    const get = (k: string) => r.lines.find((l) => l.key === k)!.amount;
    expect(get("painting")).toBe(325000);
    expect(get("furniture")).toBe(660000);
    expect(get("lift_elevator")).toBe(5600000);
    expect(get("av_systems")).toBe(3500000);

    const subtotal = 325000 + 660000 + 5600000 + 3500000; // 10,085,000
    expect(r.subtotal).toBe(subtotal);
    expect(r.contingencyAmount).toBe(Math.round(subtotal * 0.1));
    expect(r.total).toBe(subtotal + Math.round(subtotal * 0.1));
  });

  it("rate + qty overrides beat the defaults", () => {
    const r = computeCapex({
      builtUpAreaSqft: 5000,
      guestSeats: 300,
      contingencyPct: 0,
      lines: [
        { key: "painting", included: true, rate: 80, qty: 4000 }, // 80 × 4000 = 320000
        { key: "civil_interiors", included: false }, // excluded
      ],
    });
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].amount).toBe(320000);
    expect(r.total).toBe(320000);
  });

  it("excludes non-included lines and clamps contingency", () => {
    const r = computeCapex({
      builtUpAreaSqft: 1000,
      guestSeats: 100,
      contingencyPct: 250,
      lines: [{ key: "painting", included: true }],
    });
    expect(r.contingencyPct).toBe(100);
  });

  it("estimates a sensible timeline and honours an override", () => {
    const auto = computeCapex(defaultCapexInput(6000, 400));
    expect(auto.estimatedWeeks).toBeGreaterThanOrEqual(8);
    const fixed = computeCapex({ ...defaultCapexInput(6000, 400), weeks: 20 });
    expect(fixed.estimatedWeeks).toBe(20);
  });
});

describe("defaultCapexInput + full rate card", () => {
  it("includes every category and totals positively", () => {
    const r = computeCapex(defaultCapexInput(5000, 300));
    expect(r.lines.length).toBe(CAPEX_CATEGORIES.length);
    expect(r.total).toBeGreaterThan(0);
    expect(r.contingencyPct).toBe(12);
  });
});

describe("validateCapexInput", () => {
  it("requires area + at least one included line", () => {
    expect(validateCapexInput({ lines: [] })).toContain("Built-up area (sq ft) is required.");
    expect(validateCapexInput({ builtUpAreaSqft: 100, lines: [{ key: "painting", included: false }] })).toContain(
      "Include at least one CapEx category."
    );
  });
  it("rejects negative rate/qty", () => {
    expect(
      validateCapexInput({ builtUpAreaSqft: 100, lines: [{ key: "painting", included: true, rate: -5 }] })
    ).toContain('Rate for "painting" cannot be negative.');
  });
});
