import { timingSafeEqual } from "crypto";

// Constant-time check of a caller-supplied secret against process.env.CRON_SECRET.
// Mirrors the bearer-token check used by the /api/cron/* route handlers, but for
// server actions that may be invoked directly from a cron route. Returns false
// if no secret is configured or the candidate doesn't match.
export function isValidCronSecret(candidate: string | null | undefined): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !candidate) return false;
  // Accept either the raw secret or the "Bearer <secret>" form.
  const value = candidate.startsWith("Bearer ") ? candidate.slice(7) : candidate;
  if (value.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(secret));
}
