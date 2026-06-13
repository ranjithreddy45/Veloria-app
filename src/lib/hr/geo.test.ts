import { describe, it, expect } from "vitest";
import { haversineMeters, withinRadius, ipAllowed } from "./geo";

describe("haversineMeters", () => {
  it("is ~0 for the same point", () => {
    expect(haversineMeters(12.97, 77.59, 12.97, 77.59)).toBeLessThan(1);
  });
  it("computes a known short distance (~111m per 0.001 deg lat)", () => {
    const m = haversineMeters(12.970, 77.594, 12.971, 77.594);
    expect(m).toBeGreaterThan(100);
    expect(m).toBeLessThan(120);
  });
});

describe("withinRadius", () => {
  it("true when inside radius", () => {
    expect(withinRadius(12.9701, 77.5940, 12.9700, 77.5940, 200)).toBe(true);
  });
  it("false when outside radius", () => {
    expect(withinRadius(12.9800, 77.5940, 12.9700, 77.5940, 200)).toBe(false);
  });
});

describe("ipAllowed", () => {
  it("allows everything when list empty", () => {
    expect(ipAllowed("1.2.3.4", null)).toBe(true);
    expect(ipAllowed("1.2.3.4", "")).toBe(true);
  });
  it("matches an allow-listed ip", () => {
    expect(ipAllowed("1.2.3.4", "9.9.9.9, 1.2.3.4")).toBe(true);
  });
  it("rejects a non-listed ip", () => {
    expect(ipAllowed("8.8.8.8", "1.2.3.4")).toBe(false);
    expect(ipAllowed(null, "1.2.3.4")).toBe(false);
  });
});
