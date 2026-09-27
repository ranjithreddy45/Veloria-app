"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize, type Serialized } from "@/lib/utils";
import { COLLECTIBLE_INVOICE_STATUSES } from "@/lib/finance/issued-invoices";
import { subMonths, format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { istDateOnly, istDayWindow, istMonthWindow, istWeekWindow } from "@/lib/home/ist";
import { getAvailabilityGrid, type VenueRow } from "@/actions/availability.actions";
import { getLeaderboard } from "@/actions/velos.actions";

// ============================================================
// Types for Full Pixel-Perfect Dashboard
// ============================================================

export type DashboardFullData = {
  user: {
    name: string;
    role: string;
  };
  asOf: string;
  todayFormatted: string;

  // 1. Top 5 KPI Metrics
  kpis: {
    cashCollected: {
      amount: number;
      changePercent: number;
    };
    bookedValue: {
      amount: number;
      changePercent: number;
    };
    overdue: {
      amount: number;
      count: number;
    };
    openLeads: {
      count: number;
      breachedCount: number;
    };
    eventsThisWeek: {
      total: number;
      todayCount: number;
      upcomingCount: number;
    };
  };

  // 2. Revenue Trend (12 Months)
  revenueTrend: Array<{
    monthKey: string;
    month: string;
    booked: number;
    collected: number;
  }>;

  // 3. Lead Pipeline (by Period)
  leadPipeline: Record<
    "This Month" | "This Quarter" | "This Year" | "All Time",
    {
      total: number;
      stages: Array<{
        stage: string;
        label: string;
        count: number;
        percentage: number;
        color: string;
      }>;
    }
  >;

  // 4. Bookings by Event Type (by Period)
  bookingsByType: Record<
    "This Month" | "This Quarter" | "This Year" | "All Time",
    {
      total: number;
      types: Array<{
        type: string;
        count: number;
        percentage: number;
        fill: string;
      }>;
    }
  >;

  // 5. Needs You Now (Attention Feed)
  attentionItems: Array<{
    id: string;
    badge: "URGENT" | "TODAY" | "WARNING";
    title: string;
    subtitle: string;
    actionLabel: string;
    actionHref: string;
    actionType: "respond" | "reminder" | "review";
  }>;

  // 6. Today's Events
  todaysEvents: Array<{
    id: string;
    bookingNumber: string;
    eventName: string;
    timeSlot: string;
    formattedTime: string;
    hall: string;
    guestCount: number;
    status: string;
    statusBadgeText: string;
    statusTone: "success" | "info" | "warning" | "neutral";
    image: string;
  }>;

  // 7. Hall Occupancy Today
  hallOccupancy: Array<{
    venueId: string;
    venueName: string;
    morning: { status: string; label: string | null; bookingId: string | null };
    evening: { status: string; label: string | null; bookingId: string | null };
    fullDay: { status: string; label: string | null; bookingId: string | null };
  }>;

  // 8. Team Performance (Velos)
  velosLeaderboard: Array<{
    userId: string;
    name: string;
    image: string | null;
    points: number;
    rank: number;
  }>;

  // 9. Receivables & Overdue Invoices
  overdueInvoices: Array<{
    id: string;
    invoiceNumber: string;
    clientName: string;
    balanceDue: number;
    dueDateFormatted: string;
  }>;

  // 10. Pending Payment Proofs
  pendingPaymentProofs: Array<{
    id: string;
    clientName: string;
    amount: number;
    uploadedAgo: string;
    receiptUrl: string | null;
  }>;
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

function istStartOfMonth(istShifted: Date): Date {
  const y = istShifted.getUTCFullYear();
  const m = istShifted.getUTCMonth();
  return new Date(Date.UTC(y, m, 1, 0, 0, 0, 0) - IST_OFFSET_MS);
}

function istEndOfMonth(istShifted: Date): Date {
  const y = istShifted.getUTCFullYear();
  const m = istShifted.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS - 1);
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  Wedding: "#ec4899",            // Pink
  Reception: "#a855f7",          // Purple
  "Corporate Event": "#3b82f6",  // Blue
  Corporate: "#3b82f6",          // Blue
  "Birthday Party": "#f59e0b",   // Amber
  Birthday: "#f59e0b",           // Amber
  "1st Birthday": "#f59e0b",     // Amber
  "1 st Birthday": "#f59e0b",    // Amber
  "Son's Birthday": "#f59e0b",   // Amber
  Anniversary: "#ef4444",        // Red
  Engagement: "#06b6d4",         // Cyan
  "Daughter Engagement": "#06b6d4", // Cyan
  "Baby Shower": "#10b981",      // Emerald
  Haldi: "#eab308",              // Yellow
  "Half Saree": "#8b5cf6",       // Violet
  "Get Together": "#14b8a6",     // Teal
  "Social Gathering": "#8b5cf6", // Indigo
  Event: "#6366f1",              // Royal Indigo
  Other: "#64748b",              // Slate
  Others: "#64748b",             // Slate
};

const PIPELINE_STAGE_COLORS: Record<string, string> = {
  NEW: "#6366f1",         // Indigo / Royal Blue
  CONTACTED: "#38bdf8",   // Bright Cyan / Sky Blue
  QUALIFIED: "#a855f7",   // Violet / Light Purple
  PROPOSAL_SENT: "#8b5cf6", // Deep Purple
  NEGOTIATION: "#f97316", // Coral Orange
  WON: "#10b981",         // Emerald Green
};

const VENUE_THUMBNAILS: Record<string, string> = {
  "Grand Hall": "/images/venues/grand.jpg",
  "Emerald Hall": "/images/venues/emerald.jpg",
  "Crystal Hall": "/images/venues/crystal.jpg",
  "Lotus Hall": "/images/venues/lotus.jpg",
};

export async function getDashboardFullData(): Promise<Serialized<DashboardFullData> | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const role = (session.user as { role?: string }).role ?? "";
  if (!hasPermission(role, "dashboard:read")) return null;

  const userName = session.user.name ?? "Team Member";
  const now = new Date();
  const nowIst = istNow();
  const todayDate = istDateOnly(now);
  const day = istDayWindow(now);
  const week = istWeekWindow(now);
  const month = istMonthWindow(now);
  const lastMonth = istMonthWindow(now, -1);

  const todayFormatted = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  }).format(now);

  const isoToday = format(now, "yyyy-MM-dd");

  // Parallel database queries
  const [
    thisMonthCashAgg,
    lastMonthCashAgg,
    thisMonthBookedAgg,
    lastMonthBookedAgg,
    overdueInvoicesAgg,
    openLeadsCount,
    slaBreachedCount,
    eventsTodayCount,
    eventsThisWeekCount,
    last12MonthsPayments,
    last12MonthsBookings,
    leadPipelineRaw,
    bookingsByTypeRaw,
    slaBreachedLeads,
    overdueInvoicesList,
    pendingQuoteApprovals,
    expiringHoldsToday,
    todaysEventsList,
    availabilityGridRes,
    leaderboardRes,
    pendingProofsList,
  ] = await Promise.all([
    // 1. Cash Collected MTD
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "COMPLETED", paidAt: { gte: month.start, lt: month.end } },
    }),
    // Cash Collected Last Month
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "COMPLETED", paidAt: { gte: lastMonth.start, lt: lastMonth.end } },
    }),

    // 2. Booked Value MTD
    prisma.booking.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
        createdAt: { gte: month.start, lt: month.end },
      },
    }),
    // Booked Value Last Month
    prisma.booking.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
        createdAt: { gte: lastMonth.start, lt: lastMonth.end },
      },
    }),

    // 3. Overdue Invoices aggregate
    prisma.invoice.aggregate({
      _sum: { balanceDue: true },
      _count: { _all: true },
      where: { status: "OVERDUE", balanceDue: { gt: 0 } },
    }),

    // 4. Open Leads Count
    prisma.lead.count({
      where: { deletedAt: null, status: { notIn: ["WON", "LOST"] } },
    }),
    // SLA Breached Leads Count
    prisma.lead.count({
      where: {
        deletedAt: null,
        status: { in: ["NEW", "CONTACTED"] },
        firstRespondedAt: null,
        firstContactDue: { not: null, lt: now },
      },
    }),

    // 5. Events Today & This Week
    prisma.booking.count({
      where: {
        status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
        date: { gte: day.start, lt: day.end },
      },
    }),
    prisma.booking.count({
      where: {
        status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
        date: { gte: week.start, lt: week.end },
      },
    }),

    // 6. Revenue Trend (Last 12 Months)
    prisma.payment.findMany({
      where: {
        status: "COMPLETED",
        paidAt: { gte: istStartOfMonth(subMonths(nowIst, 11)) },
      },
      select: { amount: true, paidAt: true },
      take: 5000,
    }),
    prisma.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
        createdAt: { gte: istStartOfMonth(subMonths(nowIst, 11)) },
      },
      select: { totalAmount: true, createdAt: true },
      take: 5000,
    }),

    // 7. Lead Pipeline Stage Breakdown (with createdAt for time period filtering)
    prisma.lead.findMany({
      where: { deletedAt: null },
      select: { status: true, createdAt: true },
      take: 10000,
    }),

    // 8. Bookings by Event Type (with createdAt for time period filtering)
    prisma.booking.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { eventType: true, createdAt: true },
      take: 10000,
    }),

    // 9. Needs You Now - SLA breaches
    prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: { in: ["NEW", "CONTACTED"] },
        firstRespondedAt: null,
        firstContactDue: { not: null, lt: now },
      },
      orderBy: { firstContactDue: "asc" },
      take: 3,
      select: {
        id: true,
        title: true,
        firstContactDue: true,
        contact: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { name: true } },
      },
    }),

    // Overdue Invoices List (top 4)
    prisma.invoice.findMany({
      where: { status: "OVERDUE", balanceDue: { gt: 0 } },
      orderBy: { dueDate: "asc" },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        balanceDue: true,
        dueDate: true,
        contact: { select: { firstName: true, lastName: true } },
      },
    }),

    // Pending Quote Approvals
    prisma.salesQuotation.findMany({
      where: { status: "PENDING_APPROVAL" },
      orderBy: { submittedAt: "asc" },
      take: 3,
      select: {
        id: true,
        quoteNumber: true,
        clientName: true,
        grandTotal: true,
        submittedBy: { select: { name: true } },
      },
    }),

    // Expiring Holds Today
    prisma.booking.findMany({
      where: { status: "HOLD", holdExpiresAt: { gte: now, lt: day.end } },
      orderBy: { holdExpiresAt: "asc" },
      take: 2,
      select: { id: true, eventName: true, contact: { select: { firstName: true, lastName: true } } },
    }),

    // 10. Today's Events List
    prisma.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
        date: { gte: day.start, lt: day.end },
      },
      orderBy: [{ timeSlot: "asc" }, { bookingNumber: "asc" }],
      take: 6,
      select: {
        id: true,
        bookingNumber: true,
        eventName: true,
        timeSlot: true,
        guestCount: true,
        hallBooked: true,
        status: true,
        venue: { select: { name: true } },
        bookingMenu: { select: { id: true } },
      },
    }),

    // 11. Hall Availability Grid for Today
    getAvailabilityGrid(isoToday),

    // 12. Velos Leaderboard
    getLeaderboard(),

    // 13. Pending Payment Proofs
    prisma.payment.findMany({
      where: {
        status: "PENDING",
        receiptUrl: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        amount: true,
        createdAt: true,
        receiptUrl: true,
        invoice: { select: { contact: { select: { firstName: true, lastName: true } } } },
      },
    }),
  ]);

  // Calculations: KPIs
  const cashThis = Number(thisMonthCashAgg._sum.amount ?? 0);
  const cashLast = Number(lastMonthCashAgg._sum.amount ?? 0);
  const cashChangePct = cashLast > 0 ? ((cashThis - cashLast) / cashLast) * 100 : cashThis > 0 ? 100 : 0;

  const bookedThis = Number(thisMonthBookedAgg._sum.totalAmount ?? 0);
  const bookedLast = Number(lastMonthBookedAgg._sum.totalAmount ?? 0);
  const bookedChangePct = bookedLast > 0 ? ((bookedThis - bookedLast) / bookedLast) * 100 : bookedThis > 0 ? 100 : 0;

  const overdueTotal = Number(overdueInvoicesAgg._sum.balanceDue ?? 0);
  const overdueCount = overdueInvoicesAgg._count._all;

  const upcomingCount = Math.max(0, eventsThisWeekCount - eventsTodayCount);

  // Revenue Trend 12 Months Map
  const istMonthKey = (d: Date) => format(new Date(d.getTime() + IST_OFFSET_MS), "yyyy-MM");
  const monthBuckets = new Map<string, { month: string; booked: number; collected: number }>();

  for (let i = 11; i >= 0; i--) {
    const d = subMonths(now, i);
    const key = istMonthKey(d);
    const monthLabel = format(d, "MMM");
    monthBuckets.set(key, { month: monthLabel, booked: 0, collected: 0 });
  }

  for (const p of last12MonthsPayments) {
    if (p.paidAt) {
      const key = istMonthKey(p.paidAt);
      const b = monthBuckets.get(key);
      if (b) b.collected += Number(p.amount);
    }
  }

  for (const b of last12MonthsBookings) {
    if (b.createdAt) {
      const key = istMonthKey(b.createdAt);
      const item = monthBuckets.get(key);
      if (item) item.booked += Number(b.totalAmount);
    }
  }

  const revenueTrend = Array.from(monthBuckets.entries()).map(([key, data]) => ({
    monthKey: key,
    month: data.month,
    booked: Math.round(data.booked),
    collected: Math.round(data.collected),
  }));

  // Time period boundaries (IST shifted)
  const sShifted = new Date(now.getTime() + IST_OFFSET_MS);
  const currYear = sShifted.getUTCFullYear();
  const currMonth = sShifted.getUTCMonth();

  const monthStart = new Date(Date.UTC(currYear, currMonth, 1) - IST_OFFSET_MS);
  const qMonth = Math.floor(currMonth / 3) * 3;
  const quarterStart = new Date(Date.UTC(currYear, qMonth, 1) - IST_OFFSET_MS);
  const yearStart = new Date(Date.UTC(currYear, 0, 1) - IST_OFFSET_MS);

  const timePeriods: Array<"This Month" | "This Quarter" | "This Year" | "All Time"> = [
    "This Month",
    "This Quarter",
    "This Year",
    "All Time",
  ];

  const stageOrder = [
    { stage: "NEW", label: "New Leads", statuses: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"] },
    { stage: "CONTACTED", label: "Contacted", statuses: ["CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"] },
    { stage: "QUALIFIED", label: "Qualified", statuses: ["QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"] },
    { stage: "PROPOSAL_SENT", label: "Proposal Sent", statuses: ["PROPOSAL_SENT", "NEGOTIATION", "WON"] },
    { stage: "NEGOTIATION", label: "Negotiation", statuses: ["NEGOTIATION", "WON"] },
    { stage: "WON", label: "Won", statuses: ["WON"] },
  ];

  // 1. Compute Lead Pipeline per Period
  const leadPipeline = {} as DashboardFullData["leadPipeline"];

  for (const period of timePeriods) {
    let filteredLeads = leadPipelineRaw;
    if (period === "This Month") {
      filteredLeads = leadPipelineRaw.filter((l) => l.createdAt && new Date(l.createdAt) >= monthStart);
    } else if (period === "This Quarter") {
      filteredLeads = leadPipelineRaw.filter((l) => l.createdAt && new Date(l.createdAt) >= quarterStart);
    } else if (period === "This Year") {
      filteredLeads = leadPipelineRaw.filter((l) => l.createdAt && new Date(l.createdAt) >= yearStart);
    }

    const map = new Map<string, number>();
    for (const l of filteredLeads) {
      map.set(l.status, (map.get(l.status) || 0) + 1);
    }

    const totalLeads = filteredLeads.length;
    const topCount = stageOrder[0].statuses.reduce((sum, st) => sum + (map.get(st) || 0), 0);
    const denominator = topCount > 0 ? topCount : 1;

    const stages = stageOrder.map((s) => {
      const count = s.statuses.reduce((sum, st) => sum + (map.get(st) || 0), 0);
      const percentage = Math.round((count / denominator) * 100);
      return {
        stage: s.stage,
        label: s.label,
        count,
        percentage,
        color: PIPELINE_STAGE_COLORS[s.stage] ?? "#3b82f6",
      };
    });

    leadPipeline[period] = { total: totalLeads, stages };
  }

  // 2. Compute Bookings by Event Type per Period
  const bookingsByType = {} as DashboardFullData["bookingsByType"];

  for (const period of timePeriods) {
    let filteredBookings = bookingsByTypeRaw;
    if (period === "This Month") {
      filteredBookings = bookingsByTypeRaw.filter((b) => b.createdAt && new Date(b.createdAt) >= monthStart);
    } else if (period === "This Quarter") {
      filteredBookings = bookingsByTypeRaw.filter((b) => b.createdAt && new Date(b.createdAt) >= quarterStart);
    } else if (period === "This Year") {
      filteredBookings = bookingsByTypeRaw.filter((b) => b.createdAt && new Date(b.createdAt) >= yearStart);
    }

    const typeMap = new Map<string, number>();
    for (const b of filteredBookings) {
      const rawType = (b.eventType || "Other").trim().replace(/^1\s+st\b/i, "1st");
      typeMap.set(rawType, (typeMap.get(rawType) || 0) + 1);
    }

    const totalBookings = filteredBookings.length;
    const sortedTypes = Array.from(typeMap.entries()).sort((a, b) => b[1] - a[1]);

    const types = sortedTypes.map(([typeStr, count]) => {
      const percentage = totalBookings > 0 ? Math.round((count / totalBookings) * 100) : 0;
      return {
        type: typeStr,
        count,
        percentage,
        fill: EVENT_TYPE_COLORS[typeStr] || "#8b5cf6",
      };
    });

    bookingsByType[period] = { total: totalBookings, types };
  }

  // Needs You Now Attention Feed
  const attentionItems: DashboardFullData["attentionItems"] = [];

  // 1. SLA Breaches
  for (const l of slaBreachedLeads) {
    const clientName = `${l.contact?.firstName ?? ""} ${l.contact?.lastName ?? ""}`.trim() || "Lead";
    const daysOverdue = Math.max(1, Math.floor((now.getTime() - new Date(l.firstContactDue!).getTime()) / (1000 * 60 * 60 * 24)));
    attentionItems.push({
      id: `sla-${l.id}`,
      badge: "URGENT",
      title: `${clientName} has waited ${daysOverdue} days past the first-response deadline`,
      subtitle: `Assigned to ${l.assignedTo?.name ?? "Unassigned"}`,
      actionLabel: "Respond now",
      actionHref: `/leads/${l.id}`,
      actionType: "respond",
    });
  }

  // 2. Overdue Invoices in Attention
  for (const inv of overdueInvoicesList.slice(0, 2)) {
    const clientName = `${inv.contact?.firstName ?? ""} ${inv.contact?.lastName ?? ""}`.trim() || "Client";
    const dueFormatted = format(new Date(inv.dueDate), "d MMM");
    attentionItems.push({
      id: `inv-${inv.id}`,
      badge: "URGENT",
      title: `₹${Number(inv.balanceDue).toLocaleString("en-IN")} overdue from ${clientName}`,
      subtitle: `${inv.invoiceNumber} · due ${dueFormatted}`,
      actionLabel: "Send reminder",
      actionHref: `/invoices/${inv.id}`,
      actionType: "reminder",
    });
  }

  // 3. Pending Quote Approvals
  for (const q of pendingQuoteApprovals) {
    attentionItems.push({
      id: `quote-${q.id}`,
      badge: "TODAY",
      title: `Quotation ${q.quoteNumber} is waiting for your approval`,
      subtitle: `${q.clientName} · ₹${Number(q.grandTotal).toLocaleString("en-IN")} · raised by ${q.submittedBy?.name ?? "Rep"}`,
      actionLabel: "Review",
      actionHref: `/approvals/quotes`,
      actionType: "review",
    });
  }

  // Today's Events Timeline
  const formattedEvents: DashboardFullData["todaysEvents"] = todaysEventsList.map((b) => {
    let slotTime = "09:00 AM";
    if (b.timeSlot === "AFTERNOON") slotTime = "12:00 PM";
    if (b.timeSlot === "EVENING") slotTime = "05:00 PM";
    if (b.timeSlot === "FULL_DAY") slotTime = "09:00 AM";

    let badgeText = "Confirmed";
    let badgeTone: "success" | "info" | "warning" | "neutral" = "success";

    if (b.status === "IN_PROGRESS") {
      badgeText = "In Progress";
      badgeTone = "info";
    } else if (b.bookingMenu) {
      badgeText = "Catering Ready";
      badgeTone = "success";
    } else {
      badgeText = "Kitchen Preparing";
      badgeTone = "warning";
    }

    const hallName = b.hallBooked || b.venue?.name || "Main Hall";

    return {
      id: b.id,
      bookingNumber: b.bookingNumber,
      eventName: b.eventName,
      timeSlot: b.timeSlot,
      formattedTime: slotTime,
      hall: `${hallName} · ${b.guestCount} guests`,
      guestCount: b.guestCount,
      status: b.status,
      statusBadgeText: badgeText,
      statusTone: badgeTone,
      image: VENUE_THUMBNAILS[hallName] || "/images/venues/grand.jpg",
    };
  });

  // Hall Occupancy Matrix
  const hallOccupancy: DashboardFullData["hallOccupancy"] = [];
  if (availabilityGridRes.success && availabilityGridRes.data) {
    for (const v of availabilityGridRes.data) {
      const mSlot = v.slots["MORNING"] ?? { status: "FREE", label: null, bookingId: null };
      const eSlot = v.slots["EVENING"] ?? { status: "FREE", label: null, bookingId: null };
      const fSlot = v.slots["FULL_DAY"] ?? { status: "FREE", label: null, bookingId: null };

      hallOccupancy.push({
        venueId: v.venueId,
        venueName: v.venueName,
        morning: { status: mSlot.status, label: mSlot.label, bookingId: mSlot.bookingId },
        evening: { status: eSlot.status, label: eSlot.label, bookingId: eSlot.bookingId },
        fullDay: { status: fSlot.status, label: fSlot.label, bookingId: fSlot.bookingId },
      });
    }
  }

  // Velos Leaderboard
  const velosLeaderboard = (leaderboardRes.rows ?? []).slice(0, 5).map((r, i) => ({
    userId: r.userId,
    name: r.name,
    image: r.image,
    points: r.points,
    rank: i + 1,
  }));

  // Receivables Overdue Invoices List
  const formattedOverdueInvoices: DashboardFullData["overdueInvoices"] = overdueInvoicesList.map((inv) => {
    const clientName = `${inv.contact?.firstName ?? ""} ${inv.contact?.lastName ?? ""}`.trim() || "Client";
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientName,
      balanceDue: Number(inv.balanceDue),
      dueDateFormatted: format(new Date(inv.dueDate), "d MMM"),
    };
  });

  // Pending Payment Proofs
  const formattedPaymentProofs: DashboardFullData["pendingPaymentProofs"] = pendingProofsList.map((p) => {
    const contact = p.invoice?.contact;
    const clientName = contact ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() : "Client";
    const uploadedMs = now.getTime() - new Date(p.createdAt).getTime();
    const hours = Math.max(1, Math.floor(uploadedMs / (1000 * 60 * 60)));
    const uploadedAgo = hours > 24 ? `${Math.floor(hours / 24)} days ago` : `${hours} hrs ago`;

    return {
      id: p.id,
      clientName,
      amount: Number(p.amount),
      uploadedAgo: `Uploaded ${uploadedAgo}`,
      receiptUrl: p.receiptUrl,
    };
  });

  return serialize({
    user: {
      name: userName,
      role,
    },
    asOf: now.toISOString(),
    todayFormatted,
    kpis: {
      cashCollected: {
        amount: cashThis,
        changePercent: Math.round(cashChangePct * 10) / 10,
      },
      bookedValue: {
        amount: bookedThis,
        changePercent: Math.round(bookedChangePct * 10) / 10,
      },
      overdue: {
        amount: overdueTotal,
        count: overdueCount,
      },
      openLeads: {
        count: openLeadsCount,
        breachedCount: slaBreachedCount,
      },
      eventsThisWeek: {
        total: eventsThisWeekCount,
        todayCount: eventsTodayCount,
        upcomingCount: upcomingCount,
      },
    },
    revenueTrend,
    leadPipeline,
    bookingsByType,
    attentionItems,
    todaysEvents: formattedEvents,
    hallOccupancy,
    velosLeaderboard,
    overdueInvoices: formattedOverdueInvoices,
    pendingPaymentProofs: formattedPaymentProofs,
  });
}

export async function getHallOccupancyForDate(dateISO: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const availabilityGridRes = await getAvailabilityGrid(dateISO);
  if (!availabilityGridRes.success) {
    return { success: false, error: availabilityGridRes.error || "Failed to fetch grid" };
  }

  const hallOccupancy = availabilityGridRes.data.map((v) => {
    const mSlot = v.slots["MORNING"] ?? { status: "FREE", label: null, bookingId: null };
    const eSlot = v.slots["EVENING"] ?? { status: "FREE", label: null, bookingId: null };
    const fSlot = v.slots["FULL_DAY"] ?? { status: "FREE", label: null, bookingId: null };

    return {
      venueId: v.venueId,
      venueName: v.venueName,
      morning: { status: mSlot.status, label: mSlot.label, bookingId: mSlot.bookingId },
      evening: { status: eSlot.status, label: eSlot.label, bookingId: eSlot.bookingId },
      fullDay: { status: fSlot.status, label: fSlot.label, bookingId: fSlot.bookingId },
    };
  });

  return { success: true, data: serialize(hallOccupancy) };
}

export async function getEventsForDate(dateISO: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const parts = dateISO.split("-").map(Number);
  const yyyy = parts[0] || new Date().getFullYear();
  const mm = parts[1] || new Date().getMonth() + 1;
  const dd = parts[2] || new Date().getDate();

  const startMs = Date.UTC(yyyy, mm - 1, dd) - IST_OFFSET_MS;
  const dayStart = new Date(startMs);
  const dayEnd = new Date(startMs + 24 * 60 * 60 * 1000);
  const utcDateStart = new Date(Date.UTC(yyyy, mm - 1, dd));
  const utcDateEnd = new Date(Date.UTC(yyyy, mm - 1, dd + 1));

  const events = await prisma.booking.findMany({
    where: {
      status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
      OR: [
        { date: { gte: dayStart, lt: dayEnd } },
        { date: { gte: utcDateStart, lt: utcDateEnd } },
      ],
    },
    orderBy: [{ timeSlot: "asc" }, { bookingNumber: "asc" }],
    take: 10,
    select: {
      id: true,
      bookingNumber: true,
      eventName: true,
      timeSlot: true,
      guestCount: true,
      hallBooked: true,
      status: true,
      venue: { select: { name: true } },
      bookingMenu: { select: { id: true } },
    },
  });

  const formattedEvents: DashboardFullData["todaysEvents"] = events.map((b) => {
    let slotTime = "09:00 AM";
    if (b.timeSlot === "AFTERNOON") slotTime = "12:00 PM";
    if (b.timeSlot === "EVENING") slotTime = "05:00 PM";
    if (b.timeSlot === "FULL_DAY") slotTime = "09:00 AM";

    let badgeText = "Confirmed";
    let badgeTone: "success" | "info" | "warning" | "neutral" = "success";

    if (b.status === "IN_PROGRESS") {
      badgeText = "In Progress";
      badgeTone = "info";
    } else if (b.bookingMenu) {
      badgeText = "Catering Ready";
      badgeTone = "success";
    } else {
      badgeText = "Kitchen Preparing";
      badgeTone = "warning";
    }

    const hallName = b.hallBooked || b.venue?.name || "Main Hall";

    return {
      id: b.id,
      bookingNumber: b.bookingNumber,
      eventName: b.eventName,
      timeSlot: b.timeSlot,
      formattedTime: slotTime,
      hall: `${hallName} · ${b.guestCount} guests`,
      guestCount: b.guestCount,
      status: b.status,
      statusBadgeText: badgeText,
      statusTone: badgeTone,
      image: VENUE_THUMBNAILS[hallName] || "/images/venues/grand.jpg",
    };
  });

  return { success: true, data: serialize(formattedEvents) };
}

