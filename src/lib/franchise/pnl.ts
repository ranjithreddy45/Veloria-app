// ============================================================
// Franchise per-venue P&L rollup (DB-read only, no auth — callers gate)
// ============================================================
// Revenue definition (IMPORTANT — there are three competing revenue notions in
// this app: booking.totalAmount, COMPLETED Payment.amount, invoice.paidAmount).
// To keep partner revenue-share payouts reconcilable with the Reports page
// (getRevenueAnalytics in src/actions/report.actions.ts), this lib uses the
// SAME cash-basis definition:
//
//   grossRevenue = sum of COMPLETED Payment.amount whose paidAt falls in the
//                  period month AND whose invoice.booking.venueId === venueId.
//
// Expenses are the per-venue Payout rows (vendor/owner disbursements) in the
// same period, joined to the venue via the Payout's booking.venueId (Payout has
// no direct venueId column). netRevenue = grossRevenue - expenses.
//
// All money math is done in integer paise and rounded to 2dp exactly once at
// the end, so we never multiply JS floats on currency.

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface VenuePnl {
  venueId: string;
  period: string; // "YYYY-MM"
  grossRevenue: number; // 2dp
  expenses: number; // 2dp
  netRevenue: number; // 2dp
  bookingCount: number; // distinct bookings contributing revenue in period
}

export type ShareBasis = "GROSS_REVENUE" | "NET_REVENUE" | "FLAT_FEE";

export interface ShareConfigLike {
  basis: ShareBasis;
  sharePct: Prisma.Decimal | number | string;
  flatFeeAmount?: Prisma.Decimal | number | string | null;
}

// ---- money helpers (work in paise) -------------------------------------

/** Convert a Decimal/number/string rupee amount to integer paise. */
function toPaise(value: Prisma.Decimal | number | string): number {
  // Prisma.Decimal handles arbitrary precision; multiply by 100 then round.
  const d = new Prisma.Decimal(value as Prisma.Decimal.Value);
  return Math.round(d.times(100).toNumber());
}

/** Convert integer paise back to a 2dp rupee number. */
function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * Parse a "YYYY-MM" period into UTC month bounds [start, end] inclusive of the
 * whole month. Payment.paidAt / Payout.paidAt are timestamps, so we use a
 * half-open compare under the hood (gte start, lt nextMonthStart).
 */
export function periodBounds(period: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) {
    throw new Error(`Invalid period "${period}" (expected YYYY-MM)`);
  }
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)); // first of next month
  return { start, end };
}

/** The "YYYY-MM" of the month immediately before `ref` (default: now). */
export function previousPeriod(ref: Date = new Date()): string {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth(); // 0-11; previous month
  const d = new Date(Date.UTC(y, m - 1, 1));
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}`;
}

/** The current "YYYY-MM" (UTC). */
export function currentPeriod(ref: Date = new Date()): string {
  const mm = String(ref.getUTCMonth() + 1).padStart(2, "0");
  return `${ref.getUTCFullYear()}-${mm}`;
}

/**
 * Compute the cash-basis P&L for one venue over one month.
 * Read-only; the caller is responsible for authorization.
 */
export async function computeVenuePnl(
  venueId: string,
  period: string
): Promise<VenuePnl> {
  const { start, end } = periodBounds(period);

  const [payments, payouts] = await Promise.all([
    // Gross: COMPLETED payments paid in-period for this venue's bookings.
    prisma.payment.findMany({
      where: {
        status: "COMPLETED",
        paidAt: { gte: start, lt: end },
        invoice: { booking: { venueId } },
      },
      select: {
        amount: true,
        invoice: { select: { bookingId: true } },
      },
    }),
    // Expenses: vendor/owner payouts disbursed in-period for this venue's
    // bookings. Payout has no venueId column, so join via booking.venueId.
    // Count only money that actually left (PAID); pending/approved are accruals.
    prisma.payout.findMany({
      where: {
        status: "PAID",
        paidAt: { gte: start, lt: end },
        booking: { venueId },
      },
      select: { amount: true },
    }),
  ]);

  let grossPaise = 0;
  const bookingIds = new Set<string>();
  for (const p of payments) {
    grossPaise += toPaise(p.amount);
    const bid = p.invoice?.bookingId;
    if (bid) bookingIds.add(bid);
  }

  let expensePaise = 0;
  for (const po of payouts) {
    expensePaise += toPaise(po.amount);
  }

  const netPaise = grossPaise - expensePaise;

  return {
    venueId,
    period,
    grossRevenue: fromPaise(grossPaise),
    expenses: fromPaise(expensePaise),
    netRevenue: fromPaise(netPaise),
    bookingCount: bookingIds.size,
  };
}

/**
 * Derive the revenue-share amount for a P&L under a given config.
 * GROSS_REVENUE → gross * sharePct/100
 * NET_REVENUE   → max(net, 0) * sharePct/100  (no negative share)
 * FLAT_FEE      → flatFeeAmount (or 0)
 * Math in paise; rounded to 2dp once.
 */
export function computeShareAmount(
  pnl: Pick<VenuePnl, "grossRevenue" | "netRevenue">,
  config: ShareConfigLike
): number {
  if (config.basis === "FLAT_FEE") {
    return fromPaise(toPaise(config.flatFeeAmount ?? 0));
  }

  const basePaise =
    config.basis === "NET_REVENUE"
      ? Math.max(0, toPaise(pnl.netRevenue))
      : toPaise(pnl.grossRevenue);

  // pct is Decimal(5,2); multiply paise by pct then divide by 100, round.
  const pct = new Prisma.Decimal(config.sharePct as Prisma.Decimal.Value);
  const sharePaise = Math.round(
    new Prisma.Decimal(basePaise).times(pct).dividedBy(100).toNumber()
  );
  return fromPaise(sharePaise);
}
