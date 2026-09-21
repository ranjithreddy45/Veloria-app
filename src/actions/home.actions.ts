"use server";

// ============================================================
// Home screen — one read-only load for the role-based team home.
//
// What this file guarantees:
//
//   1. PERMISSIONS. Every block is gated on the permission the module it comes
//      from already requires (leads:read for the SLA clock, invoices:read for
//      receivables, kitchen:read for kitchen plans ...). The lens only decides
//      which blocks are ASKED for; it can never widen what a role may see. A
//      block the role may not see is `undefined`, and the builders in
//      lib/home leave its tile out instead of showing a zero.
//
//   2. ONE DEFINITION PER NUMBER. Each query restates the where-clause of the
//      screen that owns the figure, named in the comment beside it, so the
//      home screen and the module screen cannot disagree.
//
//   3. INDIA TIME. "Today" is India's day. DateTime columns use IST windows
//      expressed as instants; Booking.date (@db.Date, stored as UTC midnight)
//      is matched against India's date as a UTC-midnight value. See
//      lib/home/ist.ts.
//
//   4. SPEED. One Promise.all, column selects only, every list capped, and at
//      most one dependent second round (kitchen plans for the events found,
//      conversion state for the quotation links found) — no per-row queries.
//
// Nothing here writes.
// ============================================================

import type { Prisma } from "@prisma/client";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { COLLECTIBLE_INVOICE_STATUSES } from "@/lib/finance/issued-invoices";
import { bookedValue, cashCollected } from "@/lib/metrics/revenue";
import { LENS_LABEL, resolveLens, seesWholeTeam } from "@/lib/home/lens";
import {
  istDateOnly,
  istDayWindow,
  istMonthWindow,
  istWeekDateOnly,
  istWeekWindow,
} from "@/lib/home/ist";
import { bucketWeek, weekTotal } from "@/lib/home/week";
import { decidingInvoiceId, isShareLinkConverted } from "@/lib/home/quotes";
import { buildAttention } from "@/lib/home/attention";
import { buildGreeting, buildKpis, buildSideCard } from "@/lib/home/summary";
import type { DayEvents, HomeFacts } from "@/lib/home/facts";
import type { HomeView } from "@/lib/home/view";

/** Rows fetched per feed source. The feed shows at most 3 of a kind. */
const FEED_ROWS = 5;

// A booking that is, or was, a real event on its day. HOLD and TENTATIVE are
// not events yet and CANCELLED never will be; COMPLETED stays in so "events
// today" does not shrink as the day's functions finish.
const EVENT_STATUSES = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] as const;

// How far back an opened quotation still counts as "needs a nudge". Beyond a
// week the recovery cadence (quote-radar silent-nudge) owns it, not the rep's
// morning list. This bounds the FEED only; no figure is derived from it.
const QUOTE_FEED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function fullName(c: { firstName?: string | null; lastName?: string | null } | null | undefined): string {
  return `${c?.firstName ?? ""} ${c?.lastName ?? ""}`.trim() || "Unknown contact";
}

export async function getHomeView(): Promise<HomeView | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const role = (session.user.role as string | undefined) ?? "";
  // Same gate as getDashboardStats: the home screen is the dashboard.
  if (!hasPermission(role, "dashboard:read")) return null;

  const lens = resolveLens(role);
  const teamScope = seesWholeTeam(role);
  const can = (perm: string) => hasPermission(role, perm);
  const now = new Date();

  const day = istDayWindow(now);
  const week = istWeekWindow(now);
  const month = istMonthWindow(now);
  const lastMonth = istMonthWindow(now, -1);
  const todayDate = istDateOnly(now);
  const tomorrowDate = istDateOnly(now, 1);
  const weekDates = istWeekDateOnly(now);

  let degraded = false;
  /**
   * Run a block only if this lens wants it AND the role holds the module's
   * permission. A block that throws is logged and left out: a tile that is
   * missing is honest, a tile that silently reads zero is not.
   */
  async function block<T>(wanted: boolean, fn: () => Promise<T>): Promise<T | undefined> {
    if (!wanted) return undefined;
    try {
      return await fn();
    } catch (err) {
      degraded = true;
      console.error("[HOME_BLOCK_ERROR]", err);
      return undefined;
    }
  }

  const isLens = (...lenses: string[]) => lenses.includes(lens);

  // Rep vs team scoping, the rule getSalesFollowupQueue uses.
  const leadScope: Prisma.LeadWhereInput = teamScope ? {} : { assignedToId: userId };

  // The SLA clock exactly as getSpeedToLeadDashboard (speed-to-lead.actions)
  // reads it: running = NEW/CONTACTED with no first response yet.
  const slaBase: Prisma.LeadWhereInput = {
    deletedAt: null,
    status: { in: ["NEW", "CONTACTED"] },
    firstRespondedAt: null,
    ...leadScope,
  };

  // The follow-up queue exactly as getSalesFollowupQueue (lead.actions).
  const followupBase: Prisma.LeadWhereInput = {
    deletedAt: null,
    status: { notIn: ["WON", "LOST"] },
    ...leadScope,
  };

  const myOpenTasks: Prisma.TaskWhereInput = { assigneeId: userId, status: { not: "DONE" } };

  const eventDay = (date: Date) =>
    ({ date, status: { in: [...EVENT_STATUSES] } }) satisfies Prisma.BookingWhereInput;

  async function loadDay(date: Date): Promise<DayEvents> {
    const [agg, rows] = await Promise.all([
      prisma.booking.aggregate({
        where: eventDay(date),
        _count: { _all: true },
        _sum: { guestCount: true },
      }),
      prisma.booking.findMany({
        where: eventDay(date),
        orderBy: [{ timeSlot: "asc" }, { bookingNumber: "asc" }],
        take: 12,
        select: {
          id: true,
          bookingNumber: true,
          eventName: true,
          timeSlot: true,
          guestCount: true,
          hallBooked: true,
          venue: { select: { name: true } },
          bookingMenu: { select: { id: true } },
        },
      }),
    ]);
    return {
      count: agg._count._all,
      guests: agg._sum.guestCount ?? 0,
      rows: rows.map((b) => ({
        bookingId: b.id,
        bookingNumber: b.bookingNumber,
        eventName: b.eventName,
        venueName: b.venue.name,
        hall: b.hallBooked,
        timeSlot: b.timeSlot,
        guestCount: b.guestCount,
        catered: b.bookingMenu !== null,
      })),
    };
  }

  const [
    sla,
    followups,
    leads,
    tasks,
    quoteLinks,
    quoteApprovals,
    holds,
    visits,
    events,
    receivables,
    invoiceCancels,
    paymentCancels,
    paymentProofs,
    cash,
    booked,
    notifications,
  ] = await Promise.all([
    // ---- Speed-to-lead SLA (leads:read) → /leads/sla ----------------------
    block(isLens("owner", "sales") && can("leads:read"), async () => {
      const [breached, pending, rows] = await Promise.all([
        prisma.lead.count({ where: { ...slaBase, firstContactDue: { not: null, lt: now } } }),
        prisma.lead.count({ where: { ...slaBase, firstContactDue: { not: null, gte: now } } }),
        prisma.lead.findMany({
          where: { ...slaBase, firstContactDue: { not: null, lt: now } },
          orderBy: { firstContactDue: "asc" },
          take: FEED_ROWS,
          select: {
            id: true,
            title: true,
            firstContactDue: true,
            contact: { select: { firstName: true, lastName: true } },
            assignedTo: { select: { name: true } },
          },
        }),
      ]);
      return {
        breached,
        pending,
        rows: rows.map((l) => ({
          leadId: l.id,
          title: l.title,
          contactName: fullName(l.contact),
          assignedToName: l.assignedTo?.name ?? null,
          dueAt: l.firstContactDue as Date,
        })),
      };
    }),

    // ---- Follow-ups (leads:read) → /leads/followups -----------------------
    block(isLens("sales") && can("leads:read"), async () => {
      const [overdue, today, rows] = await Promise.all([
        prisma.lead.count({ where: { ...followupBase, followUpDate: { not: null, lt: day.start } } }),
        prisma.lead.count({
          where: { ...followupBase, followUpDate: { not: null, gte: day.start, lt: day.end } },
        }),
        prisma.lead.findMany({
          where: { ...followupBase, followUpDate: { not: null, lt: day.end } },
          orderBy: { followUpDate: "asc" },
          take: FEED_ROWS,
          select: {
            id: true,
            title: true,
            followUpDate: true,
            contact: { select: { firstName: true, lastName: true } },
            assignedTo: { select: { name: true } },
          },
        }),
      ]);
      return {
        overdue,
        today,
        rows: rows.map((l) => ({
          leadId: l.id,
          title: l.title,
          contactName: fullName(l.contact),
          assignedToName: l.assignedTo?.name ?? null,
          followUpAt: l.followUpDate as Date,
        })),
      };
    }),

    // ---- Open leads by status (leads:read) → /leads ------------------------
    block(isLens("sales") && can("leads:read"), async () => {
      const open: Prisma.LeadWhereInput = {
        deletedAt: null,
        status: { notIn: ["WON", "LOST"] },
        ...leadScope,
      };
      const [byStatus, newToday] = await Promise.all([
        prisma.lead.groupBy({ by: ["status"], where: open, _count: { _all: true } }),
        prisma.lead.count({ where: { ...open, createdAt: { gte: day.start, lt: day.end } } }),
      ]);
      return {
        // The total is the sum of the same groups the side card draws, so the
        // tile and the bars can never disagree.
        open: byStatus.reduce((sum, s) => sum + s._count._all, 0),
        newToday,
        byStatus: byStatus.map((s) => ({ status: s.status as string, count: s._count._all })),
      };
    }),

    // ---- My tasks (tasks:read) → /my-work, /tasks/[id] --------------------
    // Always the signed-in user's own: "needs YOU now". Customer to-dos
    // (taskType CLIENT_TODO) carry no assignee, so they cannot appear here.
    block(can("tasks:read"), async () => {
      const [overdue, laterToday, rows] = await Promise.all([
        prisma.task.count({ where: { ...myOpenTasks, dueDate: { not: null, lt: now } } }),
        prisma.task.count({ where: { ...myOpenTasks, dueDate: { not: null, gte: now, lt: day.end } } }),
        prisma.task.findMany({
          where: { ...myOpenTasks, dueDate: { not: null, lt: day.end } },
          orderBy: { dueDate: "asc" },
          take: FEED_ROWS,
          select: {
            id: true,
            title: true,
            dueDate: true,
            booking: { select: { eventName: true } },
          },
        }),
      ]);
      return {
        overdue,
        laterToday,
        rows: rows.map((t) => ({
          id: t.id,
          title: t.title,
          dueAt: t.dueDate as Date,
          related: t.booking?.eventName ?? null,
        })),
      };
    }),

    // ---- Shared quotations a customer opened (quotes:read) → /quotations ---
    block(isLens("sales") && can("quotes:read"), async () => {
      const mine: Prisma.QuoteShareLinkWhereInput = teamScope ? {} : { createdById: userId };
      const [openedToday, rows] = await Promise.all([
        prisma.quoteShareLink.count({
          where: { ...mine, lastViewedAt: { gte: day.start, lt: day.end } },
        }),
        prisma.quoteShareLink.findMany({
          where: {
            ...mine,
            status: "ACTIVE",
            firstViewedAt: { not: null },
            lastViewedAt: { gte: new Date(now.getTime() - QUOTE_FEED_WINDOW_MS) },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          orderBy: { lastViewedAt: "desc" },
          // Over-fetch: converted links are dropped in the second round.
          take: FEED_ROWS * 3,
          select: {
            id: true,
            primaryQuotationId: true,
            payInvoiceId: true,
            clientName: true,
            occasion: true,
            grandTotal: true,
            viewCount: true,
            lastViewedAt: true,
          },
        }),
      ]);
      return { openedToday, rows };
    }),

    // ---- Quotations awaiting approval (quotes:approve) → /approvals --------
    // Same query as getPendingQuoteApprovals (sales-quotation.actions).
    block(isLens("owner", "sales") && can("quotes:approve"), async () => {
      const where: Prisma.SalesQuotationWhereInput = { status: "PENDING_APPROVAL" };
      const [count, rows] = await Promise.all([
        prisma.salesQuotation.count({ where }),
        prisma.salesQuotation.findMany({
          where,
          orderBy: { submittedAt: "asc" }, // longest-waiting first
          take: FEED_ROWS,
          select: {
            id: true,
            quoteNumber: true,
            clientName: true,
            grandTotal: true,
            submittedAt: true,
            submittedBy: { select: { name: true } },
          },
        }),
      ]);
      return {
        count,
        rows: rows.map((q) => ({
          id: q.id,
          quoteNumber: q.quoteNumber,
          clientName: q.clientName,
          grandTotal: Number(q.grandTotal),
          submittedByName: q.submittedBy?.name ?? null,
          submittedAt: q.submittedAt,
        })),
      };
    }),

    // ---- Holds ending today (bookings:read) → /bookings/[id] ---------------
    // Only holds still running: one whose time has already passed belongs to
    // the lapsed-hold rule (lib/holds/lapsed-hold.ts), not to this list.
    block(isLens("owner", "sales") && can("bookings:read"), async () => {
      const rows = await prisma.booking.findMany({
        where: {
          status: "HOLD",
          holdExpiresAt: { gte: now, lt: day.end },
          ...(teamScope ? {} : { createdById: userId }),
        },
        orderBy: { holdExpiresAt: "asc" },
        take: FEED_ROWS,
        select: {
          id: true,
          eventName: true,
          holdExpiresAt: true,
          venue: { select: { name: true } },
          contact: { select: { firstName: true, lastName: true } },
        },
      });
      return {
        rows: rows.map((b) => ({
          bookingId: b.id,
          eventName: b.eventName,
          venueName: b.venue.name,
          contactName: fullName(b.contact),
          holdExpiresAt: b.holdExpiresAt as Date,
        })),
      };
    }),

    // ---- Site visits and tastings today (tastings:read) → /site-visits -----
    // Open statuses as site-visit.actions defines them (OPEN_STATUSES).
    block(isLens("sales") && can("tastings:read"), async () => {
      const rows = await prisma.siteVisitBooking.findMany({
        where: {
          status: { in: ["REQUESTED", "CONFIRMED", "RESCHEDULED"] },
          scheduledAt: { gte: day.start, lt: day.end },
          // A rep sees their own visits plus any nobody has picked up yet.
          ...(teamScope ? {} : { OR: [{ assignedToId: userId }, { assignedToId: null }] }),
        },
        orderBy: { scheduledAt: "asc" },
        take: FEED_ROWS,
        select: {
          id: true,
          customerName: true,
          kind: true,
          status: true,
          scheduledAt: true,
          assignedToId: true,
          venue: { select: { name: true } },
        },
      });
      return {
        rows: rows.map((v) => ({
          id: v.id,
          customerName: v.customerName,
          kind: v.kind as string,
          status: v.status as string,
          venueName: v.venue?.name ?? null,
          scheduledAt: v.scheduledAt,
          unassigned: v.assignedToId === null,
        })),
      };
    }),

    // ---- Events today / tomorrow / this week (bookings:read) → /calendar ---
    block(isLens("owner", "ops", "staff") && can("bookings:read"), async () => {
      const [today, tomorrow, thisWeek] = await Promise.all([
        loadDay(todayDate),
        loadDay(tomorrowDate),
        prisma.booking.count({
          where: {
            status: { in: [...EVENT_STATUSES] },
            date: { gte: weekDates.start, lt: weekDates.end },
          },
        }),
      ]);
      return { today, tomorrow, thisWeek };
    }),

    // ---- Receivables (invoices:read) → /invoices ---------------------------
    // Overdue and outstanding exactly as getInvoiceStats (invoice.actions):
    // overdue = status OVERDUE (set by markOverdue and the daily invoice-due
    // job); outstanding = the owed statuses, COLLECTIBLE_INVOICE_STATUSES.
    block(isLens("owner", "finance") && can("invoices:read"), async () => {
      const [overdue, outstanding, rows] = await Promise.all([
        prisma.invoice.aggregate({
          where: { status: "OVERDUE" },
          _sum: { balanceDue: true },
          _count: { _all: true },
        }),
        prisma.invoice.aggregate({
          where: { status: { in: [...COLLECTIBLE_INVOICE_STATUSES] } },
          _sum: { balanceDue: true },
        }),
        prisma.invoice.findMany({
          where: { status: "OVERDUE", balanceDue: { gt: 0 } },
          orderBy: { dueDate: "asc" },
          take: FEED_ROWS,
          select: {
            id: true,
            invoiceNumber: true,
            balanceDue: true,
            dueDate: true,
            contact: { select: { firstName: true, lastName: true } },
            booking: { select: { date: true } },
          },
        }),
      ]);
      return {
        overdueAmount: Number(overdue._sum.balanceDue ?? 0),
        overdueCount: overdue._count._all,
        outstanding: Number(outstanding._sum.balanceDue ?? 0),
        rows: rows.map((i) => ({
          invoiceId: i.id,
          invoiceNumber: i.invoiceNumber,
          contactName: fullName(i.contact),
          balanceDue: Number(i.balanceDue),
          dueAt: i.dueDate,
          eventDate: i.booking?.date ?? null,
        })),
      };
    }),

    // ---- Maker-checker cancellations (invoice-cancel.actions) --------------
    // Shown only to a role that can actually approve them.
    block(isLens("owner", "finance") && can("invoices:read") && can("invoices:cancel"), async () => {
      const where: Prisma.InvoiceWhereInput = { cancelPending: true, status: { not: "CANCELLED" } };
      const [count, rows] = await Promise.all([
        prisma.invoice.count({ where }),
        prisma.invoice.findMany({
          where,
          orderBy: { cancelRequestedAt: "asc" },
          take: FEED_ROWS,
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            cancelReason: true,
            cancelRequestedAt: true,
          },
        }),
      ]);
      return {
        count,
        rows: rows.map((i) => ({
          id: i.id,
          reference: i.invoiceNumber,
          amount: Number(i.totalAmount),
          reason: i.cancelReason,
          requestedAt: i.cancelRequestedAt,
        })),
      };
    }),

    block(isLens("owner", "finance") && can("payments:read") && can("payments:cancel"), async () => {
      const where: Prisma.PaymentWhereInput = { cancelPending: true, status: { not: "CANCELLED" } };
      const [count, rows] = await Promise.all([
        prisma.payment.count({ where }),
        prisma.payment.findMany({
          where,
          orderBy: { cancelRequestedAt: "asc" },
          take: FEED_ROWS,
          select: {
            id: true,
            receiptNumber: true,
            amount: true,
            cancelReason: true,
            cancelRequestedAt: true,
            invoiceId: true,
            invoice: { select: { invoiceNumber: true } },
          },
        }),
      ]);
      return {
        count,
        rows: rows.map((p) => ({
          id: p.id,
          reference: p.receiptNumber ?? `on ${p.invoice.invoiceNumber}`,
          amount: Number(p.amount),
          reason: p.cancelReason,
          requestedAt: p.cancelRequestedAt,
          invoiceId: p.invoiceId,
        })),
      };
    }),

    // ---- Payment proofs awaiting verification → /payments ------------------
    // The rows verifyPaymentProof (payment.actions) would accept: PENDING,
    // with an uploaded proof, on an invoice that can still take money.
    block(isLens("owner", "finance") && can("payments:read") && can("payments:update"), async () => ({
      count: await prisma.payment.count({
        where: {
          status: "PENDING",
          receiptUrl: { not: null },
          invoice: { status: { in: [...COLLECTIBLE_INVOICE_STATUSES] } },
        },
      }),
    })),

    // ---- Cash collected (payments:read) → /payments -----------------------
    // CASH_COLLECTED as lib/metrics/revenue defines it: Σ Payment.amount over
    // COMPLETED payments by paidAt — the same filter getDashboardStats used,
    // on the same IST month boundaries.
    block(isLens("owner", "finance") && can("payments:read"), async () => {
      const completedIn = (w: { start: Date; end: Date }): Prisma.PaymentWhereInput => ({
        status: "COMPLETED",
        paidAt: { gte: w.start, lt: w.end },
      });
      const [thisMonth, prevMonth, weekRows] = await Promise.all([
        prisma.payment.aggregate({ where: completedIn(month), _sum: { amount: true } }),
        prisma.payment.aggregate({ where: completedIn(lastMonth), _sum: { amount: true } }),
        prisma.payment.findMany({
          where: completedIn(week),
          select: { amount: true, paidAt: true },
          take: 5000,
        }),
      ]);
      const days = bucketWeek(
        weekRows.map((p) => ({ at: p.paidAt as Date, amount: cashCollected([p]) })),
        now
      );
      return {
        thisMonth: Number(thisMonth._sum.amount ?? 0),
        lastMonth: Number(prevMonth._sum.amount ?? 0),
        // Summed from the same rows as the bars so the two always agree.
        thisWeek: weekTotal(days),
        week: days,
      };
    }),

    // ---- Booked value (bookings:read) → /bookings --------------------------
    // BOOKED_VALUE as lib/metrics/revenue defines it: Σ Booking.totalAmount of
    // confirmed bookings, by the day the booking was made. A rep's figure is
    // the bookings they created (the attribution performance.actions uses).
    block(isLens("owner", "sales") && can("bookings:read"), async () => {
      const scope: Prisma.BookingWhereInput = {
        status: { in: [...EVENT_STATUSES] },
        ...(teamScope ? {} : { createdById: userId }),
      };
      const [monthAgg, weekRows] = await Promise.all([
        prisma.booking.aggregate({
          where: { ...scope, createdAt: { gte: month.start, lt: month.end } },
          _sum: { totalAmount: true },
          _count: { _all: true },
        }),
        prisma.booking.findMany({
          where: { ...scope, createdAt: { gte: week.start, lt: week.end } },
          select: { totalAmount: true, createdAt: true },
          take: 2000,
        }),
      ]);
      const days = bucketWeek(
        weekRows.map((b) => ({ at: b.createdAt, amount: bookedValue([b]) })),
        now
      );
      return {
        monthValue: Number(monthAgg._sum.totalAmount ?? 0),
        monthCount: monthAgg._count._all,
        weekValue: weekTotal(days),
        week: days,
      };
    }),

    // ---- The user's own unread notifications → /notifications -------------
    block(isLens("ops", "staff"), async () => ({
      unread: await prisma.notification.count({ where: { userId, isRead: false } }),
    })),
  ]);

  // ---- Second round: only what depends on the rows found above -----------
  const eventIds = events ? [...events.today.rows, ...events.tomorrow.rows].map((e) => e.bookingId) : [];
  const quotationIds = [
    ...new Set((quoteLinks?.rows ?? []).map((l) => l.primaryQuotationId).filter((id): id is string => !!id)),
  ];

  const [kitchen, quotations] = await Promise.all([
    // Kitchen plans for those events (kitchen:read) → /kitchen
    block(isLens("ops") && can("kitchen:read") && events !== undefined, async () => ({
      plans: eventIds.length
        ? await prisma.kitchenPlan.findMany({
            where: { bookingId: { in: eventIds } },
            select: { id: true, bookingId: true, status: true, covers: true },
          })
        : [],
    })),
    block(quotationIds.length > 0, () =>
      prisma.salesQuotation.findMany({
        where: { id: { in: quotationIds } },
        select: { id: true, bookingId: true, invoiceId: true },
      })
    ),
  ]);

  let quotes: HomeFacts["quotes"];
  if (quoteLinks) {
    const quotationById = new Map((quotations ?? []).map((q) => [q.id, q]));
    const invoiceIdFor = (l: (typeof quoteLinks.rows)[number]) =>
      decidingInvoiceId(l, l.primaryQuotationId ? quotationById.get(l.primaryQuotationId) : undefined);
    const invoiceIds = [...new Set(quoteLinks.rows.map(invoiceIdFor).filter((id): id is string => !!id))];
    const invoices = await block(invoiceIds.length > 0, () =>
      prisma.invoice.findMany({
        where: { id: { in: invoiceIds } },
        select: { id: true, status: true, balanceDue: true, paidAmount: true },
      })
    );
    // If the conversion lookups failed we cannot tell paid from unpaid, so the
    // rows are dropped rather than accusing a customer who has already paid.
    const lookupsOk =
      (quotationIds.length === 0 || quotations !== undefined) &&
      (invoiceIds.length === 0 || invoices !== undefined);
    const invoiceById = new Map(
      (invoices ?? []).map((i) => [
        i.id,
        { status: i.status as string, balanceDue: Number(i.balanceDue), paidAmount: Number(i.paidAmount) },
      ])
    );
    quotes = {
      openedToday: quoteLinks.openedToday,
      rows: lookupsOk
        ? quoteLinks.rows
            .filter((l) => {
              const q = l.primaryQuotationId ? quotationById.get(l.primaryQuotationId) : undefined;
              const invId = invoiceIdFor(l);
              return !isShareLinkConverted(l, q, invId ? invoiceById.get(invId) : undefined);
            })
            .slice(0, FEED_ROWS)
            .map((l) => ({
              linkId: l.id,
              quotationId: l.primaryQuotationId,
              clientName: l.clientName,
              occasion: l.occasion,
              grandTotal: Number(l.grandTotal),
              viewCount: l.viewCount,
              lastViewedAt: l.lastViewedAt as Date,
            }))
        : [],
    };
  }

  const facts: HomeFacts = {
    teamScope,
    sla,
    followups,
    leads,
    tasks,
    quotes,
    quoteApprovals,
    holds,
    visits,
    events,
    kitchen,
    receivables,
    invoiceCancels,
    paymentCancels,
    paymentProofs,
    cash,
    booked,
    notifications,
  };

  const firstName = (session.user.name ?? "").trim().split(/\s+/)[0] || "there";

  return {
    lens,
    lensLabel: LENS_LABEL[lens],
    greeting: buildGreeting(lens, facts, firstName, now),
    kpis: buildKpis(lens, facts, now),
    attention: buildAttention(lens, facts, now),
    side: buildSideCard(lens, facts),
    degraded,
    asOf: now.toISOString(),
  };
}
