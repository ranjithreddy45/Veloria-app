import { describe, it, expect } from "vitest";
import {
  haversineMeters, withinRadius, ipAllowed,
  isValidCoord, isTrustedAccuracy, MAX_TRUSTED_ACCURACY_M,
} from "./geo";

// ============================================================
// Geo INTEGRITY guards. Coordinates and accuracy arrive from the browser and
// are therefore untrusted: these rules decide whether a punch may ever be
// marked `locationVerified`. Each rule gets at least one negative test.
// ============================================================

describe("isValidCoord — untrusted client coordinates", () => {
  it("accepts a real coordinate", () => {
    expect(isValidCoord(17.385, 78.4867)).toBe(true);
  });
  it("rejects (0,0) Null Island — the classic broken/spoofed sensor value", () => {
    expect(isValidCoord(0, 0)).toBe(false);
  });
  it("rejects out-of-range lat/lng", () => {
    expect(isValidCoord(91, 10)).toBe(false);
    expect(isValidCoord(-91, 10)).toBe(false);
    expect(isValidCoord(10, 181)).toBe(false);
    expect(isValidCoord(10, -181)).toBe(false);
  });
  it("rejects NaN / Infinity", () => {
    expect(isValidCoord(NaN, 10)).toBe(false);
    expect(isValidCoord(10, Infinity)).toBe(false);
  });
  it("rejects non-numeric payloads and missing values", () => {
    expect(isValidCoord("17.385" as unknown as number, 78 as unknown as number)).toBe(false);
    expect(isValidCoord(undefined, undefined)).toBe(false);
    expect(isValidCoord(null as unknown as number, null as unknown as number)).toBe(false);
  });
});

describe("isTrustedAccuracy — a coarse fix cannot substantiate a radius match", () => {
  it("trusts a tight GPS fix, up to and including the limit", () => {
    expect(isTrustedAccuracy(8)).toBe(true);
    expect(isTrustedAccuracy(MAX_TRUSTED_ACCURACY_M)).toBe(true);
  });
  it("rejects a coarse wifi/IP fix that could land inside a small radius by luck", () => {
    expect(isTrustedAccuracy(MAX_TRUSTED_ACCURACY_M + 1)).toBe(false);
    expect(isTrustedAccuracy(5000)).toBe(false);
  });
  it("treats UNKNOWN accuracy as untrusted rather than as good", () => {
    expect(isTrustedAccuracy(null)).toBe(false);
    expect(isTrustedAccuracy(undefined)).toBe(false);
  });
  it("rejects nonsense accuracy", () => {
    expect(isTrustedAccuracy(0)).toBe(false);
    expect(isTrustedAccuracy(-10)).toBe(false);
    expect(isTrustedAccuracy(NaN)).toBe(false);
  });
});

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
