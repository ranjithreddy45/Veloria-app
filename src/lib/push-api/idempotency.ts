import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PushApiError } from "./errors";

// ============================================================
// Idempotency-Key handling.
//
// The first request with a key claims it (state PROCESSING). A retry of the
// same key with the same body gets the stored response replayed verbatim; with
// a different body it is refused, because silently returning the first result
// for a changed request would hide a real client bug. A key whose first request
// failed with a server error is released so the retry can actually run.
// ============================================================

const KEY_PATTERN = /^[\x21-\x7e]{1,255}$/;

export function validIdempotencyKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

/** Stable JSON: object keys sorted at every depth, so key order can't change the hash. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`);
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
  key: string;
  hash: string;
  ttlSeconds: number;
  now?: Date;
}): Promise<IdempotencyClaim> {
  const { apiKeyId, key, hash, ttlSeconds } = args;
  const now = args.now ?? new Date();
  if (!validIdempotencyKey(key)) {
    throw new PushApiError(
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency-Key must be 1–255 printable ASCII characters with no spaces."
    );
  }

  // Two passes at most: the second only happens after clearing an expired record.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const record = await prisma.pushIdempotencyRecord.create({
        data: {
          apiKeyId,
          idempotencyKey: key,
          requestHash: hash,
          expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
        },
        select: { id: true },
      });
      return { kind: "claimed", recordId: record.id };
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }

    const existing = await prisma.pushIdempotencyRecord.findUnique({
      where: { apiKeyId_idempotencyKey: { apiKeyId, idempotencyKey: key } },
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
    if (existing.state !== "COMPLETED" || existing.responseStatus == null) {
      throw new PushApiError(
        "IDEMPOTENCY_KEY_IN_PROGRESS",
        "A request with this Idempotency-Key is still being processed. Retry shortly.",
        undefined,
        { "Retry-After": "2" }
      );
    }
    return { kind: "replay", status: existing.responseStatus, body: existing.responseBody };
  }
  throw new PushApiError("IDEMPOTENCY_KEY_IN_PROGRESS", "Could not claim the Idempotency-Key. Retry shortly.", undefined, {
    "Retry-After": "2",
  });
}

export async function completeIdempotencyKey(
  recordId: string,
  result: { status: number; body: unknown; resourceType?: string; resourceId?: string }
): Promise<void> {
  await prisma.pushIdempotencyRecord.update({
    where: { id: recordId },
    data: {
      state: "COMPLETED",
      responseStatus: result.status,
      responseBody: result.body as Prisma.InputJsonValue,
      resourceType: result.resourceType ?? null,
      resourceId: result.resourceId ?? null,
    },
  });
}

/** Forget a claim whose request failed, so a retry is processed rather than refused. */
export async function releaseIdempotencyKey(recordId: string): Promise<void> {
  await prisma.pushIdempotencyRecord.deleteMany({ where: { id: recordId } });
}
