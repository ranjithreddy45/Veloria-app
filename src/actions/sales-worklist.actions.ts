"use server";

import { auth } from "@/../auth";
import type { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { resolveBdRange, istDateStr } from "@/lib/acq/analytics-range";

// ============================================================
// The rep's working strip — score and next actions, on the leads page.
//
// The gamification lives on eleven pages under /performance. A rep working
// their list would have to leave it to find out where they stand, so in
// practice nobody looks and the competition does nothing. A scoreboard you have
// to navigate to is a report; a scoreboard next to the work is an incentive.
//
// Every number here is also a DOOR. "3 overdue" is not a fact to feel bad
// about, it is a link to those three leads. That is the answer to "we can't
// tell which leads to follow" — you should not have to hunt for the next call,
// it should be the thing you land on.
//
// Deliberately small: today's points, this month's rank, and three counters.
// A full dashboard here would recreate the problem it is solving.
// ============================================================

/** Absolute [start, end] of the current IST day — the same day boundary the rest of the app uses. */
function istTodayWindow(): { start: Date; end: Date } {
  const today = istDateStr(new Date());
  const r = resolveBdRange("custom", today, today);
  return { start: r.start, end: r.end };
}

export async function getSalesWorkStrip() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false as const, error: "Unauthorized" };
  if (!hasPermission(session.user.role, "leads:read")) {
    return { success: false as const, error: "Insufficient permissions" };
  }

  const { start, end } = istTodayWindow();
  const now = new Date();
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  // Typed against the generated enum rather than left as string[] (not
  // assignable) or `as const` (readonly, also not assignable).
  const openStatuses: LeadStatus[] = [
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "PROPOSAL_SENT",
    "NEGOTIATION",
  ];

  const [todayPoints, monthRows, callsToday, quotesToday, overdue, untouched] =
    await Promise.all([
      prisma.velosLedger.aggregate({
        where: { userId, awardedAt: { gte: start, lte: end } },
        _sum: { points: true },
      }),
      // Rank is computed from the same ledger the leaderboard uses, rather than
      // a second definition of "score" that could disagree with /performance.
      prisma.velosLedger.groupBy({
        by: ["userId"],
        where: { period },
        _sum: { points: true },
      }),
      prisma.crmNote.count({
        where: { authorId: userId, kind: "CALL", createdAt: { gte: start, lte: end } },
      }),
      prisma.salesQuotation.count({
        where: { sentById: userId, sentAt: { gte: start, lte: end } },
      }),
      // Follow-ups whose date has passed and that are still open.
      prisma.lead.count({
        where: {
          deletedAt: null,
          assignedToId: userId,
          status: { in: openStatuses },
          followUpDate: { not: null, lt: now },
        },
      }),
      // Assigned to me and never engaged at all. Distinct from "overdue": these
      // never even started, which is the worse of the two.
      prisma.lead.count({
        where: {
          deletedAt: null,
          assignedToId: userId,
          status: { in: openStatuses },
          lastTouchedAt: null,
        },
      }),
    ]);

  const ranked = monthRows
    .map((r) => ({ userId: r.userId, points: r._sum.points ?? 0 }))
    .sort((a, b) => b.points - a.points);
  const idx = ranked.findIndex((r) => r.userId === userId);

  return {
    success: true as const,
    data: {
      todayPoints: todayPoints._sum.points ?? 0,
      monthPoints: idx >= 0 ? ranked[idx].points : 0,
      // null rather than a made-up position when this person has no ledger rows
      // yet — "unranked" is true, "last place" is a guess.
      rank: idx >= 0 ? idx + 1 : null,
      teamSize: ranked.length,
      callsToday,
      quotesToday,
      overdue,
      untouched,
    },
  };
}
