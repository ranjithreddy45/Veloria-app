"use server";

// ============================================================
// Finance · Event Profitability — READ-only, GL-neutral.
// Per-booking invoiced / collected / vendor / other / staff figures for
// bookings whose EVENT DATE falls in a range. All the arithmetic and the
// definitions live in src/lib/finance/event-profitability.ts (pure, tested);
// this file only gates, queries (groupBy/aggregate — no per-booking N+1) and
// maps. finance:read gated; returns { success, data } | { success:false, error }.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { BookingStatus, Prisma } from "@prisma/client";
import { isIssuedInvoice } from "@/lib/finance/issued-invoices";
import {
  computeEventProfitability,
  summarizeEventProfitability,
  hoursBetween,
  type EventProfitabilityRow,
  type EventProfitabilityTotals,
  type StaffAssignmentInput,
} from "@/lib/finance/event-profitability";

const ROW_CAP = 2000;

const BOOKING_STATUSES = new Set<string>(["HOLD", "TENTATIVE", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

/** ACTIVE = every status except CANCELLED (default). ALL = include cancelled. */
export type ProfitabilityStatusFilter = "ACTIVE" | "ALL" | BookingStatus;

export interface EventProfitabilityParams {
  /** Event-date window, inclusive, as yyyy-mm-dd. */
  from: string;
  to: string;
  venueId?: string;
  status?: ProfitabilityStatusFilter;
}

export interface EventProfitabilityReport {
  rows: EventProfitabilityRow[];
  totals: EventProfitabilityTotals;
  /** True when more than `cap` bookings matched — only the first `cap` (by event date) are returned. */
  truncated: boolean;
  cap: number;
  range: { from: string; to: string };
}

export type EventProfitabilityResult =
  | { success: true; data: EventProfitabilityReport }
  | { success: false; error: string };

async function currentRole(): Promise<string | undefined> {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role;
}

// Booking.date is @db.Date (stored as UTC midnight) — match by UTC day range,
// never by a local-midnight Date (see memory: app-integrity-gotchas #1).
function utcDayStart(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

const num = (d: Prisma.Decimal | number | null | undefined): number => Number(d ?? 0);

export async function getEventProfitability(params: EventProfitabilityParams): Promise<EventProfitabilityResult> {
  try {
    const role = await currentRole();
    if (!role) return { success: false, error: "Unauthorized" };
    if (!hasPermission(role, "finance:read")) return { success: false, error: "Insufficient permissions" };

    const start = utcDayStart(params.from);
    const end = utcDayStart(params.to);
    if (!start || !end) return { success: false, error: "Invalid date range — use yyyy-mm-dd." };
    if (end.getTime() < start.getTime()) return { success: false, error: "The end date is before the start date." };
    const endExclusive = new Date(end.getTime() + 86_400_000);

    const statusFilter = params.status ?? "ACTIVE";
    let statusWhere: Prisma.BookingWhereInput = {};
    if (statusFilter === "ACTIVE") statusWhere = { status: { not: "CANCELLED" } };
    else if (statusFilter !== "ALL") {
      if (!BOOKING_STATUSES.has(statusFilter)) return { success: false, error: "Unknown booking status filter." };
      statusWhere = { status: statusFilter };
    }

    const bookingsRaw = await prisma.booking.findMany({
      where: {
        date: { gte: start, lt: endExclusive },
        ...(params.venueId ? { venueId: params.venueId } : {}),
        ...statusWhere,
      },
      orderBy: [{ date: "asc" }, { bookingNumber: "asc" }],
      take: ROW_CAP + 1,
      select: {
        id: true,
        bookingNumber: true,
        eventName: true,
        eventType: true,
        status: true,
        date: true,
        totalAmount: true,
        venueId: true,
        venue: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true, company: true } },
      },
    });

    const truncated = bookingsRaw.length > ROW_CAP;
    const bookings = truncated ? bookingsRaw.slice(0, ROW_CAP) : bookingsRaw;
    const ids = bookings.map((b) => b.id);
    const range = { from: params.from, to: params.to };

    if (ids.length === 0) {
      return {
        success: true,
        data: { rows: [], totals: summarizeEventProfitability([]), truncated: false, cap: ROW_CAP, range },
      };
    }

    // One round of set-based queries for the whole page of bookings.
    const [invoices, payments, unlinkedPayouts, linkedPayouts, bills, commissions, referrals, bookingVendors, staff] =
      await Promise.all([
        // Issued invoices → accrual revenue; every invoice → payment→booking map.
        prisma.invoice.findMany({
          where: { bookingId: { in: ids } },
          select: { id: true, bookingId: true, status: true, totalAmount: true },
        }),
        // Cash: completed and refunded payments on those invoices.
        prisma.payment.groupBy({
          by: ["invoiceId", "status"],
          where: { invoice: { bookingId: { in: ids } }, status: { in: ["COMPLETED", "REFUNDED"] } },
          _sum: { amount: true },
        }),
        // Payouts NOT linked to a bill (vendor advances/direct, commission, owner).
        prisma.payout.groupBy({
          by: ["bookingId", "type", "status"],
          where: { bookingId: { in: ids }, billId: null },
          _sum: { amount: true, nettedAmount: true },
          _count: { _all: true },
        }),
        // Payouts settling a bill — their amount is already inside the bill.
        prisma.payout.groupBy({
          by: ["bookingId", "type", "status"],
          where: { bookingId: { in: ids }, billId: { not: null } },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        // Accrued vendor liabilities.
        prisma.vendorBill.groupBy({
          by: ["bookingId"],
          where: { bookingId: { in: ids }, status: "APPROVED" },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.commissionEntry.groupBy({
          by: ["bookingId", "status"],
          where: { bookingId: { in: ids } },
          _sum: { commissionAmount: true },
          _count: { _all: true },
        }),
        // Only CASH rewards are a cost; POINTS/DISCOUNT are not disbursed.
        prisma.referralReward.groupBy({
          by: ["bookingId", "status"],
          where: { bookingId: { in: ids }, rewardType: "CASH" },
          _sum: { rewardValue: true },
          _count: { _all: true },
        }),
        prisma.bookingVendor.groupBy({
          by: ["bookingId"],
          where: { bookingId: { in: ids } },
          _sum: { agreedRate: true },
        }),
        // Staff rostered on the event's operation, with the user's hourly rate.
        prisma.staffAssignment.findMany({
          where: { operation: { bookingId: { in: ids } } },
          select: {
            shiftStart: true,
            shiftEnd: true,
            operation: { select: { bookingId: true } },
            user: { select: { staffProfile: { select: { hourlyRate: true } } } },
          },
        }),
      ]);

    // ---- fold into per-booking inputs ----
    const invoiceBooking = new Map<string, string>();
    const revenue = new Map<string, { invoicedIssued: number; issuedInvoiceCount: number; paymentsCompleted: number; paymentsRefunded: number }>();
    const rev = (id: string) => {
      let r = revenue.get(id);
      if (!r) {
        r = { invoicedIssued: 0, issuedInvoiceCount: 0, paymentsCompleted: 0, paymentsRefunded: 0 };
        revenue.set(id, r);
      }
      return r;
    };
    for (const inv of invoices) {
      if (!inv.bookingId) continue;
      invoiceBooking.set(inv.id, inv.bookingId);
      if (!isIssuedInvoice(inv.status)) continue; // finance's shared issued rule
      const r = rev(inv.bookingId);
      r.invoicedIssued += num(inv.totalAmount);
      r.issuedInvoiceCount += 1;
    }
    for (const p of payments) {
      const bookingId = invoiceBooking.get(p.invoiceId);
      if (!bookingId) continue;
      const r = rev(bookingId);
      if (p.status === "COMPLETED") r.paymentsCompleted += num(p._sum.amount);
      else if (p.status === "REFUNDED") r.paymentsRefunded += num(p._sum.amount);
    }

    type VendorAgg = {
      approvedBillTotal: number;
      paidPayoutTotal: number;
      approvedUnlinkedPayoutNet: number;
      paidUnlinkedPayoutNet: number;
      pendingPayoutTotal: number;
      agreedRateTotal: number;
      recordCount: number;
    };
    type OtherAgg = { committed: number; paid: number; pending: number; recordCount: number };
    const vendor = new Map<string, VendorAgg>();
    const other = new Map<string, OtherAgg>();
    const ven = (id: string) => {
      let v = vendor.get(id);
      if (!v) {
        v = { approvedBillTotal: 0, paidPayoutTotal: 0, approvedUnlinkedPayoutNet: 0, paidUnlinkedPayoutNet: 0, pendingPayoutTotal: 0, agreedRateTotal: 0, recordCount: 0 };
        vendor.set(id, v);
      }
      return v;
    };
    const oth = (id: string) => {
      let o = other.get(id);
      if (!o) {
        o = { committed: 0, paid: 0, pending: 0, recordCount: 0 };
        other.set(id, o);
      }
      return o;
    };

    for (const b of bills) {
      if (!b.bookingId) continue;
      const v = ven(b.bookingId);
      v.approvedBillTotal += num(b._sum.amount);
      v.recordCount += b._count._all;
    }
    for (const bv of bookingVendors) {
      ven(bv.bookingId).agreedRateTotal += num(bv._sum.agreedRate);
    }
    for (const p of unlinkedPayouts) {
      if (!p.bookingId || p.status === "CANCELLED") continue;
      const amount = num(p._sum.amount);
      const net = amount - num(p._sum.nettedAmount);
      if (p.type === "VENDOR_PAYMENT") {
        const v = ven(p.bookingId);
        if (p.status === "PAID") {
          v.paidPayoutTotal += amount;
          v.paidUnlinkedPayoutNet += net;
          v.recordCount += p._count._all;
        } else if (p.status === "APPROVED") {
          v.approvedUnlinkedPayoutNet += net;
          v.recordCount += p._count._all;
        } else {
          v.pendingPayoutTotal += amount; // PENDING
        }
      } else {
        // COMMISSION | OWNER_PAYOUT
        const o = oth(p.bookingId);
        if (p.status === "PAID") {
          o.paid += amount;
          o.recordCount += p._count._all;
        } else if (p.status === "APPROVED") {
          o.committed += amount;
          o.recordCount += p._count._all;
        } else o.pending += amount;
      }
    }
    for (const p of linkedPayouts) {
      if (!p.bookingId || p.status === "CANCELLED") continue;
      const amount = num(p._sum.amount);
      if (p.type === "VENDOR_PAYMENT") {
        const v = ven(p.bookingId);
        if (p.status === "PAID") {
          v.paidPayoutTotal += amount;
          v.recordCount += p._count._all;
        } else if (p.status === "APPROVED") {
          // Approved-but-unpaid against a bill: the bill already carries it.
          v.recordCount += p._count._all;
        } else v.pendingPayoutTotal += amount;
      } else {
        const o = oth(p.bookingId);
        if (p.status === "PAID") {
          o.paid += amount;
          o.recordCount += p._count._all;
        } else if (p.status === "APPROVED") {
          o.committed += amount;
          o.recordCount += p._count._all;
        } else o.pending += amount;
      }
    }
    for (const c of commissions) {
      const o = oth(c.bookingId);
      const amount = num(c._sum.commissionAmount);
      if (c.status === "PAID") {
        o.paid += amount;
        o.recordCount += c._count._all;
      } else if (c.status === "APPROVED") {
        o.committed += amount;
        o.recordCount += c._count._all;
      } else o.pending += amount;
    }
    for (const r of referrals) {
      if (!r.bookingId) continue;
      const o = oth(r.bookingId);
      const amount = num(r._sum.rewardValue);
      if (r.status === "REWARD_PAID") {
        o.paid += amount;
        o.recordCount += r._count._all;
      } else if (r.status === "REWARD_APPROVED") {
        o.committed += amount;
        o.recordCount += r._count._all;
      } else if (r.status === "REWARD_PENDING" || r.status === "ELIGIBLE") o.pending += amount;
      // REWARD_CANCELLED: ignored
    }

    const staffByBooking = new Map<string, StaffAssignmentInput[]>();
    for (const s of staff) {
      const list = staffByBooking.get(s.operation.bookingId) ?? [];
      const rate = s.user.staffProfile?.hourlyRate;
      list.push({ hours: hoursBetween(s.shiftStart, s.shiftEnd), hourlyRate: rate == null ? null : num(rate) });
      staffByBooking.set(s.operation.bookingId, list);
    }

    const EMPTY_VENDOR: VendorAgg = { approvedBillTotal: 0, paidPayoutTotal: 0, approvedUnlinkedPayoutNet: 0, paidUnlinkedPayoutNet: 0, pendingPayoutTotal: 0, agreedRateTotal: 0, recordCount: 0 };
    const EMPTY_OTHER: OtherAgg = { committed: 0, paid: 0, pending: 0, recordCount: 0 };

    const rows = bookings.map((b) =>
      computeEventProfitability({
        booking: {
          bookingId: b.id,
          bookingNumber: b.bookingNumber,
          eventName: b.eventName,
          eventType: b.eventType,
          bookingStatus: b.status,
          date: b.date.toISOString(),
          venueId: b.venueId,
          venueName: b.venue.name,
          customer:
            `${b.contact.firstName} ${b.contact.lastName}`.trim() + (b.contact.company ? ` · ${b.contact.company}` : ""),
          contractValue: num(b.totalAmount),
        },
        revenue: revenue.get(b.id) ?? { invoicedIssued: 0, issuedInvoiceCount: 0, paymentsCompleted: 0, paymentsRefunded: 0 },
        vendor: vendor.get(b.id) ?? EMPTY_VENDOR,
        other: other.get(b.id) ?? EMPTY_OTHER,
        staff: staffByBooking.get(b.id) ?? [],
      }),
    );

    return {
      success: true,
      data: { rows, totals: summarizeEventProfitability(rows), truncated, cap: ROW_CAP, range },
    };
  } catch (error) {
    console.error("[GET_EVENT_PROFITABILITY_ERROR]", error);
    return { success: false, error: "Failed to build the event profitability report" };
  }
}

export interface ProfitabilityVenueOption {
  id: string;
  name: string;
  isActive: boolean;
}

/** Venue picker options for the report (past events may sit on a now-inactive venue, so all are listed). */
export async function getProfitabilityVenues(): Promise<
  { success: true; data: ProfitabilityVenueOption[] } | { success: false; error: string }
> {
  try {
    const role = await currentRole();
    if (!role) return { success: false, error: "Unauthorized" };
    if (!hasPermission(role, "finance:read")) return { success: false, error: "Insufficient permissions" };
    const venues = await prisma.venue.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isActive: true },
    });
    return { success: true, data: venues };
  } catch (error) {
    console.error("[GET_PROFITABILITY_VENUES_ERROR]", error);
    return { success: false, error: "Failed to load venues" };
  }
}
