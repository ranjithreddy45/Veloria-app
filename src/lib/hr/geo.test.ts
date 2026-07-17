import { describe, it, expect } from "vitest";
import {
  haversineMeters, withinRadius, ipAllowed,
  isValidCoord, isTrustedAccuracy, MAX_TRUSTED_ACCURACY_M,
  ipExplicitlyAllowed, evaluateGeofence, evaluateGeofenceMulti, type GeofenceSite,
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

describe("ipExplicitlyAllowed", () => {
  it("empty/absent list is NOT a match (unlike ipAllowed)", () => {
    expect(ipExplicitlyAllowed("1.2.3.4", null)).toBe(false);
    expect(ipExplicitlyAllowed("1.2.3.4", "")).toBe(false);
  });
  it("matches a listed ip only", () => {
    expect(ipExplicitlyAllowed("1.2.3.4", "9.9.9.9, 1.2.3.4")).toBe(true);
    expect(ipExplicitlyAllowed("8.8.8.8", "1.2.3.4")).toBe(false);
    expect(ipExplicitlyAllowed(null, "1.2.3.4")).toBe(false);
  });
});

describe("evaluateGeofence — check-in against the assigned site", () => {
  // Site centred at 12.9700,77.5940, radius 200m.
  const base: GeofenceSite = {
    id: "s1", name: "Bengaluru HQ", lat: 12.9700, lng: 77.5940,
    radiusMeters: 200, allowedIps: null, allowWfh: false,
  };
  const IN = { lat: 12.9701, lng: 77.5940, accuracyM: 20 };   // ~11m away
  const OUT = { lat: 12.9800, lng: 77.5940, accuracyM: 20 };  // ~1.1km away

  it("ACCEPTS inside the radius with a trusted fix", () => {
    const v = evaluateGeofence(base, { ...IN, visitType: "OFFICE", ip: null });
    expect(v.verified).toBe(true);
    expect(v.flagged).toBe(false);
    expect(v.matchedSite?.id).toBe("s1");
  });

  it("ACCEPTS via office IP even with no GPS", () => {
    const v = evaluateGeofence({ ...base, allowedIps: "203.0.113.7" }, { visitType: "OFFICE", ip: "203.0.113.7" });
    expect(v.verified).toBe(true);
    expect(v.flagged).toBe(false);
  });

  it("FLAGS an out-of-radius OFFICE punch when WFH is not allowed", () => {
    const v = evaluateGeofence(base, { ...OUT, visitType: "OFFICE", ip: null });
    expect(v.verified).toBe(false);
    expect(v.flagged).toBe(true);
    expect(v.flagReason).toMatch(/Outside the 200m radius/);
  });

  it("records WFH (unflagged) out-of-radius when the site allows WFH", () => {
    const v = evaluateGeofence({ ...base, allowWfh: true }, { ...OUT, visitType: "OFFICE", ip: null });
    expect(v.wfh).toBe(true);
    expect(v.flagged).toBe(false);
  });

  it("FLAGS a coarse GPS fix that can't substantiate a radius match", () => {
    const v = evaluateGeofence(base, { lat: 12.9701, lng: 77.5940, accuracyM: MAX_TRUSTED_ACCURACY_M + 50, visitType: "OFFICE", ip: null });
    expect(v.verified).toBe(false);
    expect(v.flagged).toBe(true);
    expect(v.flagReason).toMatch(/too coarse/);
  });

  it("FLAGS when no valid coordinate is captured (WFH off)", () => {
    const v = evaluateGeofence(base, { visitType: "OFFICE", ip: null });
    expect(v.flagged).toBe(true);
    expect(v.flagReason).toMatch(/No valid location/);
  });

  it("FIELD visits off-site are recorded unverified but NOT flagged", () => {
    const v = evaluateGeofence(base, { ...OUT, visitType: "FIELD", ip: null });
    expect(v.flagged).toBe(false);
    expect(v.verified).toBe(false);
  });

  it("an office-IP match wins even when GPS is out of radius", () => {
    const v = evaluateGeofence({ ...base, allowedIps: "203.0.113.7" }, { ...OUT, visitType: "OFFICE", ip: "203.0.113.7" });
    expect(v.verified).toBe(true);
    expect(v.flagged).toBe(false);
  });
});

describe("evaluateGeofenceMulti — accept a punch matching ANY assigned site", () => {
  const hq: GeofenceSite = { id: "hq", name: "HQ", lat: 12.9700, lng: 77.5940, radiusMeters: 200, allowedIps: null, allowWfh: false };
  const banquet: GeofenceSite = { id: "bq", name: "Grand Banquet", lat: 13.0000, lng: 77.6000, radiusMeters: 200, allowedIps: null, allowWfh: false };

  it("ACCEPTS when inside the SECOND assigned site", () => {
    const v = evaluateGeofenceMulti([hq, banquet], { lat: 13.0001, lng: 77.6000, accuracyM: 20, visitType: "OFFICE", ip: null });
    expect(v.verified).toBe(true);
    expect(v.flagged).toBe(false);
    expect(v.matchedSite?.id).toBe("bq");
  });

  it("FLAGS when outside ALL assigned sites (no WFH), naming the count", () => {
    const v = evaluateGeofenceMulti([hq, banquet], { lat: 12.5000, lng: 77.0000, accuracyM: 20, visitType: "OFFICE", ip: null });
    expect(v.flagged).toBe(true);
    expect(v.flagReason).toMatch(/any of your 2 assigned sites/);
  });

  it("records WFH if ANY assigned site permits it", () => {
    const v = evaluateGeofenceMulti([hq, { ...banquet, allowWfh: true }], { lat: 12.5, lng: 77.0, accuracyM: 20, visitType: "OFFICE", ip: null });
    expect(v.wfh).toBe(true);
    expect(v.flagged).toBe(false);
  });

  it("an office-IP match on the second site verifies with no GPS", () => {
    const v = evaluateGeofenceMulti([hq, { ...banquet, allowedIps: "10.0.0.5" }], { visitType: "OFFICE", ip: "10.0.0.5" });
    expect(v.verified).toBe(true);
    expect(v.matchedSite?.id).toBe("bq");
  });
});
