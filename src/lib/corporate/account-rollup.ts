// ============================================================
// Corporate account rollups — recompute denormalised account metrics from
// Booking history and re-derive the farming tier + quarterly re-engage anchor.
//
// Plain library (NOT "use server", no auth): import-only by the
// /api/cron/account-farming route. Mirrors the customer-360 cron groupBy
// pattern but rolls up at the CorporateAccount level (keyed by contactId).
//
// Best-effort: never throws — a single bad account is logged and skipped so
// the daily lane records partial success rather than a lane failure.
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { CorporateAccountTier } from "@prisma/client";

// Bookings that count toward lifetime value / past-event history.
const ACTIVE_STATUSES = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] as const;
// Upcoming pipeline (a future date that is held or progressing).
const UPCOMING_STATUSES = ["HOLD", "CONFIRMED", "IN_PROGRESS"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const QUARTER_MS = 90 * DAY_MS;
// Recency thresholds (heuristic). Recompute is a destructive overwrite each run.
const DORMANT_AFTER_MS = 2 * QUARTER_MS; // no event for >2 quarters → DORMANT
const CHURNED_AFTER_MS = 4 * QUARTER_MS; // no event for >4 quarters → CHURNED
const KEY_MIN_EVENTS = 3; // 3+ past events → KEY (anchor of the commitment offer)

export interface RollupResult {
  updated: number;
}

/** UTC midnight today — Booking.date is @db.Date so compare at day granularity. */
function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Re-derive the farming tier from recency + volume. Cron-owned (like
 * customer-360 customerType): a manual tier override would be clobbered here —
 * tier is intentionally automation-driven.
 */
function deriveTier(args: {
  pastEventCount: number;
  upcomingEventCount: number;
  lastEventDate: Date | null;
  now: number;
}): CorporateAccountTier {
  const { pastEventCount, upcomingEventCount, lastEventDate, now } = args;

  // Never transacted and nothing upcoming → still a PROSPECT.
  if (pastEventCount === 0 && upcomingEventCount === 0) return "PROSPECT";

  const ageMs = lastEventDate ? now - lastEventDate.getTime() : Infinity;

  // A future booking keeps the account warm regardless of last-event recency.
  if (upcomingEventCount > 0) {
    return pastEventCount >= KEY_MIN_EVENTS ? "KEY" : "ACTIVE";
  }

  if (ageMs > CHURNED_AFTER_MS) return "CHURNED";
  if (ageMs > DORMANT_AFTER_MS) return "DORMANT";
  if (pastEventCount >= KEY_MIN_EVENTS) return "KEY";
  return "ACTIVE";
}

/**
 * Refresh every CorporateAccount's rollups + tier + nextReengageAt.
 *
 * Past/upcoming counts and lifetime revenue are computed from Booking grouped
 * by contactId in two batched queries (no N+1), then applied per account.
 *
 * nextReengageAt:
 *   - active accounts → lastEventDate + 1 quarter
 *   - prospects (no event) → createdAt + 1 quarter
 * CHURNED accounts are not re-anchored forward (the re-engage enqueue also
 * excludes CHURNED), but their tier/rollups still refresh.
 */
export async function refreshCorporateAccountRollups(): Promise<RollupResult> {
  const result: RollupResult = { updated: 0 };
  const now = Date.now();
  const today = startOfTodayUtc();

  try {
    const accounts = await prisma.corporateAccount.findMany({
      select: { id: true, contactId: true, tier: true, createdAt: true },
    });
    if (accounts.length === 0) return result;

    const contactIds = Array.from(new Set(accounts.map((a) => a.contactId)));

    // Past (active history, date < today) — counts, revenue, last event date.
    const pastGrouped = await prisma.booking.groupBy({
      by: ["contactId"],
      where: {
        contactId: { in: contactIds },
        status: { in: [...ACTIVE_STATUSES] },
        date: { lt: today },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
      _max: { date: true },
    });

    // Lifetime revenue across all active bookings (past + future confirmed).
    const lifetimeGrouped = await prisma.booking.groupBy({
      by: ["contactId"],
      where: {
        contactId: { in: contactIds },
        status: { in: [...ACTIVE_STATUSES] },
      },
      _sum: { totalAmount: true },
    });

    // Upcoming (date >= today, held/progressing).
    const upcomingGrouped = await prisma.booking.groupBy({
      by: ["contactId"],
      where: {
        contactId: { in: contactIds },
        status: { in: [...UPCOMING_STATUSES] },
        date: { gte: today },
      },
      _count: { _all: true },
    });

    const pastBy = new Map(pastGrouped.map((g) => [g.contactId, g]));
    const lifetimeBy = new Map(lifetimeGrouped.map((g) => [g.contactId, g]));
    const upcomingBy = new Map(upcomingGrouped.map((g) => [g.contactId, g]));

    for (const acct of accounts) {
      try {
        const past = pastBy.get(acct.contactId);
        const lifetime = lifetimeBy.get(acct.contactId);
        const upcoming = upcomingBy.get(acct.contactId);

        const pastEventCount = past?._count._all ?? 0;
        const upcomingEventCount = upcoming?._count._all ?? 0;
        const lastEventDate = past?._max.date ?? null;
        const lifetimeRevenue = new Prisma.Decimal(
          (lifetime?._sum.totalAmount ?? 0).toString()
        );

        const tier = deriveTier({
          pastEventCount,
          upcomingEventCount,
          lastEventDate,
          now,
        });

        // Quarterly re-engage anchor (not advanced for churned accounts).
        let nextReengageAt: Date | null = null;
        if (tier !== "CHURNED") {
          const anchor = lastEventDate ?? acct.createdAt;
          nextReengageAt = new Date(anchor.getTime() + QUARTER_MS);
        }

        await prisma.corporateAccount.update({
          where: { id: acct.id },
          data: {
            pastEventCount,
            upcomingEventCount,
            lifetimeRevenue,
            lastEventDate,
            tier,
            nextReengageAt,
          },
        });
        result.updated++;
      } catch (e) {
        console.error("[refreshCorporateAccountRollups] account error:", acct.id, e);
      }
    }
  } catch (e) {
    console.error("[refreshCorporateAccountRollups] error:", e);
  }

  return result;
}
