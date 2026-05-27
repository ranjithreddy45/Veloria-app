"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize, type Serialized } from "@/lib/utils";
import { startOfMonth, endOfMonth, subMonths, format, addDays } from "date-fns";

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
// Color palette for charts
// ============================================================

const EVENT_TYPE_COLORS: Record<string, string> = {
  Wedding: "hsl(262, 83%, 58%)",
  Reception: "hsl(221, 83%, 53%)",
  "Corporate Event": "hsl(173, 58%, 39%)",
  "Birthday Party": "hsl(43, 96%, 56%)",
  Anniversary: "hsl(346, 77%, 49%)",
  Engagement: "hsl(199, 89%, 48%)",
  "Baby Shower": "hsl(316, 72%, 51%)",
  "Social Gathering": "hsl(142, 71%, 45%)",
  Other: "hsl(215, 16%, 47%)",
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
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

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
      where: { createdAt: { gte: thisMonthStart, lte: thisMonthEnd } },
    }),
    // New leads last month
    prisma.lead.count({
      where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
    }),
    // Won leads this month (for conversion rate)
    prisma.lead.count({
      where: {
        status: "WON",
        updatedAt: { gte: thisMonthStart, lte: thisMonthEnd },
      },
    }),
    // Total leads processed this month (for conversion rate)
    prisma.lead.count({
      where: {
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
        balanceDue: true,
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
    // Last 12 months payments for chart
    prisma.payment.findMany({
      where: {
        status: "COMPLETED",
        paidAt: { gte: startOfMonth(subMonths(now, 11)) },
      },
      select: { amount: true, paidAt: true },
    }),
    // Bookings grouped by event type
    prisma.booking.groupBy({
      by: ["eventType"],
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

  // Aggregate monthly revenue for last 12 months
  const monthlyRevenueMap = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const key = format(monthDate, "yyyy-MM");
    monthlyRevenueMap.set(key, 0);
  }
  for (const payment of last12MonthsPayments) {
    if (payment.paidAt) {
      const key = format(payment.paidAt, "yyyy-MM");
      const current = monthlyRevenueMap.get(key) || 0;
      monthlyRevenueMap.set(key, current + Number(payment.amount));
    }
  }
  const monthlyRevenue: MonthlyRevenue[] = Array.from(
    monthlyRevenueMap.entries()
  ).map(([key, revenue]) => ({
    month: format(new Date(key + "-01"), "MMM yyyy"),
    revenue,
  }));

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
    overduePayments: overduePayments.map((p) => ({
      ...p,
      balanceDue: Number(p.balanceDue),
    })),
    overdueTasks: overdueTasksList as OverdueTask[],
    monthlyRevenue,
    bookingsByType,
  });
}
