// ============================================================
// Geo + IP helpers for attendance check-in. Pure & testable.
// ============================================================

/**
 * Worst GPS fix (in metres) we will trust for a radius match. A coarse wifi/IP
 * fix can be ±5km and would "land inside" a 200m radius by luck, so anything
 * looser than this is treated as unverified and flagged for review.
 */
export const MAX_TRUSTED_ACCURACY_M = 100;

/** A coordinate pair supplied by a client. Never trust it before this passes. */
export function isValidCoord(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" && typeof lng === "number" &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    // 0,0 (Null Island) is what a broken/spoofed sensor emits — never a workplace.
    !(lat === 0 && lng === 0)
  );
}

/** Is the reported GPS accuracy good enough to trust a radius match? */
export function isTrustedAccuracy(accuracyM: number | null | undefined): boolean {
  if (accuracyM == null) return false; // unknown accuracy is not trusted
  return Number.isFinite(accuracyM) && accuracyM > 0 && accuracyM <= MAX_TRUSTED_ACCURACY_M;
}

/** Great-circle distance between two lat/lng points, in metres (Haversine). */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // earth radius m
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Is a point within `radiusMeters` of a site centre? */
export function withinRadius(
  pointLat: number, pointLng: number,
  siteLat: number, siteLng: number,
  radiusMeters: number
): boolean {
  return haversineMeters(pointLat, pointLng, siteLat, siteLng) <= radiusMeters;
}

/** Does an IP match an allow-list (comma-separated exact IPs)? Empty list = allow all. */
export function ipAllowed(ip: string | null | undefined, allowList: string | null | undefined): boolean {
  if (!allowList || !allowList.trim()) return true;
  if (!ip) return false;
  const allowed = allowList.split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(ip.trim());
}

/** Extract the best client IP from forwarded headers. */
export function clientIpFromHeaders(xff: string | null, realIp: string | null): string | null {
  if (xff) return xff.split(",")[0].trim();
  if (realIp) return realIp.trim();
  return null;
}

/** An EXPLICIT allow-list match. Unlike ipAllowed(), an empty list is NOT a match —
 * "no restriction" must not, by itself, count as an IP-based acceptance. */
export function ipExplicitlyAllowed(ip: string | null | undefined, allowList: string | null | undefined): boolean {
  if (!allowList?.trim() || !ip) return false;
  return allowList.split(",").map((s) => s.trim()).filter(Boolean).includes(ip.trim());
}

/** A geofence site the check-in is validated against. */
export interface GeofenceSite {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  radiusMeters: number;
  allowedIps: string | null;
  allowWfh: boolean;
}

export interface GeofenceInput {
  lat?: number;
  lng?: number;
  accuracyM?: number;
  visitType: "OFFICE" | "FIELD" | "CLIENT";
  ip: string | null;
}

export interface GeofenceVerdict {
  matchedSite: { id: string; name: string } | null;
  verified: boolean | null; // true = provably at the site (radius or office IP)
  flagged: boolean;
  flagReason: string | null;
  wfh: boolean; // caller downgrades the punch status to WFH
}

/**
 * Decide a check-in against the employee's assigned site(s). A punch is accepted if
 * it matches ANY assigned site — acceptance is an OR across sites AND across signals:
 *   office IP allow-list match  OR  inside a site radius with a trusted GPS fix  OR
 *   any assigned site permits WFH (recorded as WFH). Otherwise the punch is recorded
 *   but FLAGGED for review — never hard-blocked, so a present employee with a flaky
 *   sensor is not locked out. Pure & deterministic (the DB read happens in the
 *   caller); this is the single source of truth for the geofence rule.
 *
 * `sites` must be non-empty — the caller decides the org-wide fallback when an
 * employee has no assignment.
 */
export function evaluateGeofenceMulti(sites: GeofenceSite[], input: GeofenceInput): GeofenceVerdict {
  const single = sites.length === 1 ? sites[0] : null;

  // 1) Office network — an explicit IP match on ANY assigned site verifies even
  //    without GPS (a desktop punch on the office LAN has no geolocation).
  for (const s of sites) {
    if (ipExplicitlyAllowed(input.ip, s.allowedIps)) {
      return { matchedSite: { id: s.id, name: s.name }, verified: true, flagged: false, flagReason: null, wfh: false };
    }
  }

  const validCoord = isValidCoord(input.lat, input.lng);
  const trusted = validCoord && isTrustedAccuracy(input.accuracyM);

  // 2) Inside ANY assigned site's geofence with a trusted fix.
  if (trusted) {
    for (const s of sites) {
      if (s.lat != null && s.lng != null && withinRadius(input.lat!, input.lng!, s.lat, s.lng, s.radiusMeters)) {
        return { matchedSite: { id: s.id, name: s.name }, verified: true, flagged: false, flagReason: null, wfh: false };
      }
    }
  }

  // Field work is off-site by nature — record unverified, don't flag.
  if (input.visitType === "FIELD") {
    return { matchedSite: null, verified: false, flagged: false, flagReason: null, wfh: false };
  }

  // 3) WFH policy — allowed if ANY assigned site permits it.
  if (sites.some((s) => s.allowWfh)) {
    return { matchedSite: null, verified: false, flagged: false, flagReason: null, wfh: true };
  }

  // Rejected: matched no assigned site, no other acceptance path → flag for review.
  const where = single ? `your assigned site (${single.name})` : `any of your ${sites.length} assigned sites`;
  const radiusPart = single ? `the ${single.radiusMeters}m radius of ${where}` : `the radius of ${where}`;
  const reason = !validCoord
    ? `No valid location captured — ${single ? `${single.name} requires` : "your assigned sites require"} on-site check-in`
    : !trusted
      ? `GPS accuracy ${input.accuracyM == null ? "unknown" : `±${Math.round(input.accuracyM)}m`} too coarse to verify at ${single ? single.name : "your assigned sites"} (needs ≤${MAX_TRUSTED_ACCURACY_M}m)`
      : `Outside ${radiusPart}`;
  return { matchedSite: null, verified: false, flagged: true, flagReason: reason, wfh: false };
}

/** Single-site convenience wrapper (see evaluateGeofenceMulti). */
export function evaluateGeofence(site: GeofenceSite, input: GeofenceInput): GeofenceVerdict {
  return evaluateGeofenceMulti([site], input);
}
