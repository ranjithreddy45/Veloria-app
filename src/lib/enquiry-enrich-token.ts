import crypto from "crypto";

// ============================================================
// Short-lived token proving "I am the browser that just created this lead".
//
// The two-step landing form saves the lead after step 1 (name + mobile), then
// step 2 adds the event details. Step 2 therefore needs to UPDATE a lead that
// already exists — and the endpoint is public.
//
// Without proof, `POST /api/landing-lead {leadId, email}` would let anyone on
// the internet overwrite any lead whose id they could guess or observe. Ids are
// cuids, so guessing is impractical, but "hard to guess" is not authorisation:
// the id travels in a response body and could be logged, cached by a proxy, or
// sat in someone's devtools. Obscurity is not the control.
//
// So step 1 returns an HMAC over the lead id and an expiry, signed with the
// app secret. Step 2 must present it. The token cannot be forged without the
// secret, cannot be replayed after ~30 minutes, and grants exactly one power:
// adding event details to that one lead.
// ============================================================

/** Same secret source as the email-tracking redirect signer. */
function secret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "veloria-enrich-secret";
}

/**
 * Long enough for someone to finish a two-field second step, short enough that
 * a token found later in a log is useless.
 */
const TTL_MS = 30 * 60 * 1000;

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 32);
}

/** Mint a token authorising enrichment of exactly this lead. */
export function mintEnrichToken(leadId: string, now = Date.now()): string {
  const exp = now + TTL_MS;
  const payload = `${leadId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Verify a token and return the lead id it authorises, or null.
 *
 * Returns null for every failure mode rather than throwing or distinguishing
 * between them — a public endpoint should not tell an attacker whether a token
 * was malformed, expired, or merely wrongly signed.
 */
export function readEnrichToken(token: unknown, now = Date.now()): string | null {
  if (typeof token !== "string" || token.length > 200) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [leadId, expRaw, sig] = parts;
  if (!leadId || !/^\d+$/.test(expRaw)) return null;

  const expected = sign(`${leadId}.${expRaw}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  // Constant-time compare, and only after the lengths match — timingSafeEqual
  // throws on a length mismatch, which would itself leak information.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  // Expiry is checked AFTER the signature: an unsigned token should never be
  // able to tell you anything, including whether its expiry was plausible.
  if (Number(expRaw) < now) return null;
  return leadId;
}
