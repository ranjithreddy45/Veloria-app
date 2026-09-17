import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PushApiError } from "./errors";

// ============================================================
// Idempotency-Key handling.
//
// The first request with a key claims it: state PROCESSING, with a lease. A
// retry of the same key with the same request gets the stored result rebuilt
// as a 200; with a different request it is refused, because silently returning
// the first result for a changed request would hide a real client bug.
//
// A claim is released if its request fails server-side, so the retry runs. If
// the process dies mid-request (a deploy, a crash) nothing can release it, so
// the claim also carries a lease: once the lease has passed, a retry takes the
// claim over instead of being told "in progress" until the key expires.
//
// Keys are scoped to the INTEGRATION (the key's rotation lineage), not the
// individual key, so a retry sent with the replacement key after a rotation
// still replays instead of creating the lead a second time.
// ============================================================

const KEY_PATTERN = /^[\x21-\x7e]{1,255}$/;
const MAX_CANONICAL_DEPTH = 32;

export function validIdempotencyKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

/** Stable JSON: object keys sorted at every depth, so key order can't change the hash. */
export function canonicalJson(value: unknown, depth = 0): string {
  if (depth > MAX_CANONICAL_DEPTH) {
    // Callers hash VALIDATED input, which is far shallower; this only stops an
    // unexpected shape from recursing until the stack overflows.
    throw new PushApiError("VALIDATION_ERROR", "Invalid request", { body: "Nested too deeply" });
  }
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v, depth + 1)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const entries = Object.keys(obj)
    .sort()
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k], depth + 1)}`);
  return `{${entries.join(",")}}`;
}

export function requestHash(body: unknown): string {
  return createHash("sha256").update(canonicalJson(body)).digest("hex");
}

export type IdempotencyClaim =
  | { kind: "claimed"; recordId: string }
  | { kind: "replay"; status: number; body: unknown };

export async function claimIdempotencyKey(args: {
  apiKeyId: string;
  lineageId: string;
  key: string;
  hash: string;
  ttlSeconds: number;
  leaseSeconds: number;
  now?: Date;
}): Promise<IdempotencyClaim> {
  const { apiKeyId, lineageId, key, hash, ttlSeconds, leaseSeconds } = args;
  const now = args.now ?? new Date();
  if (!validIdempotencyKey(key)) {
    throw new PushApiError(
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency-Key must be 1–255 printable ASCII characters with no spaces."
    );
  }
  const lockedUntil = () => new Date(now.getTime() + leaseSeconds * 1000);

  // A few passes at most: each retry follows a record being cleared or taken over.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const record = await prisma.pushIdempotencyRecord.create({
        data: {
          apiKeyId,
          lineageId,
          idempotencyKey: key,
          requestHash: hash,
          lockedUntil: lockedUntil(),
          expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
        },
        select: { id: true },
      });
      return { kind: "claimed", recordId: record.id };
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }

    const existing = await prisma.pushIdempotencyRecord.findUnique({
      where: { lineageId_idempotencyKey: { lineageId, idempotencyKey: key } },
    });
    if (!existing) continue; // released between our insert and our read — try again

    if (existing.expiresAt.getTime() <= now.getTime()) {
      await prisma.pushIdempotencyRecord.deleteMany({ where: { id: existing.id } });
      continue;
    }
    if (existing.requestHash !== hash) {
      throw new PushApiError(
        "IDEMPOTENCY_KEY_REUSED",
        "This Idempotency-Key was already used with a different request body."
      );
    }
    if (existing.state === "COMPLETED" && existing.responseStatus != null) {
      return { kind: "replay", status: existing.responseStatus, body: existing.responseBody };
    }

    // PROCESSING. If its lease has run out, the request that claimed it is gone:
    // take the claim over. The conditional update makes the takeover atomic, so
    // two retries racing for an abandoned claim can't both win.
    const leaseExpired = !existing.lockedUntil || existing.lockedUntil.getTime() <= now.getTime();
    if (leaseExpired) {
      const taken = await prisma.pushIdempotencyRecord.updateMany({
        where: {
          id: existing.id,
          state: "PROCESSING",
          OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
        },
        data: { apiKeyId, lockedUntil: lockedUntil() },
      });
      if (taken.count === 1) return { kind: "claimed", recordId: existing.id };
      continue; // someone else took it over or completed it — look again
    }

    const retryAfter = Math.max(1, Math.ceil((existing.lockedUntil!.getTime() - now.getTime()) / 1000));
    throw new PushApiError(
      "IDEMPOTENCY_KEY_IN_PROGRESS",
      "A request with this Idempotency-Key is still being processed. Retry shortly.",
      undefined,
      { "Retry-After": String(Math.min(retryAfter, 5)) }
    );
  }
  throw new PushApiError(
    "IDEMPOTENCY_KEY_IN_PROGRESS",
    "Could not claim the Idempotency-Key. Retry shortly.",
    undefined,
    { "Retry-After": "2" }
  );
}

export async function completeIdempotencyKey(
  recordId: string,
  result: { status: number; body: unknown; resourceType?: string; resourceId?: string }
): Promise<void> {
  await prisma.pushIdempotencyRecord.update({
    where: { id: recordId },
    data: {
      state: "COMPLETED",
      lockedUntil: null,
      responseStatus: result.status,
      responseBody: result.body as Prisma.InputJsonValue,
      resourceType: result.resourceType ?? null,
      resourceId: result.resourceId ?? null,
    },
  });
}

/** Forget a claim whose request failed, so a retry is processed rather than refused. */
export async function releaseIdempotencyKey(recordId: string): Promise<void> {
  await prisma.pushIdempotencyRecord.deleteMany({ where: { id: recordId, state: "PROCESSING" } });
}
