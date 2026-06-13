import { describe, it, expect } from "vitest";
import { VELOS_DEFAULTS, velosPeriod } from "./config";

describe("velosPeriod", () => {
  it("formats YYYY-MM in UTC", () => {
    expect(velosPeriod(new Date("2026-06-13T10:00:00.000Z"))).toBe("2026-06");
    expect(velosPeriod(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01");
    expect(velosPeriod(new Date("2026-12-31T23:59:59.000Z"))).toBe("2026-12");
  });
});

describe("VELOS_DEFAULTS integrity", () => {
  it("has unique event types", () => {
    const keys = VELOS_DEFAULTS.map((d) => d.eventType);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("marks site_visit_done as effort and never clawback-eligible", () => {
    const sv = VELOS_DEFAULTS.find((d) => d.eventType === "site_visit_done")!;
    expect(sv.isEffort).toBe(true);
    expect(sv.clawbackEligible).toBeFalsy();
  });
  it("marks the three sale-side events clawback-eligible", () => {
    for (const k of ["token_paid", "contract_signed", "advance_received"]) {
      expect(VELOS_DEFAULTS.find((d) => d.eventType === k)!.clawbackEligible).toBe(true);
    }
  });
  it("keeps overdue penalty negative", () => {
    expect(VELOS_DEFAULTS.find((d) => d.eventType === "lead_went_overdue")!.points).toBeLessThan(0);
  });
});
