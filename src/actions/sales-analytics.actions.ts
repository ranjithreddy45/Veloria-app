"use server";

// ============================================================
// Sales Analytics — dashboard + reports aggregation engine
// ------------------------------------------------------------
// Mirrors the BD analytics engine (acq-analytics.actions.ts) on the sales side:
// Leads → Site visits → Quotations → Advance → Bookings, plus upsell and the
// Velos sales-score leaderboard. Filtered by {rangeKey,from,to,employeeIds}.
// Additive: no schema change, reads existing data. Money = rupees.
//
// TERMINOLOGY: "Enquiry" = Contact (nav → /contacts); "Lead" = Lead (nav →
// /leads); an enquiry later becomes a lead. The `enquiries*` fields below are
// historical misnomers — they all count LEAD rows, and are kept under those
// names because /sales/reports reads them. The two honestly-named headline
// counts are `totals.leadsCreated` and `totals.enquiriesCreated`.
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

// Campaign = digital / paid / portal channels; cold = walk-in / phone / email /
// referral / other. Not exported (use-server rule).
const CAMPAIGN_SOURCES = new Set([
  "WEBSITE", "SOCIAL_MEDIA", "ADVERTISEMENT", "FACEBOOK_ADS", "GOOGLE_ADS",
  "INDIAMART", "JUSTDIAL", "WEDMEGOOD", "INSTAGRAM", "WHATSAPP",
]);

const SOURCE_LABEL: Record<string, string> = {
  WEBSITE: "Website", REFERRAL: "Referral", SOCIAL_MEDIA: "Social media", WALK_IN: "Walk-in",
  PHONE_INQUIRY: "Phone", EMAIL: "Email", EVENT: "Event", PARTNER: "Partner", ADVERTISEMENT: "Advertisement",
  FACEBOOK_ADS: "Facebook Ads", GOOGLE_ADS: "Google Ads", INDIAMART: "IndiaMART", JUSTDIAL: "JustDial",
  WEDMEGOOD: "WedMeGood", INSTAGRAM: "Instagram", WHATSAPP: "WhatsApp", OTHER: "Other",
};

const num = (x: unknown) => Number(x ?? 0) || 0;

export interface SalesEmployeeMetrics {
  userId: string;
  name: string;
  enquiriesCold: number;
  enquiriesCampaign: number;
  enquiriesTotal: number;
  siteVisits: number;
  quotationsSent: number;
  paymentLinksSent: number;
  advanceCollected: number;
  bookingsConfirmed: number;
  bookingsLost: number;
  upsellValue: number;
  revenue: number;
  salesScore: number;
}

export interface SalesRangeParams {
  rangeKey?: BdRangeKey;
  from?: string | null;
  to?: string | null;
  employeeIds?: string[] | null;
}

// ------------------------------------------------------------
// Sales executives (for the employee filter)
// ------------------------------------------------------------
export async function getSalesExecutives(): Promise<Result<{ id: string; name: string }[]>> {
  const user = await requireSales();
  if (!user) return { success: false, error: "Unauthorized" };

  const [byRole, leadOwners, bookingOwners] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ["SALES_EXEC", "SALES_HEAD"] }, isActive: true }, select: { id: true, name: true } }),
    prisma.lead.findMany({ where: { assignedToId: { not: null } }, distinct: ["assignedToId"], select: { assignedTo: { select: { id: true, name: true } } } }),
    prisma.booking.findMany({ distinct: ["createdById"], select: { createdBy: { select: { id: true, name: true } } } }),
  ]);

  const map = new Map<string, string>();
  for (const u of byRole) map.set(u.id, u.name ?? "Unnamed");
  for (const r of leadOwners) if (r.assignedTo) map.set(r.assignedTo.id, r.assignedTo.name ?? "Unnamed");
  for (const r of bookingOwners) if (r.createdBy) map.set(r.createdBy.id, r.createdBy.name ?? "Unnamed");

  const list = [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  return { success: true, data: list };
}

// ------------------------------------------------------------
// Main analytics aggregate
// ------------------------------------------------------------
export async function getSalesAnalytics(params: SalesRangeParams): Promise<Result<unknown>> {
  const user = await requireSales();
  if (!user) return { success: false, error: "Unauthorized" };

  const range = resolveBdRange(params.rangeKey ?? "month", params.from, params.to);
  const inRange = { gte: range.start, lte: range.end };
  const empIds = params.employeeIds && params.employeeIds.length ? params.employeeIds : null;
  const empSet = empIds ? new Set(empIds) : null;

  // Goal-gradient "beat last month": when viewing the current month, also fetch
  // last month's confirmed-booking revenue so the UI can show the remaining gap.
  // resolveBdRange("month") anchored 1ms before this month's IST start resolves
  // to the previous IST month window. Null for any other range.
  const prevMonthRange = range.key === "month" ? resolveBdRange("month", null, null, new Date(range.start.getTime() - 1)) : null;

  const [leads, siteVisits, quotes, payLinks, payments, confirmed, lostBookings, lostLeads, velos, lastMonthAgg, enquiriesCreated] = await Promise.all([
    prisma.lead.findMany({ where: { createdAt: inRange, ...(empIds ? { assignedToId: { in: empIds } } : {}) }, select: { source: true, status: true, assignedToId: true, createdById: true } }),
    prisma.siteVisitBooking.findMany({ where: { status: "COMPLETED", completedAt: inRange, ...(empIds ? { assignedToId: { in: empIds } } : {}) }, select: { assignedToId: true } }),
    prisma.salesQuotation.findMany({ where: { status: "SENT", sentAt: inRange, ...(empIds ? { sentById: { in: empIds } } : {}) }, select: { sentById: true, createdById: true } }),
    prisma.quoteShareLink.findMany({ where: { paymentLinkUrl: { not: null }, createdAt: inRange, ...(empIds ? { createdById: { in: empIds } } : {}) }, select: { createdById: true } }),
    prisma.payment.findMany({ where: { status: "COMPLETED", paidAt: inRange }, select: { amount: true, invoice: { select: { createdById: true, bookingId: true, booking: { select: { createdById: true } } } } } }),
    prisma.booking.findMany({ where: { status: "CONFIRMED", createdAt: inRange, ...(empIds ? { createdById: { in: empIds } } : {}) }, select: { id: true, contactId: true, createdById: true, createdAt: true, totalAmount: true, decorCharges: true, otherServices: true } }),
    prisma.booking.findMany({ where: { status: "CANCELLED", updatedAt: inRange, ...(empIds ? { createdById: { in: empIds } } : {}) }, select: { createdById: true, totalAmount: true } }),
    prisma.lead.findMany({ where: { status: "LOST", updatedAt: inRange, ...(empIds ? { assignedToId: { in: empIds } } : {}) }, select: { lostReason: true, estimatedValue: true } }),
    prisma.velosLedger.findMany({ where: { awardedAt: inRange, ...(empIds ? { userId: { in: empIds } } : {}) }, select: { userId: true, points: true } }),
    prevMonthRange
      ? prisma.booking.aggregate({ where: { status: "CONFIRMED", createdAt: { gte: prevMonthRange.start, lte: prevMonthRange.end }, ...(empIds ? { createdById: { in: empIds } } : {}) }, _sum: { totalAmount: true } })
      : Promise.resolve(null),
    // True enquiry count = Contact rows (nav "Enquiry" → /contacts). Distinct from
    // `leads` above, which are Lead rows. NOTE: Contact has no creator/owner column,
    // so this honours the date range ONLY — the employee filter cannot be applied
    // without inventing an ownership link. `deletedAt: null` matches the /contacts
    // list, which excludes soft-deleted enquiries.
    prisma.contact.count({ where: { createdAt: inRange, deletedAt: null } }),
  ]);

  const lastMonthRevenue: number | null = lastMonthAgg ? num(lastMonthAgg._sum.totalAmount) : null;

  const rows = new Map<string, SalesEmployeeMetrics>();
  const ensure = (id: string | null | undefined): SalesEmployeeMetrics | null => {
    if (!id) return null;
    if (empSet && !empSet.has(id)) return null;
    let r = rows.get(id);
    if (!r) {
      r = { userId: id, name: "", enquiriesCold: 0, enquiriesCampaign: 0, enquiriesTotal: 0, siteVisits: 0, quotationsSent: 0, paymentLinksSent: 0, advanceCollected: 0, bookingsConfirmed: 0, bookingsLost: 0, upsellValue: 0, revenue: 0, salesScore: 0 };
      rows.set(id, r);
    }
    return r;
  };

  const sourceCounts = new Map<string, number>();
  for (const l of leads) {
    const owner = l.assignedToId ?? l.createdById;
    const r = ensure(owner);
    sourceCounts.set(l.source, (sourceCounts.get(l.source) ?? 0) + 1);
    if (r) { r.enquiriesTotal++; if (CAMPAIGN_SOURCES.has(l.source)) r.enquiriesCampaign++; else r.enquiriesCold++; }
  }
  for (const s of siteVisits) { const r = ensure(s.assignedToId); if (r) r.siteVisits++; }
  for (const q of quotes) { const r = ensure(q.sentById ?? q.createdById); if (r) r.quotationsSent++; }
  for (const p of payLinks) { const r = ensure(p.createdById); if (r) r.paymentLinksSent++; }

  let advanceTotal = 0;
  const advanceBookingIds = new Set<string>();
  for (const p of payments) {
    const owner = p.invoice?.booking?.createdById ?? p.invoice?.createdById;
    const amt = num(p.amount);
    // Accumulate the total + funnel count only for owners that pass the employee
    // filter, so headline totals reconcile with the per-employee rows. (owner is
    // always present — Invoice.createdById is required — so the no-filter case
    // still counts every payment.)
    const r = ensure(owner);
    if (r) {
      r.advanceCollected += amt;
      advanceTotal += amt;
      if (p.invoice?.bookingId) advanceBookingIds.add(p.invoice.bookingId);
    }
  }

  let revenueBooked = 0, upsellTotal = 0;
  const bookingContactIds: string[] = [];
  const bookingCreatedAt: { contactId: string; createdAt: Date }[] = [];
  for (const b of confirmed) {
    const r = ensure(b.createdById);
    revenueBooked += num(b.totalAmount);
    const upsell = num(b.decorCharges) + num(b.otherServices);
    upsellTotal += upsell;
    if (r) { r.bookingsConfirmed++; r.upsellValue += upsell; r.revenue += num(b.totalAmount); }
    if (b.contactId) { bookingContactIds.push(b.contactId); bookingCreatedAt.push({ contactId: b.contactId, createdAt: b.createdAt }); }
  }

  let lostValue = 0;
  for (const b of lostBookings) { const r = ensure(b.createdById); if (r) r.bookingsLost++; lostValue += num(b.totalAmount); }

  const lossReasonAgg = new Map<string, { count: number; value: number }>();
  for (const l of lostLeads) {
    const key = (l.lostReason?.trim() || "Unspecified");
    const cur = lossReasonAgg.get(key) ?? { count: 0, value: 0 };
    cur.count++; cur.value += num(l.estimatedValue); lossReasonAgg.set(key, cur);
  }

  for (const p of velos) { const r = ensure(p.userId); if (r) r.salesScore += p.points; }

  // Names
  const ids = [...rows.keys()];
  if (ids.length) {
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const nameMap = new Map(users.map((u) => [u.id, u.name ?? "Unnamed"]));
    for (const r of rows.values()) r.name = nameMap.get(r.userId) ?? "Unknown";
  }
  const employees = [...rows.values()].sort((x, y) => y.enquiriesTotal - x.enquiriesTotal);

  // avg days enquiry → booking (join confirmed bookings to earliest lead for same contact)
  let avgDaysEnquiryToBooking: number | null = null;
  if (bookingContactIds.length) {
    const relatedLeads = await prisma.lead.findMany({ where: { contactId: { in: bookingContactIds } }, select: { contactId: true, createdAt: true } });
    const minLead = new Map<string, number>();
    for (const l of relatedLeads) {
      const t = l.createdAt.getTime();
      const cur = minLead.get(l.contactId);
      if (cur === undefined || t < cur) minLead.set(l.contactId, t);
    }
    const diffs: number[] = [];
    for (const b of bookingCreatedAt) {
      const lead = minLead.get(b.contactId);
      if (lead !== undefined) { const d = (b.createdAt.getTime() - lead) / 86400000; if (d >= 0) diffs.push(d); }
    }
    if (diffs.length) avgDaysEnquiryToBooking = Math.round((diffs.reduce((s, d) => s + d, 0) / diffs.length) * 10) / 10;
  }

  const sum = (f: (r: SalesEmployeeMetrics) => number) => employees.reduce((s, r) => s + f(r), 0);
  const totals = {
    enquiriesCold: sum((r) => r.enquiriesCold), enquiriesCampaign: sum((r) => r.enquiriesCampaign), enquiriesTotal: sum((r) => r.enquiriesTotal),
    siteVisits: sum((r) => r.siteVisits), quotationsSent: sum((r) => r.quotationsSent), paymentLinksSent: sum((r) => r.paymentLinksSent),
    advanceCollected: advanceTotal, bookingsConfirmed: sum((r) => r.bookingsConfirmed), bookingsLost: sum((r) => r.bookingsLost),
    upsellValue: upsellTotal, salesScore: sum((r) => r.salesScore), revenueBooked, lostValue,
    // Two unambiguous headline counts. `enquiriesTotal`/`enquiriesCold`/
    // `enquiriesCampaign` above are Lead-derived (kept as-is: /sales/reports reads
    // them); these two name what they actually count.
    leadsCreated: leads.length,   // Lead rows: createdAt in range + assignedToId in empIds
    enquiriesCreated,             // Contact rows: createdAt in range only (no owner column)
  };

  // Funnel (cross-stage counts in range)
  const funnel = [
    // Label says "Leads" because this stage counts Lead rows. Key kept as
    // "enquiries" for stability (other consumers may match on it).
    { key: "enquiries", label: "Leads", count: leads.length },
    { key: "siteVisit", label: "Site Visit Done", count: siteVisits.length },
    { key: "quotation", label: "Quotation Sent", count: quotes.length },
    { key: "advance", label: "Advance Collected", count: advanceBookingIds.size },
    { key: "confirmed", label: "Booking Confirmed", count: confirmed.length },
    { key: "lost", label: "Lost", count: lostBookings.length + lostLeads.length },
  ];

  const leadSources = [...sourceCounts.entries()].map(([source, count]) => ({ source, label: SOURCE_LABEL[source] ?? source, count })).sort((a, b) => b.count - a.count);
  const lossReasons = [...lossReasonAgg.entries()].map(([reason, v]) => ({ reason, label: reason, count: v.count, value: v.value })).sort((a, b) => b.count - a.count);
  const leaderboard = [...employees].map((r) => ({ userId: r.userId, name: r.name, salesScore: r.salesScore })).sort((a, b) => b.salesScore - a.salesScore);

  const enquiryToBooking = totals.enquiriesTotal ? totals.bookingsConfirmed / totals.enquiriesTotal : 0;
  const closed = totals.bookingsConfirmed + totals.bookingsLost;
  const winRate = closed ? totals.bookingsConfirmed / closed : 0;
  const avgUpsellPerBooking = totals.bookingsConfirmed ? Math.round(totals.upsellValue / totals.bookingsConfirmed) : 0;

  return {
    success: true,
    data: {
      range: { key: range.key, label: range.label, from: range.fromDate, to: range.toDate },
      totals, employees, leaderboard, leadSources, funnel, lossReasons,
      conversion: { enquiryToBooking, winRate }, avgDaysEnquiryToBooking, avgUpsellPerBooking,
      lastMonthRevenue,
    },
  };
}
