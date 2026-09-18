import { PushApiError } from "./errors";

// ============================================================
// Failed-authentication throttle, per client IP.
//
// The per-key rate limit can only run once we know the key, so on its own it
// does nothing against a caller hammering the endpoint with bad credentials.
// This counts FAILED authentications per IP and refuses that IP for the rest
// of the minute once it passes the limit — before any database work.
//
// Kept in memory, per app instance, deliberately: it guards the database from
// junk traffic, so it must not itself cost a database write per request. With
// N instances an attacker gets at most N × the limit, which is still a hard cap.
// ============================================================

const WINDOW_MS = 60_000;
const MAX_TRACKED_IPS = 50_000;

interface Bucket {
  windowStart: number;
  failures: number;
}

const buckets = new Map<string, Bucket>();

function bucketFor(ip: string, now: number): Bucket {
  let b = buckets.get(ip);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    if (!b && buckets.size >= MAX_TRACKED_IPS) {
      // Evict expired buckets; if still full, drop the oldest insertion.
      for (const [k, v] of buckets) if (now - v.windowStart >= WINDOW_MS) buckets.delete(k);
      if (buckets.size >= MAX_TRACKED_IPS) buckets.delete(buckets.keys().next().value!);
    }
    b = { windowStart: Math.floor(now / WINDOW_MS) * WINDOW_MS, failures: 0 };
    buckets.set(ip, b);
  }
  return b;
}

/** Throws 429 if this IP has already failed authentication too often this minute. */
export function assertNotBlocked(ip: string | null, limit: number, now: number = Date.now()): void {
  if (!ip) return;
  const b = bucketFor(ip, now);
  if (b.failures >= limit) {
    const retryAfter = Math.max(1, Math.ceil((b.windowStart + WINDOW_MS - now) / 1000));
    throw new PushApiError(
      "TOO_MANY_FAILED_ATTEMPTS",
      "Too many failed authentication attempts. Try again later.",
      undefined,
      { "Retry-After": String(retryAfter) }
    );
  }
}

/**
 * Record one failed authentication. Returns true while the failure is still
 * within the limit — the caller only writes an audit row then, so a flood of
 * bad credentials is audited once per IP per minute, not once per request.
 */
export function recordAuthFailure(ip: string | null, limit: number, now: number = Date.now()): boolean {
  if (!ip) return true;
  const b = bucketFor(ip, now);
  b.failures += 1;
  return b.failures <= limit;
}

/** Test hook. */
export function resetAuthFailures(): void {
  buckets.clear();
}
