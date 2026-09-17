import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ============================================================
// Write a provider call exactly once.
//
// CallLog.externalCallId has no unique index (adding one to this populated
// table is a destructive migration), and the same CallVibe call can reach us
// by push (/api/v1/push/call-activity) and by the hourly import at the same
// moment. So the check and the insert run in one short transaction holding a
// Postgres advisory lock on the external id: whichever writer comes second
// waits, sees the row, and writes nothing.
// ============================================================

export type Tx = Prisma.TransactionClient;

/**
 * Run `insert` unless a CallLog with this external id already exists.
 * Returns the existing row's ids, or the result of `insert`.
 */
export async function insertCallOnce<T>(
  externalCallId: string,
  insert: (tx: Tx) => Promise<T>
): Promise<{ inserted: true; value: T } | { inserted: false; existing: { communicationId: string; contactId: string } }> {
  return prisma.$transaction(
    async (tx) => {
      // "SELECT 1 FROM": Prisma cannot deserialize the void the lock function returns.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`calllog:${externalCallId}`}, 0))`;
      const existing = await tx.callLog.findFirst({
        where: { externalCallId },
        select: { communicationId: true, contactId: true },
      });
      if (existing) return { inserted: false as const, existing };
      return { inserted: true as const, value: await insert(tx) };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000, maxWait: 10_000 }
  );
}
