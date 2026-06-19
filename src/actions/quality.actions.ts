"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { computeSigma, dpmoToSigma, controlLimits } from "@/lib/quality/sigma";
import { CTQ_CATALOG } from "@/lib/quality/metrics";

// ============================================================
// Shared contract types
// ============================================================

export interface CtqResult {
  id: string;
  label: string;
  domain: string;
  units: number;
  defects: number;
  defectRatePct: number;
  dpmo: number;
  sigma: number;
  trendSigma: number;
}

export interface QualityScorecard {
  period: string;
  overallSigma: number;
  ctqs: CtqResult[];
}

export interface ParetoRow {
  category: string;
  count: number;
  cumulativePct: number;
}

export interface ControlSeries {
  points: { label: string; value: number }[];
  mean: number;
  ucl: number;
  lcl: number;
}

// ============================================================
// Auth gate — SUPER_ADMIN/ADMIN OR hasPermission(role,"quality:read")
// ============================================================

async function authorize(): Promise<boolean> {
  try {
    const session = await auth();
    const role = session?.user?.role as string | undefined;
    if (!role) return false;
    if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
    return hasPermission(role, "quality:read");
  } catch {
    return false;
  }
}

// ============================================================
// Month boundaries (UTC)
// ============================================================

interface MonthRange {
  start: Date;
  end: Date; // exclusive
  label: string;
}

function monthRange(year: number, monthIdx: number): MonthRange {
  const start = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIdx + 1, 1, 0, 0, 0, 0));
  const label = start.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return { start, end, label };
}

function currentMonthRange(now = new Date()): MonthRange {
  return monthRange(now.getUTCFullYear(), now.getUTCMonth());
}

function previousMonthRange(now = new Date()): MonthRange {
  return monthRange(now.getUTCFullYear(), now.getUTCMonth() - 1);
}

// Last N calendar months (oldest first), including the current month.
function lastNMonths(n: number, now = new Date()): MonthRange[] {
  const ranges: MonthRange[] = [];
  for (let i = n - 1; i >= 0; i--) {
    ranges.push(monthRange(now.getUTCFullYear(), now.getUTCMonth() - i));
  }
  return ranges;
}

// ============================================================
// Per-CTQ count queries (units + defects) for an arbitrary range
// Returns { units, defects } using exact field-map where-clauses.
// `now` is the reference "current time" for overdue comparisons.
// ============================================================

async function countCtq(
  ctqId: string,
  range: MonthRange,
  now: Date
): Promise<{ units: number; defects: number }> {
  const { start, end } = range;

  switch (ctqId) {
    case "lead-sla": {
      const base = {
        deletedAt: null,
        firstContactDue: { gte: start, lt: end },
      };
      const [units, defects] = await Promise.all([
        prisma.lead.count({ where: base }),
        prisma.lead.count({
          where: {
            ...base,
            OR: [
              { firstRespondedAt: null, firstContactDue: { lt: now } },
              { firstRespondedAt: { gt: prisma.lead.fields.firstContactDue } },
            ],
          },
        }),
      ]);
      return { units, defects };
    }

    case "payment-punctuality": {
      const issuedStatuses = ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"] as const;
      const base = {
        status: { in: issuedStatuses as unknown as string[] },
        dueDate: { gte: start, lt: end },
      } as Record<string, unknown>;
      const [units, defects] = await Promise.all([
        prisma.invoice.count({ where: base as never }),
        prisma.invoice.count({
          where: {
            ...base,
            OR: [
              { status: "OVERDUE" },
              {
                AND: [
                  { status: { not: "PAID" } },
                  { dueDate: { lt: now } },
                  { balanceDue: { gt: 0 } },
                ],
              },
            ],
          } as never,
        }),
      ]);
      return { units, defects };
    }

    case "task-on-time": {
      const base = { dueDate: { gte: start, lt: end } };
      const [units, defects] = await Promise.all([
        prisma.task.count({ where: base }),
        prisma.task.count({
          where: {
            ...base,
            OR: [
              { status: { not: "DONE" }, dueDate: { lt: now } },
              { completedAt: { gt: prisma.task.fields.dueDate } },
            ],
          },
        }),
      ]);
      return { units, defects };
    }

    case "support-sla": {
      const base = { createdAt: { gte: start, lt: end } };
      const [units, defects] = await Promise.all([
        prisma.supportTicket.count({ where: base }),
        prisma.supportTicket.count({
          where: { ...base, slaEscalatedAt: { not: null } },
        }),
      ]);
      return { units, defects };
    }

    case "handover-snag": {
      const base = { createdAt: { gte: start, lt: end } };
      const [units, defects] = await Promise.all([
        prisma.projectSnag.count({ where: base }),
        prisma.projectSnag.count({
          where: {
            ...base,
            OR: [
              { status: "REOPENED" },
              {
                AND: [
                  { status: { not: "VERIFIED_CLOSED" } },
                  { dueDate: { not: null, lt: now } },
                ],
              },
              {
                AND: [
                  { severity: "CRITICAL" },
                  { status: { not: "VERIFIED_CLOSED" } },
                ],
              },
            ],
          },
        }),
      ]);
      return { units, defects };
    }

    case "cx-rating": {
      const base = { createdAt: { gte: start, lt: end } };
      const [units, defects] = await Promise.all([
        prisma.review.count({ where: base }),
        prisma.review.count({ where: { ...base, rating: { lt: 4 } } }),
      ]);
      return { units, defects };
    }

    default:
      return { units: 0, defects: 0 };
  }
}

function sigmaFor(units: number, defects: number): number {
  if (units <= 0) return 0;
  const { dpmo } = computeSigma(defects, units);
  return dpmoToSigma(dpmo);
}

// ============================================================
// getQualityScorecard
// ============================================================

export async function getQualityScorecard(): Promise<QualityScorecard> {
  const now = new Date();
  const current = currentMonthRange(now);
  const empty: QualityScorecard = {
    period: current.label,
    overallSigma: 0,
    ctqs: [],
  };

  try {
    if (!(await authorize())) return empty;

    const previous = previousMonthRange(now);

    const ctqs: CtqResult[] = await Promise.all(
      CTQ_CATALOG.map(async (ctq) => {
        try {
          const [cur, prev] = await Promise.all([
            countCtq(ctq.id, current, now),
            countCtq(ctq.id, previous, now),
          ]);
          const { dpmo, defectRatePct } =
            cur.units > 0
              ? (() => {
                  const r = computeSigma(cur.defects, cur.units);
                  return { dpmo: r.dpmo, defectRatePct: 100 - r.yieldPct };
                })()
              : { dpmo: 0, defectRatePct: 0 };
          const sigma = sigmaFor(cur.units, cur.defects);
          // Only report a trend when BOTH months have measured units; otherwise
          // sigmaFor(prev) collapses to 0 and fakes a large improvement.
          const trendSigma =
            cur.units > 0 && prev.units > 0
              ? sigma - sigmaFor(prev.units, prev.defects)
              : 0;
          return {
            id: ctq.id,
            label: ctq.label,
            domain: ctq.domain,
            units: cur.units,
            defects: cur.defects,
            defectRatePct,
            dpmo,
            sigma,
            trendSigma,
          };
        } catch {
          return {
            id: ctq.id,
            label: ctq.label,
            domain: ctq.domain,
            units: 0,
            defects: 0,
            defectRatePct: 0,
            dpmo: 0,
            sigma: 0,
            trendSigma: 0,
          };
        }
      })
    );

    const active = ctqs.filter((c) => c.units > 0);
    const overallSigma =
      active.length > 0
        ? active.reduce((sum, c) => sum + c.sigma, 0) / active.length
        : 0;

    return { period: current.label, overallSigma, ctqs };
  } catch {
    return empty;
  }
}

// ============================================================
// getDefectPareto — defects only, grouped per field map
// ============================================================

function buildPareto(
  rows: { category: string; count: number }[]
): ParetoRow[] {
  const sorted = [...rows]
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  const total = sorted.reduce((s, r) => s + r.count, 0);
  if (total <= 0) return [];
  let cumulative = 0;
  return sorted.map((r) => {
    cumulative += r.count;
    return {
      category: r.category,
      count: r.count,
      cumulativePct: (cumulative / total) * 100,
    };
  });
}

export async function getDefectPareto(ctqId: string): Promise<ParetoRow[]> {
  try {
    if (!(await authorize())) return [];

    const now = new Date();
    const { start, end } = currentMonthRange(now);

    switch (ctqId) {
      case "lead-sla": {
        const leads = await prisma.lead.findMany({
          where: {
            deletedAt: null,
            firstContactDue: { gte: start, lt: end },
            OR: [
              { firstRespondedAt: null, firstContactDue: { lt: now } },
              { firstRespondedAt: { gt: prisma.lead.fields.firstContactDue } },
            ],
          },
          select: { eventType: true },
        });
        const map = new Map<string, number>();
        for (const l of leads) {
          const key = l.eventType ?? "Unknown";
          map.set(key, (map.get(key) ?? 0) + 1);
        }
        return buildPareto(
          [...map].map(([category, count]) => ({ category, count }))
        );
      }

      case "payment-punctuality": {
        const invoices = await prisma.invoice.findMany({
          where: {
            status: { in: ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"] },
            dueDate: { gte: start, lt: end },
            OR: [
              { status: "OVERDUE" },
              {
                AND: [
                  { status: { not: "PAID" } },
                  { dueDate: { lt: now } },
                  { balanceDue: { gt: 0 } },
                ],
              },
            ],
          },
          select: { booking: { select: { venue: { select: { name: true } } } } },
        });
        const map = new Map<string, number>();
        for (const inv of invoices) {
          const key = inv.booking?.venue?.name ?? "No venue";
          map.set(key, (map.get(key) ?? 0) + 1);
        }
        return buildPareto(
          [...map].map(([category, count]) => ({ category, count }))
        );
      }

      case "task-on-time": {
        const tasks = await prisma.task.findMany({
          where: {
            dueDate: { gte: start, lt: end },
            OR: [
              { status: { not: "DONE" }, dueDate: { lt: now } },
              { completedAt: { gt: prisma.task.fields.dueDate } },
            ],
          },
          select: { status: true },
        });
        const map = new Map<string, number>();
        for (const t of tasks) {
          const key = String(t.status);
          map.set(key, (map.get(key) ?? 0) + 1);
        }
        return buildPareto(
          [...map].map(([category, count]) => ({ category, count }))
        );
      }

      case "support-sla": {
        const tickets = await prisma.supportTicket.findMany({
          where: {
            createdAt: { gte: start, lt: end },
            slaEscalatedAt: { not: null },
          },
          select: { priority: true },
        });
        const map = new Map<string, number>();
        for (const t of tickets) {
          const key = String(t.priority);
          map.set(key, (map.get(key) ?? 0) + 1);
        }
        return buildPareto(
          [...map].map(([category, count]) => ({ category, count }))
        );
      }

      case "handover-snag": {
        const snags = await prisma.projectSnag.findMany({
          where: {
            createdAt: { gte: start, lt: end },
            OR: [
              { status: "REOPENED" },
              {
                AND: [
                  { status: { not: "VERIFIED_CLOSED" } },
                  { dueDate: { not: null, lt: now } },
                ],
              },
              {
                AND: [
                  { severity: "CRITICAL" },
                  { status: { not: "VERIFIED_CLOSED" } },
                ],
              },
            ],
          },
          select: { severity: true },
        });
        const map = new Map<string, number>();
        for (const s of snags) {
          const key = String(s.severity);
          map.set(key, (map.get(key) ?? 0) + 1);
        }
        return buildPareto(
          [...map].map(([category, count]) => ({ category, count }))
        );
      }

      case "cx-rating": {
        const reviews = await prisma.review.findMany({
          where: {
            createdAt: { gte: start, lt: end },
            rating: { lt: 4 },
          },
          select: { rating: true },
        });
        const map = new Map<string, number>();
        for (const r of reviews) {
          const key = `${r.rating} star`;
          map.set(key, (map.get(key) ?? 0) + 1);
        }
        return buildPareto(
          [...map].map(([category, count]) => ({ category, count }))
        );
      }

      default:
        return [];
    }
  } catch {
    return [];
  }
}

// ============================================================
// getControlSeries — last 6 months monthly defect rate %
// ============================================================

export async function getControlSeries(ctqId: string): Promise<ControlSeries> {
  const empty: ControlSeries = { points: [], mean: 0, ucl: 0, lcl: 0 };

  try {
    if (!(await authorize())) return empty;

    const now = new Date();
    const months = lastNMonths(6, now);

    const points = await Promise.all(
      months.map(async (range) => {
        try {
          const { units, defects } = await countCtq(ctqId, range, now);
          const value = units > 0 ? (defects / units) * 100 : 0;
          return { label: range.label, value };
        } catch {
          return { label: range.label, value: 0 };
        }
      })
    );

    const limits = controlLimits(points.map((p) => p.value));
    return {
      points,
      mean: limits.mean,
      ucl: limits.ucl,
      lcl: limits.lcl,
    };
  } catch {
    return empty;
  }
}
