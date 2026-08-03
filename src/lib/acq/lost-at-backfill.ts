import { prisma } from "@/lib/prisma";

// ============================================================
// Backfill AcqDeal.lostAt for deals that were lost before the column existed.
//
// Without this, switching analytics from `updatedAt` to `lostAt` would make
// every historic loss disappear from the Lost figures — trading a wrong number
// for a missing one, which is not an improvement.
//
// AcqStageTransition records the real moment each deal entered LOST, so that is
// the authoritative source. Where no transition row exists (data predating the
// transition log), we fall back to updatedAt: it is the same value analytics
// was already using, so the number does not change — it just stops drifting
// when someone next edits the deal.
//
// Idempotent: only touches rows where lostAt IS NULL.
// ============================================================

export async function backfillLostAt(): Promise<{
  scanned: number;
  fromTransitionLog: number;
  fromUpdatedAt: number;
}> {
  const deals = await prisma.acqDeal.findMany({
    where: { stage: "LOST", lostAt: null, deletedAt: null },
    select: { id: true, updatedAt: true },
    take: 2000,
  });
  if (deals.length === 0) {
    return { scanned: 0, fromTransitionLog: 0, fromUpdatedAt: 0 };
  }

  // The EARLIEST transition into LOST is when it was lost. A deal reopened and
  // re-lost should keep its first loss date for historic reporting.
  const transitions = await prisma.acqStageTransition.findMany({
    where: { entity: "DEAL", entityId: { in: deals.map((d) => d.id) }, toState: "LOST" },
    select: { entityId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const lostOn = new Map<string, Date>();
  for (const t of transitions) {
    if (!lostOn.has(t.entityId)) lostOn.set(t.entityId, t.createdAt);
  }

  let fromTransitionLog = 0;
  let fromUpdatedAt = 0;
  for (const d of deals) {
    const real = lostOn.get(d.id);
    await prisma.acqDeal
      .update({
        // Re-assert the null guard so a concurrent write is never overwritten.
        where: { id: d.id, lostAt: null },
        data: { lostAt: real ?? d.updatedAt },
      })
      .then(() => {
        if (real) fromTransitionLog++;
        else fromUpdatedAt++;
      })
      .catch(() => {
        /* row changed under us — the next run picks it up */
      });
  }

  return { scanned: deals.length, fromTransitionLog, fromUpdatedAt };
}
