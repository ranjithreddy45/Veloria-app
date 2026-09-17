import { createHash, randomBytes } from "crypto";

// ============================================================
// API key material and the pure rules for whether a stored key may be used.
//
// Keys are 256 bits of randomness. At that entropy an unsalted SHA-256 is the
// right storage (the same scheme GitHub uses for tokens): nothing can be
// brute-forced, and a pepper would only add a secret whose loss locks every
// integration out. It is also the scheme every existing key already uses, so
// one lookup serves old and new keys alike.
// ============================================================

export const PUSH_SCOPES = ["leads:create"] as const;
export type PushScope = (typeof PUSH_SCOPES)[number];
/** Scopes reserved for endpoints that don't exist yet; accepted on keys so they can be issued ahead of time. */
export const FUTURE_SCOPES = ["leads:update", "leads:read", "bookings:create"] as const;
export const KNOWN_SCOPES: readonly string[] = [...PUSH_SCOPES, ...FUTURE_SCOPES];

export const PUSH_KEY_PREFIX = "vg_live_";
const PREFIX_DISPLAY_LENGTH = 16;

export function generatePushKey(): { raw: string; hash: string; prefix: string } {
  const raw = `${PUSH_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { raw, hash: hashApiKey(raw), prefix: raw.slice(0, PREFIX_DISPLAY_LENGTH) };
}

/** A push key is exactly vg_live_ + 43 base64url characters (32 random bytes). */
const PUSH_KEY_SHAPE = /^vg_live_[A-Za-z0-9_-]{43}$/;

/**
 * Cheap shape check before touching the database. Anything that isn't shaped
 * like a push key can't be one, so it is refused without a lookup — which is
 * what keeps a flood of junk credentials from becoming a flood of queries.
 */
export function looksLikePushKey(raw: string): boolean {
  return PUSH_KEY_SHAPE.test(raw);
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** "Bearer <key>" → key. Anything else → null. */
export function bearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
  return m ? m[1]! : null;
}

export interface StoredKeyState {
  isActive: boolean;
  revokedAt: Date | null;
  expiresAt: Date | null;
  scopes: string[];
}

export type KeyDecision =
  | { ok: true }
  | { ok: false; code: "API_KEY_REVOKED" | "API_KEY_EXPIRED" | "INSUFFICIENT_SCOPE"; message: string };

/**
 * Whether a key that exists may be used for `scope` at `now`.
 * Revocation is checked before expiry so a revoked key always says revoked.
 */
export function evaluateKey(key: StoredKeyState, scope: PushScope, now: Date = new Date()): KeyDecision {
  if (!key.isActive || key.revokedAt) {
    return { ok: false, code: "API_KEY_REVOKED", message: "This API key has been revoked." };
  }
  if (key.expiresAt && key.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, code: "API_KEY_EXPIRED", message: "This API key has expired." };
  }
  if (!key.scopes.includes(scope)) {
    return { ok: false, code: "INSUFFICIENT_SCOPE", message: `This API key is not allowed to use ${scope}.` };
  }
  return { ok: true };
}
