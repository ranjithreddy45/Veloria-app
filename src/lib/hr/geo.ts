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
