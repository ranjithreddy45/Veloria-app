// ============================================================
// Geo + IP helpers for attendance check-in. Pure & testable.
// ============================================================

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
