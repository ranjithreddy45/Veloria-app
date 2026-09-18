import { createHmac, timingSafeEqual } from "node:crypto";

// ============================================================
// Signed "Add to calendar" links for someone who has just paid on /pay.
// ------------------------------------------------------------
// /pay is a public link, so the payer is often not signed in. After the
// payment is verified, the /pay outcome action mints a short-lived token bound
// to ONE booking; the calendar route accepts it instead of a session. The
// token only unlocks that booking's .ics (event name, date, venue), expires,
// and is an HMAC over a purpose-specific context so it can never be reused as
// anything else. Pure apart from reading the secret; unit-tested.
// ============================================================

const CONTEXT = "veloria:guest-calendar:v1";

/** Long enough to tap "Add to calendar" again from the same page later on. */
export const CALENDAR_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function calendarTokenSecret(): string | null {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || null;
}

function mac(bookingId: string, exp: string, secret: string): string {
  return createHmac("sha256", secret).update(`${CONTEXT}:${bookingId}:${exp}`).digest("base64url");
}

export function signCalendarToken(bookingId: string, expiresAtMs: number, secret: string): string {
  const exp = Math.floor(expiresAtMs).toString(36);
  return `${exp}.${mac(bookingId, exp, secret)}`;
}

export function verifyCalendarToken(
  token: string | null | undefined,
  bookingId: string,
  secret: string | null | undefined,
  nowMs: number
): boolean {
  if (!token || !secret || !bookingId) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = token.slice(0, dot);
  const given = token.slice(dot + 1);
  if (!/^[0-9a-z]{1,12}$/.test(exp)) return false;
  const expMs = parseInt(exp, 36);
  if (!Number.isFinite(expMs) || expMs < nowMs) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(mac(bookingId, exp, secret));
  return a.length === b.length && timingSafeEqual(a, b);
}
