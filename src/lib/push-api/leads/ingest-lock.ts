import { createHash, randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// ============================================================
// Per-person locks for lead ingestion.
//
// Two pushes about the same new person arriving together each looked for an
// existing lead, found none, and each created one (5 simultaneous pushes made
// 3 leads). The contact table has no enforced unique key to stop it, so the
// guard is here: a push takes a lock on every identity it carries — the phone
// number, the email and the external id — and holds it until it has decided
// and written.
//
// It is a LEASE in a table rather than a Postgres advisory lock held in a
// transaction, because ingestion runs its queries on other pooled connections;
// holding one idle connection per waiting request is how a burst would drain
// the pool. A holder that crashes loses nothing: its lease just runs out.
//
// Time is always read and written in SQL as `now() AT TIME ZONE 'UTC'`: the
// production session time zone is America/New_York, and a bare timestamptz
// compared with this timestamp column would be shifted.
// ============================================================

const LEASE_SECONDS = 30;
const WAIT_MS = 20_000;

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

async function tryAcquire(lockKey: string, token: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ token: string }[]>`
    INSERT INTO "PushIngestLock" ("lockKey", "token", "lockedUntil")
    VALUES (${lockKey}, ${token}, (now() AT TIME ZONE 'UTC') + make_interval(secs => ${LEASE_SECONDS}))
    ON CONFLICT ("lockKey") DO UPDATE
      SET "token" = EXCLUDED."token", "lockedUntil" = EXCLUDED."lockedUntil"
      WHERE "PushIngestLock"."lockedUntil" < (now() AT TIME ZONE 'UTC')
    RETURNING "token"`;
  return rows.length === 1 && rows[0]!.token === token;
}

async function release(lockKey: string, token: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM "PushIngestLock" WHERE "lockKey" = ${lockKey} AND "token" = ${token}`;
}

/**
 * Run `work` while holding a lock on every key. Keys are taken in sorted order,
 * so two requests sharing several keys can never wait on each other in a cycle.
 */
export async function withIngestLocks<T>(keys: string[], work: () => Promise<T>): Promise<T> {
  const lockKeys = [...new Set(keys.map(hashKey))].sort();
  const token = randomUUID();
  const held: string[] = [];
  const deadline = Date.now() + WAIT_MS;
  try {
    for (const lockKey of lockKeys) {
      let delay = 20;
      while (!(await tryAcquire(lockKey, token))) {
        if (Date.now() > deadline) {
          throw new Error("push ingest: timed out waiting for a lock held by a concurrent request");
        }
        await new Promise((r) => setTimeout(r, delay + Math.floor(Math.random() * delay)));
        delay = Math.min(delay * 2, 250);
      }
      held.push(lockKey);
    }
    return await work();
  } finally {
    await Promise.all(held.map((k) => release(k, token).catch(() => {})));
  }
}

/** The identities a push carries, as lock keys. */
export function identityLockKeys(args: {
  lineageId: string;
  source: string;
  externalId?: string;
  phone?: string;
  email?: string;
}): string[] {
  const keys: string[] = [];
  if (args.externalId) keys.push(`ext:${args.lineageId}:${args.source}:${args.externalId}`);
  if (args.phone) keys.push(`phone:${args.phone}`);
  if (args.email) keys.push(`email:${args.email.toLowerCase()}`);
  return keys;
}
