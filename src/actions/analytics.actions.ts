"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { subMonths, format, startOfMonth, endOfMonth } from "date-fns";

// ============================================================
// Types
// ============================================================

export type RevenueAnalyticsData = {
  totalRevenue: number;
  monthlyRevenue: { month: string; revenue: number }[];
  revenueByVenue: { venue: string; revenue: number }[];
  revenueByEventType: { type: string; revenue: number }[];
  averageBookingValue: number;
};

export type BookingAnalyticsData = {
  totalBookings: number;
  bookingsByStatus: Record<string, number>;
  bookingsByMonth: { month: string; count: number }[];
  bookingsByVenue: { venue: string; count: number }[];
  averageGuestCount: number;
};

export type LeadFunnelData = {
  stage: string;
  count: number;
}[];

export type VenueUtilizationData = {
  venueId: string;
  venueName: string;
  totalBookings: number;
  bookedDays: number;
  utilizationPercent: number;
}[];

export type MonthOverMonthData = {
  month: string;
  revenue: number;
  bookings: number;
  leads: number;
}[];

export type TopClientData = {
  contactId: string;
  contactName: string;
  totalBookings: number;
  totalSpent: number;
}[];

export type CashflowData = {
  month: string;
  income: number;
  expenses: number;
  net: number;
}[];

// ============================================================
// Revenue Analytics
// ============================================================

export async function getRevenueAnalytics(params?: {
  startDate?: string;
  endDate?: string;
  venueId?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const now = new Date();
    const start = params?.startDate
      ? new Date(params.startDate)
      : subMonths(now, 12);
    const end = params?.endDate ? new Date(params.endDate) : now;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paymentWhere: any = {
      status: "COMPLETED",
      paidAt: { gte: start, lte: end },
    };

    if (params?.venueId) {
      paymentWhere.invoice = { booking: { venueId: params.venueId } };
    }

    const payments = await prisma.payment.findMany({
      where: paymentWhere,
      select: {
        amount: true,
        paidAt: true,
        invoice: {
          select: {
            booking: {
              select: {
                eventType: true,
                totalAmount: true,
                venue: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    // Monthly revenue
    const monthlyMap = new Map<string, number>();
    let cursor = startOfMonth(start);
    while (cursor <= end) {
      monthlyMap.set(format(cursor, "MMM yyyy"), 0);
      cursor = startOfMonth(subMonths(cursor, -1));
    }
    for (const p of payments) {
      if (p.paidAt) {
        const key = format(new Date(p.paidAt), "MMM yyyy");
        monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + Number(p.amount));
      }
    }
    const monthlyRevenue = Array.from(monthlyMap.entries()).map(
      ([month, revenue]) => ({ month, revenue })
    );

    // Revenue by venue
    const venueMap = new Map<string, number>();
    for (const p of payments) {
      const venue = p.invoice?.booking?.venue?.name ?? "Unknown";
      venueMap.set(venue, (venueMap.get(venue) ?? 0) + Number(p.amount));
    }
    const revenueByVenue = Array.from(venueMap.entries())
      .map(([venue, revenue]) => ({ venue, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    // Revenue by event type
    const typeMap = new Map<string, number>();
    for (const p of payments) {
      const type = p.invoice?.booking?.eventType ?? "Other";
      typeMap.set(type, (typeMap.get(type) ?? 0) + Number(p.amount));
    }
    const revenueByEventType = Array.from(typeMap.entries())
      .map(([type, revenue]) => ({ type, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );
    const totalBookingsInPeriod = await prisma.booking.count({
      where: {
        createdAt: { gte: start, lte: end },
        ...(params?.venueId ? { venueId: params.venueId } : {}),
      },
    });
    const averageBookingValue =
      totalBookingsInPeriod > 0 ? totalRevenue / totalBookingsInPeriod : 0;

    return serialize({
      success: true as const,
      data: {
        totalRevenue,
        monthlyRevenue,
        revenueByVenue,
        revenueByEventType,
        averageBookingValue,
      } satisfies RevenueAnalyticsData,
    });
  } catch (error) {
    console.error("[REVENUE_ANALYTICS_ERROR]", error);
    return { success: false as const, error: "Failed to load revenue analytics" };
  }
}

// ============================================================
// Booking Analytics
// ============================================================

export async function getBookingAnalytics(params?: {
  startDate?: string;
  endDate?: string;
  venueId?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const now = new Date();
    const start = params?.startDate
      ? new Date(params.startDate)
      : subMonths(now, 12);
    const end = params?.endDate ? new Date(params.endDate) : now;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      createdAt: { gte: start, lte: end },
    };
    if (params?.venueId) {
      where.venueId = params.venueId;
    }

    const bookings = await prisma.booking.findMany({
      where,
      select: {
        status: true,
        guestCount: true,
        createdAt: true,
        venue: { select: { name: true } },
      },
    });

    // By status
    const statusMap: Record<string, number> = {};
    for (const b of bookings) {
      statusMap[b.status] = (statusMap[b.status] ?? 0) + 1;
    }

    // By month
    const monthMap = new Map<string, number>();
    let cursor = startOfMonth(start);
    while (cursor <= end) {
      monthMap.set(format(cursor, "MMM yyyy"), 0);
      cursor = startOfMonth(subMonths(cursor, -1));
    }
    for (const b of bookings) {
      const key = format(new Date(b.createdAt), "MMM yyyy");
      monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
    }
    const bookingsByMonth = Array.from(monthMap.entries()).map(
      ([month, count]) => ({ month, count })
    );

    // By venue
    const venueMap = new Map<string, number>();
    for (const b of bookings) {
      const name = b.venue.name;
      venueMap.set(name, (venueMap.get(name) ?? 0) + 1);
    }
    const bookingsByVenue = Array.from(venueMap.entries())
      .map(([venue, count]) => ({ venue, count }))
      .sort((a, b) => b.count - a.count);

    const totalBookings = bookings.length;
    const totalGuests = bookings.reduce((sum, b) => sum + b.guestCount, 0);
    const averageGuestCount =
      totalBookings > 0 ? Math.round(totalGuests / totalBookings) : 0;

    return serialize({
      success: true as const,
      data: {
        totalBookings,
        bookingsByStatus: statusMap,
        bookingsByMonth,
        bookingsByVenue,
        averageGuestCount,
      } satisfies BookingAnalyticsData,
    });
  } catch (error) {
    console.error("[BOOKING_ANALYTICS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to load booking analytics",
    };
  }
}

// ============================================================
// Lead Conversion Funnel
// ============================================================

export async function getLeadConversionFunnel(params?: {
  startDate?: string;
  endDate?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const now = new Date();
    const start = params?.startDate
      ? new Date(params.startDate)
      : subMonths(now, 12);
    const end = params?.endDate ? new Date(params.endDate) : now;

    const leads = await prisma.lead.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { status: true },
    });

    // Define the funnel order
    const funnelOrder = [
      "NEW",
      "CONTACTED",
      "QUALIFIED",
      "PROPOSAL_SENT",
      "NEGOTIATION",
      "WON",
      "LOST",
    ];

    const statusCount = new Map<string, number>();
    for (const stage of funnelOrder) {
      statusCount.set(stage, 0);
    }
    for (const l of leads) {
      statusCount.set(l.status, (statusCount.get(l.status) ?? 0) + 1);
    }

    const funnel: LeadFunnelData = funnelOrder.map((stage) => ({
      stage,
      count: statusCount.get(stage) ?? 0,
    }));

    return serialize({
      success: true as const,
      data: funnel,
    });
  } catch (error) {
    console.error("[LEAD_FUNNEL_ERROR]", error);
    return { success: false as const, error: "Failed to load lead funnel" };
  }
}

// ============================================================
// Venue Utilization
// ============================================================

export async function getVenueUtilization(params?: {
  month?: string;
  year?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const now = new Date();
    const year = params?.year ?? now.getFullYear();
    const monthIdx = params?.month ? parseInt(params.month, 10) - 1 : now.getMonth();
    const periodStart = new Date(year, monthIdx, 1);
    const periodEnd = endOfMonth(periodStart);
    const daysInPeriod = periodEnd.getDate();

    const venues = await prisma.venue.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        bookings: {
          where: {
            date: { gte: periodStart, lte: periodEnd },
            status: { notIn: ["CANCELLED"] },
          },
          select: { date: true },
        },
      },
    });

    const utilization: VenueUtilizationData = venues.map((v) => {
      // Count unique booked days
      const uniqueDays = new Set(
        v.bookings.map((b) => format(new Date(b.date), "yyyy-MM-dd"))
      );
      const bookedDays = uniqueDays.size;
      const utilizationPercent =
        daysInPeriod > 0
          ? Math.round((bookedDays / daysInPeriod) * 100)
          : 0;

      return {
        venueId: v.id,
        venueName: v.name,
        totalBookings: v.bookings.length,
        bookedDays,
        utilizationPercent,
      };
    });

    return serialize({
      success: true as const,
      data: utilization,
    });
  } catch (error) {
    console.error("[VENUE_UTILIZATION_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to load venue utilization",
    };
  }
}

// ============================================================
// Month Over Month (last 12 months)
// ============================================================

export async function getMonthOverMonth() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const now = new Date();
    const months: MonthOverMonthData = [];

    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const label = format(monthStart, "MMM yyyy");

      const [payments, bookingsCount, leadsCount] = await Promise.all([
        prisma.payment.findMany({
          where: {
            status: "COMPLETED",
            paidAt: { gte: monthStart, lte: monthEnd },
          },
          select: { amount: true },
        }),
        prisma.booking.count({
          where: { createdAt: { gte: monthStart, lte: monthEnd } },
        }),
        prisma.lead.count({
          where: { createdAt: { gte: monthStart, lte: monthEnd } },
        }),
      ]);

      const revenue = payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );

      months.push({
        month: label,
        revenue,
        bookings: bookingsCount,
        leads: leadsCount,
      });
    }

    return serialize({
      success: true as const,
      data: months,
    });
  } catch (error) {
    console.error("[MONTH_OVER_MONTH_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to load month-over-month data",
    };
  }
}

// ============================================================
// Top Clients
// ============================================================

export async function getTopClients(limit?: number) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "analytics:advanced")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const take = limit ?? 10;

    const contacts = await prisma.contact.findMany({
      where: {
        bookings: { some: {} },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        bookings: {
          select: {
            id: true,
            invoices: {
              select: {
                payments: {
                  where: { status: "COMPLETED" },
                  select: { amount: true },
                },
              },
            },
          },
        },
      },
    });

    const clients = contacts.map((c) => {
      let totalSpent = 0;
      for (const booking of c.bookings) {
        for (const invoice of booking.invoices) {
          for (const payment of invoice.payments) {
            totalSpent += Number(payment.amount);
          }
        }
      }

      return {
        contactId: c.id,
        contactName: `${c.firstName} ${c.lastName}`,
        totalBookings: c.bookings.length,
        totalSpent,
      };
    });

    // Sort by totalSpent descending and take top N
    clients.sort((a, b) => b.totalSpent - a.totalSpent);
    const topClients = clients.slice(0, take);

    return serialize({
      success: true as const,
      data: topClients,
    });
  } catch (error) {
    console.error("[TOP_CLIENTS_ERROR]", error);
    return { success: false as const, error: "Failed to load top clients" };
  }
}

// ============================================================
// Cashflow
// ============================================================

export async function getCashflow(params?: { months?: number }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "analytics:advanced")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const now = new Date();
    const monthCount = params?.months ?? 12;
    const cashflow: CashflowData = [];

    for (let i = monthCount - 1; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const label = format(monthStart, "MMM yyyy");

      const [payments, payouts] = await Promise.all([
        // Income = completed payments received
        prisma.payment.findMany({
          where: {
            status: "COMPLETED",
            paidAt: { gte: monthStart, lte: monthEnd },
          },
          select: { amount: true },
        }),
        // Expenses = payouts made
        prisma.payout.findMany({
          where: {
            status: "PAID",
            paidAt: { gte: monthStart, lte: monthEnd },
          },
          select: { amount: true },
        }),
      ]);

      const income = payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );
      const expenses = payouts.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );

      cashflow.push({
        month: label,
        income,
        expenses,
        net: income - expenses,
      });
    }

    return serialize({
      success: true as const,
      data: cashflow,
    });
  } catch (error) {
    console.error("[CASHFLOW_ERROR]", error);
    return { success: false as const, error: "Failed to load cashflow data" };
  }
}
