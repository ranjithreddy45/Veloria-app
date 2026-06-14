// ============================================================
// KRA auto-metrics — best-effort computation of the AUTO KPIs from existing
// CRM data, per employee per "YYYY-MM". Resilient: any sub-query failure
// degrades that one metric to null (UI shows "auto-metric unavailable") rather
// than throwing. Manual KPIs are NOT computed here.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { KraRole } from "./templates";

export type AutoMetrics = Record<string, number | null>;

function monthRange(period: string): { start: Date; end: Date } {
  const [y, m] = period.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

// Bookings considered "confirmed" (signed + advance) and beyond.
const CONFIRMED_BOOKING = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] as const;

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

export async function resolveAutoMetrics(employeeId: string, role: KraRole, period: string): Promise<AutoMetrics> {
  const { start, end } = monthRange(period);
  const inMonth = { gte: start, lt: end };
  const m: AutoMetrics = {};

  if (role === "CORPORATE_SALES" || role === "INSIDE_SALES") {
    // Revenue + booking count + avg ticket from bookings this rep confirmed.
    const agg = await safe(
      () => prisma.booking.aggregate({
        where: { createdById: employeeId, status: { in: CONFIRMED_BOOKING as unknown as never }, createdAt: inMonth },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      null as null | { _sum: { totalAmount: unknown }; _count: { _all: number } },
    );
    const revenue = agg?._sum.totalAmount != null ? Number(agg._sum.totalAmount) : 0;
    const count = agg?._count._all ?? 0;
    m.revenue = revenue;
    m.bookings_count = count;
    m.avg_ticket = count > 0 ? Math.round(revenue / count) : 0;

    // Outbound calls + meetings (Communication log).
    m.outbound_calls = await safe(() => prisma.communication.count({ where: { createdById: employeeId, type: "CALL", direction: "OUTBOUND", createdAt: inMonth } }), null);
    m.meetings = await safe(() => prisma.communication.count({ where: { createdById: employeeId, type: "MEETING", createdAt: inMonth } }), null);

    // Open pipeline value (deals assigned to rep, not in a won/lost stage).
    const pipe = await safe(
      () => prisma.deal.aggregate({ where: { assignedToId: employeeId, stage: { isWonStage: false, isLostStage: false } }, _sum: { value: true } }),
      null as null | { _sum: { value: unknown } },
    );
    m.pipeline_value = pipe?._sum.value != null ? Number(pipe._sum.value) : 0;

    // New accounts opened ≈ leads this rep created this month.
    m.new_accounts = await safe(() => prisma.lead.count({ where: { createdById: employeeId, createdAt: inMonth } }), null);

    // Proposal conversion = quotations that became bookings / quotations sent.
    const sent = await safe(() => prisma.salesQuotation.count({ where: { createdById: employeeId, sentAt: inMonth } }), null);
    const converted = await safe(() => prisma.salesQuotation.count({ where: { createdById: employeeId, sentAt: inMonth, OR: [{ status: "APPROVED" }, { bookingId: { not: null } }] } }), null);
    m.proposal_conversion = sent && sent > 0 ? Math.min(100, Math.round(((converted ?? 0) / sent) * 100)) : 0;

    if (role === "INSIDE_SALES") {
      // First-response SLA: of leads this rep owns that arrived this month and
      // were responded to, how many beat their first-contact deadline.
      const leads = await safe(
        () => prisma.lead.findMany({
          where: { assignedToId: employeeId, createdAt: inMonth },
          select: { firstRespondedAt: true, firstContactDue: true },
        }),
        [] as { firstRespondedAt: Date | null; firstContactDue: Date | null }[],
      );
      const responded = leads.filter((l) => l.firstRespondedAt);
      const onTime = responded.filter((l) => l.firstContactDue && l.firstRespondedAt! <= l.firstContactDue);
      m.first_response_sla_pct = responded.length > 0 ? Math.round((onTime.length / responded.length) * 100) : 0;
    }
  }

  if (role === "BDM") {
    // Signings = deals this BDM moved to WON this month.
    m.bdm_signings = await safe(() => prisma.acqDeal.count({ where: { bdExecutiveId: employeeId, stage: "WON", wonAt: inMonth, deletedAt: null } }), null);
    // Owner outreach calls + site visits from the acq activity log.
    m.bdm_owner_calls = await safe(() => prisma.acqLeadActivity.count({ where: { actorId: employeeId, channel: "CALL", createdAt: inMonth } }), null);
    m.bdm_site_visits = await safe(() => prisma.acqLeadActivity.count({ where: { actorId: employeeId, channel: "VISIT", createdAt: inMonth } }), null);
    // Qualified pipeline carried into next month (mid-funnel stages, open now).
    m.bdm_qualified_pipeline = await safe(
      () => prisma.acqDeal.count({ where: { bdExecutiveId: employeeId, stage: { in: ["EVALUATION", "EVALUATION_COMPLETED", "PROPOSAL_SENT", "NEGOTIATION", "CONTRACT_SENT"] as unknown as never }, deletedAt: null } }),
      null,
    );
  }

  return m;
}
