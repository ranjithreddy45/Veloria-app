"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize, type Serialized } from "@/lib/utils";
import { subMonths, format, addDays } from "date-fns";

// ============================================================
// Types
// ============================================================

export type MonthlyRevenue = {
  month: string;
  revenue: number;
};

export type BookingsByType = {
  type: string;
  count: number;
  fill: string;
};

export type UpcomingEvent = {
  id: string;
  bookingNumber: string;
  eventName: string;
  eventType: string;
  date: Date;
  timeSlot: string;
  guestCount: number;
  status: string;
  venue: { name: string };
  contact: { firstName: string; lastName: string; phone: string | null };
};

export type OverduePayment = {
  id: string;
  invoiceNumber: string;
  dueDate: Date;
  balanceDue: number;
  contact: { firstName: string; lastName: string };
};

export type OverdueTask = {
  id: string;
  title: string;
  dueDate: Date;
  priority: string;
  assignee: { name: string | null } | null;
};

export type DashboardStats = {
  revenue: {
    thisMonth: number;
    lastMonth: number;
    changePercent: number;
  };
  bookings: {
    active: number;
    thisMonth: number;
    changePercent: number;
  };
  leads: {
    newThisMonth: number;
    conversionRate: number;
    changePercent: number;
  };
  tasks: {
    pending: number;
    overdue: number;
    total: number;
  };
  upcomingEvents: UpcomingEvent[];
  overduePayments: OverduePayment[];
  overdueTasks: OverdueTask[];
  monthlyRevenue: MonthlyRevenue[];
  bookingsByType: BookingsByType[];
};

// ============================================================
// Timezone helpers
// ============================================================

// The app operates on Asia/Kolkata (IST). The dashboard greeting and all
// "this month / last month" period boundaries must be anchored to IST so they
// stay consistent regardless of the (UTC) server timezone. Without this, a
// payment recorded just after IST midnight on the 1st could land in the wrong
// calendar month relative to what the user sees.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+05:30, no DST in India

// Returns the current instant shifted so that its UTC calendar fields read as
// IST wall-clock. Use only to derive IST-anchored month boundaries below.
function istNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

// Start of the IST month containing `istShifted`, returned as a real UTC instant.
function istStartOfMonth(istShifted: Date): Date {
  const y = istShifted.getUTCFullYear();
  const m = istShifted.getUTCMonth();
  return new Date(Date.UTC(y, m, 1, 0, 0, 0, 0) - IST_OFFSET_MS);
}

// End of the IST month containing `istShifted` (last ms), as a real UTC instant.
function istEndOfMonth(istShifted: Date): Date {
  const y = istShifted.getUTCFullYear();
  const m = istShifted.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS - 1);
}

// ============================================================
// Color palette for charts
// ============================================================

// Restrained, modern palette — desaturated, harmonized
const EVENT_TYPE_COLORS: Record<string, string> = {
  Wedding: "oklch(0.55 0.15 270)",         // indigo
  Reception: "oklch(0.6 0.13 220)",        // sky
  "Corporate Event": "oklch(0.6 0.12 195)", // teal
  "Birthday Party": "oklch(0.72 0.13 80)",  // amber
  Anniversary: "oklch(0.6 0.15 25)",        // terracotta
  Engagement: "oklch(0.65 0.13 195)",       // cyan
  "Baby Shower": "oklch(0.65 0.13 340)",    // soft pink
  "Social Gathering": "oklch(0.6 0.13 145)", // green
  Other: "oklch(0.55 0.02 270)",            // slate
};

// ============================================================
// getDashboardStats
// ============================================================

export async function getDashboardStats(): Promise<Serialized<DashboardStats>> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (!hasPermission(role, "dashboard:read")) {
    throw new Error("Insufficient permissions");
  }

  const now = new Date();
  // IST-anchored "now" used purely to derive month boundaries / month labels,
  // so periods line up with the IST greeting and the user's local calendar.
  const nowIst = istNow();
  const thisMonthStart = istStartOfMonth(nowIst);
  const thisMonthEnd = istEndOfMonth(nowIst);
  const lastMonthStart = istStartOfMonth(subMonths(nowIst, 1));
  const lastMonthEnd = istEndOfMonth(subMonths(nowIst, 1));

  // Run all queries in parallel
  const [
    // Revenue
    thisMonthPayments,
    lastMonthPayments,
    // Bookings
    activeBookings,
    thisMonthBookings,
    lastMonthBookings,
    // Leads
    newLeadsThisMonth,
    newLeadsLastMonth,
    wonLeadsThisMonth,
    totalLeadsThisMonth,
    // Tasks
    pendingTasks,
    overdueTasks,
    totalTasks,
    // Upcoming Events
    upcomingEvents,
    // Overdue Payments
    overduePayments,
    // Overdue Tasks list
    overdueTasksList,
    // Monthly Revenue (last 12 months)
    last12MonthsPayments,
    // Bookings by Type
    bookingsByTypeRaw,
  ] = await Promise.all([
    // Revenue this month
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: "COMPLETED",
        paidAt: { gte: thisMonthStart, lte: thisMonthEnd },
      },
    }),
    // Revenue last month
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: "COMPLETED",
        paidAt: { gte: lastMonthStart, lte: lastMonthEnd },
      },
    }),
    // Active bookings (CONFIRMED + IN_PROGRESS)
    prisma.booking.count({
      where: { status: { in: ["CONFIRMED", "IN_PROGRESS"] } },
    }),
    // Bookings this month
    prisma.booking.count({
      where: { createdAt: { gte: thisMonthStart, lte: thisMonthEnd } },
    }),
    // Bookings last month
    prisma.booking.count({
      where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
    }),
    // New leads this month
    prisma.lead.count({
      where: { deletedAt: null, createdAt: { gte: thisMonthStart, lte: thisMonthEnd } },
    }),
    // New leads last month
    prisma.lead.count({
      where: { deletedAt: null, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
    }),
    // Won leads this month (for conversion rate)
    prisma.lead.count({
      where: {
        deletedAt: null,
        status: "WON",
        updatedAt: { gte: thisMonthStart, lte: thisMonthEnd },
      },
    }),
    // Total leads processed this month (for conversion rate)
    prisma.lead.count({
      where: {
        deletedAt: null,
        status: { in: ["WON", "LOST"] },
        updatedAt: { gte: thisMonthStart, lte: thisMonthEnd },
      },
    }),
    // Pending tasks (TODO + IN_PROGRESS + IN_REVIEW)
    prisma.task.count({
      where: { status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] } },
    }),
    // Overdue tasks
    prisma.task.count({
      where: {
        status: { not: "DONE" },
        dueDate: { not: null, lt: now },
      },
    }),
    // Total tasks
    prisma.task.count(),
    // Upcoming Events (next 7 days)
    prisma.booking.findMany({
      where: {
        date: {
          gte: now,
          lte: addDays(now, 7),
        },
        status: { in: ["CONFIRMED", "IN_PROGRESS", "HOLD", "TENTATIVE"] },
      },
      orderBy: { date: "asc" },
      // Bound the next-7-days list; the dashboard only renders a short preview,
      // so a sane cap avoids an unbounded result set on a busy week.
      take: 50,
      include: {
        venue: { select: { name: true } },
        contact: {
          select: { firstName: true, lastName: true, phone: true },
        },
      },
    }),
    // Overdue Payments (invoices past due with balance > 0)
    prisma.invoice.findMany({
      where: {
        dueDate: { lt: now },
        balanceDue: { gt: 0 },
        status: { notIn: ["PAID", "CANCELLED", "REFUNDED"] },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
      select: {
        id: true,
        invoiceNumber: true,
        dueDate: true,
        // balanceDue is denormalized; we also pull the authoritative components
        // so we can recompute on read and ignore stale/negative balances.
        balanceDue: true,
        totalAmount: true,
        paidAmount: true,
        contact: { select: { firstName: true, lastName: true } },
      },
    }),
    // Overdue Tasks list
    prisma.task.findMany({
      where: {
        status: { not: "DONE" },
        dueDate: { lt: now },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        assignee: { select: { name: true } },
      },
    }),
    // Last 12 months payments for chart (bounded: ~1 row per payment over 12mo;
    // capped so a data anomaly can't pull an unbounded result set)
    prisma.payment.findMany({
      where: {
        status: "COMPLETED",
        paidAt: { gte: istStartOfMonth(subMonths(nowIst, 11)) },
      },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: "asc" },
      take: 5000,
    }),
    // Bookings grouped by event type (exclude cancelled, to match the other
    // booking counts on this dashboard — audit consistency fix)
    prisma.booking.groupBy({
      by: ["eventType"],
      where: { status: { not: "CANCELLED" } },
      _count: { id: true },
    }),
  ]);

  // Calculate revenue
  const thisMonthRevenue = Number(thisMonthPayments._sum.amount || 0);
  const lastMonthRevenue = Number(lastMonthPayments._sum.amount || 0);
  const revenueChange =
    lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : thisMonthRevenue > 0
        ? 100
        : 0;

  // Calculate bookings change
  const bookingsChange =
    lastMonthBookings > 0
      ? ((thisMonthBookings - lastMonthBookings) / lastMonthBookings) * 100
      : thisMonthBookings > 0
        ? 100
        : 0;

  // Calculate leads change
  const leadsChange =
    newLeadsLastMonth > 0
      ? ((newLeadsThisMonth - newLeadsLastMonth) / newLeadsLastMonth) * 100
      : newLeadsThisMonth > 0
        ? 100
        : 0;

  // Conversion rate
  const conversionRate =
    totalLeadsThisMonth > 0
      ? (wonLeadsThisMonth / totalLeadsThisMonth) * 100
      : 0;

  // Aggregate monthly revenue for last 12 months, bucketed by IST month so the
  // chart's month labels line up with the IST-anchored period stats above.
  // Both the seeded buckets and the payment bucketing read UTC fields off an
  // IST-shifted instant, so they use one identical convention (no local-tz mix).
  const istMonthKey = (d: Date) =>
    format(new Date(d.getTime() + IST_OFFSET_MS), "yyyy-MM");
  const monthlyRevenueMap = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    // subMonths off the real `now`, then key via the same IST shift used below.
    const key = istMonthKey(subMonths(now, i));
    monthlyRevenueMap.set(key, 0);
  }
  for (const payment of last12MonthsPayments) {
    if (payment.paidAt) {
      const key = istMonthKey(payment.paidAt);
      if (!monthlyRevenueMap.has(key)) continue; // outside the 12-month window
      const current = monthlyRevenueMap.get(key) || 0;
      monthlyRevenueMap.set(key, current + Number(payment.amount));
    }
  }
  const monthlyRevenue: MonthlyRevenue[] = Array.from(
    monthlyRevenueMap.entries()
  ).map(([key, revenue]) => {
    // key is "yyyy-MM"; anchor at midday to keep the displayed month stable
    // across server timezones when date-fns reads local fields.
    const [y, m] = key.split("-").map(Number);
    return {
      month: format(new Date(y, m - 1, 1, 12, 0, 0), "MMM yyyy"),
      revenue,
    };
  });

  // Bookings by type
  const bookingsByType: BookingsByType[] = bookingsByTypeRaw.map((b) => ({
    type: b.eventType,
    count: b._count.id,
    fill: EVENT_TYPE_COLORS[b.eventType] || "hsl(215, 16%, 47%)",
  }));

  return serialize({
    revenue: {
      thisMonth: thisMonthRevenue,
      lastMonth: lastMonthRevenue,
      changePercent: Math.round(revenueChange * 10) / 10,
    },
    bookings: {
      active: activeBookings,
      thisMonth: thisMonthBookings,
      changePercent: Math.round(bookingsChange * 10) / 10,
    },
    leads: {
      newThisMonth: newLeadsThisMonth,
      conversionRate: Math.round(conversionRate * 10) / 10,
      changePercent: Math.round(leadsChange * 10) / 10,
    },
    tasks: {
      pending: pendingTasks,
      overdue: overdueTasks,
      total: totalTasks,
    },
    upcomingEvents: upcomingEvents as UpcomingEvent[],
    overduePayments: overduePayments
      .map((p) => {
        // Recompute the authoritative balance from total - paid rather than
        // trusting the denormalized balanceDue, which can drift if a payment
        // updated paidAmount without updating balanceDue. Clamp at 0.
        const computed = Number(p.totalAmount) - Number(p.paidAmount);
        const balanceDue = Math.max(
          0,
          Number.isFinite(computed) ? computed : Number(p.balanceDue)
        );
        return {
          id: p.id,
          invoiceNumber: p.invoiceNumber,
          dueDate: p.dueDate,
          balanceDue,
          contact: p.contact,
        };
      })
      // Drop rows that are actually settled (stale denormalized balanceDue).
      .filter((p) => p.balanceDue > 0),
    overdueTasks: overdueTasksList as OverdueTask[],
    monthlyRevenue,
    bookingsByType,
  });
}
