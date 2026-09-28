// ============================================================
// How often the safety-net poll actually runs.
// ------------------------------------------------------------
// The webhook is the real-time path. This poll only exists to catch what the
// webhook missed, so it runs on the 5-minute lane but does real work at most
// every 15 minutes — polling every 5 would spend three Graph calls to find
// nothing, three hundred times a day.
//
// The clock lives in CronRunLog rather than in memory, because there are four
// workers and a restart would otherwise reset it.
// ============================================================

import { prisma } from "@/lib/prisma";

import { runMetaBackfill, type BackfillSummary } from "./backfill";

export const BACKFILL_LANE = "meta-backfill";
const MIN_GAP_MS = 15 * 60 * 1000;

export async function maybeRunMetaBackfill(
  options?: { force?: boolean; hours?: number }
): Promise<BackfillSummary | { skipped: true; nextDueInMinutes: number }> {
  if (!options?.force) {
    const last = await prisma.cronRunLog
      .findFirst({ where: { lane: BACKFILL_LANE }, orderBy: { createdAt: "desc" }, select: { createdAt: true } })
      .catch(() => null);
    if (last) {
      const elapsed = Date.now() - last.createdAt.getTime();
      if (elapsed < MIN_GAP_MS) {
        return { skipped: true, nextDueInMinutes: Math.ceil((MIN_GAP_MS - elapsed) / 60000) };
      }
    }
  }

  const started = Date.now();
  const summary = await runMetaBackfill({ hours: options?.hours ?? 72 });

  await prisma.cronRunLog
    .create({
      data: {
        lane: BACKFILL_LANE,
        status: summary.ok ? (summary.errors > 0 ? "PARTIAL" : "SUCCESS") : "FAILURE",
        total: summary.seen,
        failed: summary.errors,
        durationMs: Date.now() - started,
        results: {
          forms: summary.forms,
          captured: summary.captured,
          duplicates: summary.duplicates,
          skipped: summary.skipped,
          note: summary.note ?? null,
        },
      },
    })
    .catch(() => undefined);

  return summary;
}
