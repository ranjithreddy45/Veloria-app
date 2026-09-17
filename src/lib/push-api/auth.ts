import { prisma } from "@/lib/prisma";
import { PushApiError } from "./errors";
import { bearerToken, evaluateKey, hashApiKey, looksLikePushKey, type PushScope } from "./keys";

// ============================================================
// Authenticate a push request: "Authorization: Bearer <key>" → the ApiKey row.
//
// 401 means "we don't know who you are" (no key, or a key we never issued).
// 403 means "we know exactly who you are and the answer is no" (revoked,
// expired, or not granted this scope). The distinction tells an integrator
// whether to fix their configuration or call us.
// ============================================================

export interface AuthenticatedKey {
  id: string;
  prefix: string;
  name: string;
  source: string | null;
  scopes: string[];
  /** The integration this key belongs to (the first key of its rotation chain). */
  lineageId: string;
}

/** Don't write lastUsedAt on every request — once a minute is plenty for "is this key still in use?". */
const LAST_USED_WRITE_INTERVAL_MS = 60_000;

export async function authenticatePushRequest(headers: Headers, scope: PushScope): Promise<AuthenticatedKey> {
  const raw = bearerToken(headers.get("authorization"));
  if (!raw) {
    throw new PushApiError("UNAUTHORIZED", "Missing API key. Send it as: Authorization: Bearer <API_KEY>.");
  }
  // Not shaped like a push key → can't be one. Refuse without a database lookup.
  if (!looksLikePushKey(raw)) throw new PushApiError("UNAUTHORIZED", "Invalid API key.");

  const key = await prisma.apiKey.findFirst({
    where: { keyHash: hashApiKey(raw) },
    select: {
      id: true,
      name: true,
      prefix: true,
      source: true,
      scopes: true,
      isActive: true,
      revokedAt: true,
      expiresAt: true,
      lastUsedAt: true,
      lineageId: true,
    },
  });
  if (!key) throw new PushApiError("UNAUTHORIZED", "Invalid API key.");

  const decision = evaluateKey(key, scope);
  if (!decision.ok) throw new PushApiError(decision.code, decision.message);

  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS) {
    // Best-effort bookkeeping: a failed write must not fail the push.
    await prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }

  return {
    id: key.id,
    prefix: key.prefix,
    name: key.name,
    source: key.source,
    scopes: key.scopes,
    lineageId: key.lineageId ?? key.id,
  };
}

/**
 * When a key was issued for a particular source, it may only push that source.
 * Otherwise one integration could file leads under another's name, fake paid
 * attribution, or reach into another integration's external ids.
 */
export function assertSourceAllowed(key: AuthenticatedKey, source: string): void {
  if (key.source && key.source !== source) {
    throw new PushApiError(
      "SOURCE_NOT_ALLOWED",
      `This API key may only push source "${key.source}".`
    );
  }
}
