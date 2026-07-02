"use server";

// ============================================================
// Sales Reports — row-level lists (event tracker, revenue & collections,
// payment alerts, lost analysis). Complements sales-analytics.actions.ts.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { resolveBdRange, type BdRangeKey } from "@/lib/acq/analytics-range";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireSales() {
  const session = await auth();
  const user = session?.user as { id: string; role?: string } | undefined;
  if (!user?.id) return null;
  const r = user.role ?? "";
  const ok = r === "SUPER_ADMIN" || r === "ADMIN" || hasPermission(r, "leads:read") || hasPermission(r, "bookings:read");
  return ok ? user : null;
}

const num = (x: unknown) => Number(x ?? 0) || 0;
const contactName = (c: { firstName: string | null; lastName: string | null } | null) =>
  c ? [c.firstName, c.lastName].filter(Boolean).join(" ") || "—" : "—";
const tierOf = (amt: number) => (amt >= 1_000_000 ? "Luxury" : amt >= 500_000 ? "Premium" : "Standard");

interface Params { rangeKey?: BdRangeKey; from?: string | null; to?: string | null; employeeIds?: string[] | null }

// ------------------------------------------------------------
// Event calendar & booking tracker (upcoming/active bookings)
// ------------------------------------------------------------
export async function getSalesEventTracker(params: { employeeIds?: string[] | null }): Promise<Result<unknown>> {
  const user = await requireSales();
  if (!user) return { success: false, error: "Unauthorized" };
  const empIds = params.employeeIds?.length ? params.employeeIds : null;

  const bookings = await prisma.booking.findMany({
    where: { status: { in: ["HOLD", "TENTATIVE", "CONFIRMED", "IN_PROGRESS"] }, ...(empIds ? { createdById: { in: empIds } } : {}) },
    select: {
      id: true, bookingNumber: true, eventName: true, eventType: true, status: true, date: true, guestCount: true, totalAmount: true,
      venue: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } }, createdBy: { select: { name: true } },
    },
    orderBy: { date: "asc" }, take: 500,
  });

  const ids = bookings.map((b) => b.id);
  const invoices = ids.length
    ? await prisma.invoice.findMany({ where: { bookingId: { in: ids } }, select: { bookingId: true, totalAmount: true, paidAmount: true, installments: { select: { label: true, status: true, dueDate: true } } } })
    : [];
  const invByBooking = new Map<string, (typeof invoices)[number]>();
  for (const inv of invoices) if (inv.bookingId) invByBooking.set(inv.bookingId, inv);

  const rows = bookings.map((b) => {
    const inv = invByBooking.get(b.id);
    const total = num(inv?.totalAmount) || num(b.totalAmount);
    const paid = num(inv?.paidAmount);
    const pctPaid = total > 0 ? Math.round((paid / total) * 100) : 0;
    const nextDue = inv?.installments
      ?.filter((i) => i.status !== "COMPLETED")
      .sort((a, b2) => a.dueDate.getTime() - b2.dueDate.getTime())[0];
    return {
      id: b.id, ref: b.bookingNumber, event: b.eventName, eventType: b.eventType, status: b.status,
      client: contactName(b.contact), eventDate: b.date ? b.date.toISOString() : null,
      hall: b.venue?.name ?? "—", guests: b.guestCount, tier: tierOf(total), total,
      pctPaid, owner: b.createdBy?.name ?? "—",
      nextMilestone: nextDue ? { label: nextDue.label, due: nextDue.dueDate.toISOString() } : null,
    };
  });

  return { success: true, data: { rows, count: rows.length } };
}

// ------------------------------------------------------------
// Revenue & collections (+ 20/60/20 milestone view)
// ------------------------------------------------------------
export async function getSalesRevenueCollections(params: Params): Promise<Result<unknown>> {
  const user = await requireSales();
  if (!user) return { success: false, error: "Unauthorized" };
  const range = resolveBdRange(params.rangeKey ?? "month", params.from, params.to);
  const inRange = { gte: range.start, lte: range.end };
  const empIds = params.employeeIds?.length ? params.employeeIds : null;

  const [confirmed, payments, openInvoices, installments] = await Promise.all([
    prisma.booking.findMany({ where: { status: "CONFIRMED", createdAt: inRange, ...(empIds ? { createdById: { in: empIds } } : {}) }, select: { totalAmount: true, decorCharges: true, otherServices: true } }),
    prisma.payment.findMany({ where: { status: "COMPLETED", paidAt: inRange }, select: { amount: true } }),
    prisma.invoice.findMany({ where: { status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } }, select: { balanceDue: true } }),
    prisma.installment.findMany({ where: { dueDate: inRange }, select: { label: true, amount: true, status: true } }),
  ]);

  const revenueBooked = confirmed.reduce((s, b) => s + num(b.totalAmount), 0);
  const upsellRevenue = confirmed.reduce((s, b) => s + num(b.decorCharges) + num(b.otherServices), 0);
  const advanceCollected = payments.reduce((s, p) => s + num(p.amount), 0);
  const pendingCollection = openInvoices.reduce((s, i) => s + num(i.balanceDue), 0);

  // 20/60/20 milestones — bucket installments by label keyword.
  const bucket = (kw: RegExp) => {
    const items = installments.filter((i) => kw.test(i.label.toLowerCase()));
    const due = items.reduce((s, i) => s + num(i.amount), 0);
    const paid = items.filter((i) => i.status === "COMPLETED").reduce((s, i) => s + num(i.amount), 0);
    return { due, paid, count: items.length };
  };
  const milestones = {
    advance: bucket(/advance|booking|20%/),
    part: bucket(/part|60%|15 day|balance 60/),
    final: bucket(/final|balance|2 hour|last/),
  };

  return { success: true, data: { revenueBooked, advanceCollected, pendingCollection, upsellRevenue, milestones, range: { label: range.label } } };
}

// ------------------------------------------------------------
// Follow-up & payment alerts (now-based)
// ------------------------------------------------------------
export async function getSalesFollowupAlerts(params: { employeeIds?: string[] | null }): Promise<Result<unknown>> {
  const user = await requireSales();
  if (!user) return { success: false, error: "Unauthorized" };
  const empIds = params.employeeIds?.length ? params.employeeIds : null;
  const now = new Date();
  const endToday = new Date(now); endToday.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  const [overdue, followups, stale] = await Promise.all([
    // Overdue payments: due date passed, balance remaining
    prisma.invoice.findMany({
      where: { status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] }, dueDate: { lt: now }, balanceDue: { gt: 0 }, ...(empIds ? { createdById: { in: empIds } } : {}) },
      select: { id: true, invoiceNumber: true, dueDate: true, balanceDue: true, createdBy: { select: { name: true } }, booking: { select: { eventName: true, contact: { select: { firstName: true, lastName: true } } } } },
      orderBy: { dueDate: "asc" }, take: 200,
    }),
    // Today's scheduled quote follow-ups (Lead.followUpDate)
    prisma.lead.findMany({
      where: { followUpDate: { gte: now, lte: endToday }, status: { notIn: ["WON", "LOST"] }, ...(empIds ? { assignedToId: { in: empIds } } : {}) },
      select: { id: true, followUpDate: true, contact: { select: { firstName: true, lastName: true } }, assignedTo: { select: { name: true } } },
      orderBy: { followUpDate: "asc" }, take: 200,
    }),
    // Bookings with balance but no payment activity in 7+ days
    prisma.invoice.findMany({
      where: { status: { in: ["SENT", "PARTIALLY_PAID"] }, balanceDue: { gt: 0 }, updatedAt: { lt: sevenDaysAgo }, bookingId: { not: null }, ...(empIds ? { createdById: { in: empIds } } : {}) },
      select: { id: true, invoiceNumber: true, balanceDue: true, updatedAt: true, createdBy: { select: { name: true } }, booking: { select: { eventName: true, contact: { select: { firstName: true, lastName: true } } } } },
      orderBy: { updatedAt: "asc" }, take: 200,
    }),
  ]);

  return {
    success: true,
    data: {
      overdue: overdue.map((i) => ({ id: i.id, ref: i.invoiceNumber, client: contactName(i.booking?.contact ?? null), event: i.booking?.eventName ?? "—", amount: num(i.balanceDue), when: i.dueDate.toISOString(), owner: i.createdBy?.name ?? "—" })),
      followups: followups.map((l) => ({ id: l.id, client: contactName(l.contact), when: l.followUpDate?.toISOString() ?? null, owner: l.assignedTo?.name ?? "—" })),
      stale: stale.map((i) => ({ id: i.id, ref: i.invoiceNumber, client: contactName(i.booking?.contact ?? null), event: i.booking?.eventName ?? "—", amount: num(i.balanceDue), when: i.updatedAt.toISOString(), owner: i.createdBy?.name ?? "—" })),
      counts: { overdue: overdue.length, followups: followups.length, stale: stale.length },
    },
  };
}

// ------------------------------------------------------------
// Lost booking analysis (+ 6-month win-rate trend)
// ------------------------------------------------------------
export async function getSalesLostAnalysis(params: Params): Promise<Result<unknown>> {
  const user = await requireSales();
  if (!user) return { success: false, error: "Unauthorized" };
  const range = resolveBdRange(params.rangeKey ?? "month", params.from, params.to);
  const inRange = { gte: range.start, lte: range.end };
  const empIds = params.employeeIds?.length ? params.employeeIds : null;

  const lostLeads = await prisma.lead.findMany({
    where: { status: "LOST", updatedAt: inRange, ...(empIds ? { assignedToId: { in: empIds } } : {}) },
    select: { id: true, lostReason: true, estimatedValue: true, eventType: true, contact: { select: { firstName: true, lastName: true } }, assignedTo: { select: { name: true } }, updatedAt: true },
    orderBy: { updatedAt: "desc" }, take: 500,
  });

  const rows = lostLeads.map((l) => ({
    id: l.id, client: contactName(l.contact), reason: l.lostReason?.trim() || "Unspecified",
    value: num(l.estimatedValue), eventType: l.eventType ?? "—", owner: l.assignedTo?.name ?? "—", lostOn: l.updatedAt.toISOString(),
  }));

  const byReason = new Map<string, { count: number; value: number }>();
  for (const r of rows) { const c = byReason.get(r.reason) ?? { count: 0, value: 0 }; c.count++; c.value += r.value; byReason.set(r.reason, c); }
  const reasons = [...byReason.entries()].map(([reason, v]) => ({ reason, count: v.count, value: v.value })).sort((a, b) => b.count - a.count);

  // 6-month win-rate trend (confirmed vs cancelled bookings by month)
  const now = new Date();
  const sixAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const [wonB, lostB] = await Promise.all([
    prisma.booking.findMany({ where: { status: "CONFIRMED", createdAt: { gte: sixAgo }, ...(empIds ? { createdById: { in: empIds } } : {}) }, select: { createdAt: true } }),
    prisma.booking.findMany({ where: { status: "CANCELLED", updatedAt: { gte: sixAgo }, ...(empIds ? { createdById: { in: empIds } } : {}) }, select: { updatedAt: true } }),
  ]);
  const mk = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const tmap = new Map<string, { won: number; lost: number }>();
  for (let i = 0; i < 6; i++) { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1)); tmap.set(mk(d), { won: 0, lost: 0 }); }
  for (const w of wonB) { const e = tmap.get(mk(w.createdAt)); if (e) e.won++; }
  for (const l of lostB) { const e = tmap.get(mk(l.updatedAt)); if (e) e.lost++; }
  const trend = [...tmap.entries()].map(([month, v]) => ({ month, won: v.won, lost: v.lost, winRate: v.won + v.lost ? Math.round((v.won / (v.won + v.lost)) * 100) : 0 }));

  return { success: true, data: { rows, reasons, trend, totalCount: rows.length, totalValue: rows.reduce((s, r) => s + r.value, 0), range: { label: range.label } } };
}
