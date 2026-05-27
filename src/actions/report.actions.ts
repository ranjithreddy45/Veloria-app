"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { subDays, subMonths, format, startOfMonth, endOfMonth } from "date-fns";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Types
// ============================================================

export type DateRange = "7d" | "30d" | "90d" | "12m";

export type RevenueReportData = {
  monthlyRevenue: { month: string; revenue: number }[];
  revenueByEventType: { type: string; revenue: number; fill: string }[];
  revenueByVenue: { venue: string; revenue: number }[];
  totalRevenue: number;
  averageBookingValue: number;
  totalBookings: number;
};

export type BookingReportData = {
  bookingsByStatus: { status: string; count: number; fill: string }[];
  bookingsByVenue: { venue: string; count: number }[];
  bookingsByMonth: { month: string; count: number }[];
  totalBookings: number;
  completionRate: number;
};

export type PipelineReportData = {
  conversionRate: number;
  averageDealValue: number;
  totalPipelineValue: number;
  dealsByStage: { stage: string; count: number; value: number; color: string }[];
  wonDeals: number;
  lostDeals: number;
  leadsBySource: { source: string; count: number; fill: string }[];
};

// --- Financial Report Types ---

export type PaymentMethodReportData = {
  methods: { method: string; amount: number; count: number; fill: string }[];
  total: number;
};

export type SettlementReportData = {
  bookings: {
    bookingId: string;
    eventName: string;
    invoiced: number;
    paid: number;
    outstanding: number;
    status: string;
  }[];
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
};

export type DepositReportData = {
  deposits: {
    bookingId: string;
    eventName: string;
    contactName: string;
    amount: number;
    method: string;
    paidAt: string;
  }[];
  totalDeposits: number;
};

export type RevenueBreakdownData = {
  categories: { category: string; amount: number; fill: string }[];
  total: number;
};

export type DiscountReportData = {
  discounts: {
    quoteNumber: string;
    eventName: string;
    subtotal: number;
    discountPercent: number;
    discountAmount: number;
    contactName: string;
  }[];
  totalDiscounts: number;
};

// --- Client Report Types ---

export type ClientLedgerData = {
  contactName: string;
  contactEmail: string;
  invoices: { id: string; number: string; amount: number; status: string; date: string }[];
  payments: { id: string; amount: number; method: string; date: string }[];
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
};

export type VIPClientData = {
  clients: {
    contactId: string;
    name: string;
    email: string;
    tier: string;
    points: number;
    totalSpend: number;
    bookingCount: number;
  }[];
};

export type ClientTypeReportData = {
  types: { type: string; bookingCount: number; revenue: number; fill: string }[];
  totalClients: number;
};

// --- Vendor Report Types ---

export type VendorPaymentReportData = {
  vendors: {
    vendorId: string;
    name: string;
    category: string;
    totalPaid: number;
    pending: number;
    approved: number;
  }[];
  totalPaid: number;
  totalPending: number;
};

export type NetRevenueReportData = {
  months: { month: string; grossRevenue: number; vendorCosts: number; netRevenue: number }[];
  totalGross: number;
  totalVendorCosts: number;
  totalNet: number;
};

// --- Tax Report Types ---

export type GSTReportData = {
  months: {
    month: string;
    taxableAmount: number;
    cgst: number;
    sgst: number;
    totalTax: number;
  }[];
  totalTaxable: number;
  totalTax: number;
};

// --- Operations Report Types ---

export type DailyOperationsSummaryData = {
  date: string;
  bookingsToday: number;
  paymentsCollected: number;
  tasksCompleted: number;
  tasksPending: number;
  staffOnDuty: number;
  upcomingEvents: { name: string; venue: string; time: string }[];
};

export type TaskCompletionReportData = {
  assignees: {
    name: string;
    total: number;
    completed: number;
    pending: number;
    overdue: number;
    completionRate: number;
  }[];
  overall: { total: number; completed: number; completionRate: number };
};

// --- Booking Enhanced Types ---

export type BookingsBySourceReportData = {
  sources: { source: string; count: number; revenue: number; fill: string }[];
  totalBookings: number;
  totalRevenue: number;
};

// ============================================================
// Helpers
// ============================================================

const EVENT_TYPE_COLORS: Record<string, string> = {
  Wedding: "hsl(262, 83%, 58%)",
  Reception: "hsl(221, 83%, 53%)",
  "Corporate Event": "hsl(142, 71%, 45%)",
  "Birthday Party": "hsl(25, 95%, 53%)",
  Engagement: "hsl(330, 81%, 60%)",
  Anniversary: "hsl(199, 89%, 48%)",
  Conference: "hsl(47, 100%, 50%)",
  Other: "hsl(215, 14%, 55%)",
};

const STATUS_COLORS: Record<string, string> = {
  HOLD: "hsl(45, 93%, 47%)",
  TENTATIVE: "hsl(217, 91%, 60%)",
  CONFIRMED: "hsl(142, 71%, 45%)",
  IN_PROGRESS: "hsl(262, 83%, 58%)",
  COMPLETED: "hsl(215, 14%, 55%)",
  CANCELLED: "hsl(0, 84%, 60%)",
};

const SOURCE_COLORS: Record<string, string> = {
  WEBSITE: "hsl(217, 91%, 60%)",
  REFERRAL: "hsl(142, 71%, 45%)",
  SOCIAL_MEDIA: "hsl(330, 81%, 60%)",
  WALK_IN: "hsl(25, 95%, 53%)",
  PHONE_INQUIRY: "hsl(199, 89%, 48%)",
  EMAIL: "hsl(262, 83%, 58%)",
  EVENT: "hsl(47, 100%, 50%)",
  PARTNER: "hsl(172, 66%, 50%)",
  ADVERTISEMENT: "hsl(0, 84%, 60%)",
  OTHER: "hsl(215, 14%, 55%)",
};

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  CASH: "hsl(45, 93%, 47%)",
  BANK_TRANSFER: "hsl(217, 91%, 60%)",
  UPI: "hsl(262, 83%, 58%)",
  RAZORPAY: "hsl(142, 71%, 45%)",
  CREDIT_CARD: "hsl(330, 81%, 60%)",
  CHEQUE: "hsl(25, 95%, 53%)",
  OTHER: "hsl(215, 14%, 55%)",
};

const CLIENT_TYPE_COLORS: Record<string, string> = {
  INDIVIDUAL: "hsl(262, 83%, 58%)",
  CORPORATE: "hsl(142, 71%, 45%)",
};

const CATEGORY_COLORS: Record<string, string> = {
  "Venue Rental": "hsl(262, 83%, 58%)",
  "Catering": "hsl(142, 71%, 45%)",
  "Décor": "hsl(330, 81%, 60%)",
  "Photography": "hsl(25, 95%, 53%)",
  "Entertainment": "hsl(199, 89%, 48%)",
  "Sound & AV": "hsl(217, 91%, 60%)",
  "Coordination": "hsl(47, 100%, 50%)",
  "Other": "hsl(215, 14%, 55%)",
};

function getDateBounds(range: DateRange) {
  const now = new Date();
  switch (range) {
    case "7d":
      return { start: subDays(now, 7), end: now };
    case "30d":
      return { start: subDays(now, 30), end: now };
    case "90d":
      return { start: subDays(now, 90), end: now };
    case "12m":
      return { start: subMonths(now, 12), end: now };
  }
}

// ============================================================
// Revenue Report
// ============================================================

export async function getRevenueReport(range: DateRange = "12m") {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const { start, end } = getDateBounds(range);

    const [payments, bookingsWithRevenue, venues] = await Promise.all([
      // All completed payments in range
      prisma.payment.findMany({
        where: {
          status: "COMPLETED",
          paidAt: { gte: start, lte: end },
        },
        select: {
          amount: true,
          paidAt: true,
          invoice: {
            select: {
              booking: {
                select: {
                  eventType: true,
                  venue: { select: { name: true } },
                },
              },
            },
          },
        },
      }),

      // Bookings with total amounts
      prisma.booking.findMany({
        where: {
          createdAt: { gte: start, lte: end },
        },
        select: {
          totalAmount: true,
          eventType: true,
          venue: { select: { name: true } },
        },
      }),

      // Venue names for breakdown
      prisma.venue.findMany({
        select: { name: true },
      }),
    ]);

    // Monthly revenue
    const monthlyMap = new Map<string, number>();
    // Fill all months in range
    const months = range === "12m" ? 12 : range === "90d" ? 3 : range === "30d" ? 1 : 1;
    for (let i = months - 1; i >= 0; i--) {
      const d = subMonths(end, i);
      const key = format(startOfMonth(d), "MMM yyyy");
      monthlyMap.set(key, 0);
    }
    for (const p of payments) {
      if (p.paidAt) {
        const key = format(new Date(p.paidAt), "MMM yyyy");
        monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + Number(p.amount));
      }
    }
    const monthlyRevenue = Array.from(monthlyMap.entries()).map(([month, revenue]) => ({
      month,
      revenue,
    }));

    // Revenue by event type
    const typeMap = new Map<string, number>();
    for (const p of payments) {
      const type = p.invoice?.booking?.eventType ?? "Other";
      typeMap.set(type, (typeMap.get(type) ?? 0) + Number(p.amount));
    }
    const revenueByEventType = Array.from(typeMap.entries())
      .map(([type, revenue]) => ({
        type,
        revenue,
        fill: EVENT_TYPE_COLORS[type] ?? EVENT_TYPE_COLORS.Other,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Revenue by venue
    const venueMap = new Map<string, number>();
    for (const p of payments) {
      const venue = p.invoice?.booking?.venue?.name ?? "Unknown";
      venueMap.set(venue, (venueMap.get(venue) ?? 0) + Number(p.amount));
    }
    const revenueByVenue = Array.from(venueMap.entries())
      .map(([venue, revenue]) => ({ venue, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalBookings = bookingsWithRevenue.length;
    const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    return serialize({
      success: true as const,
      data: {
        monthlyRevenue,
        revenueByEventType,
        revenueByVenue,
        totalRevenue,
        averageBookingValue,
        totalBookings,
      } satisfies RevenueReportData,
    });
  } catch (error) {
    console.error("[REVENUE_REPORT_ERROR]", error);
    return { success: false as const, error: "Failed to load revenue report" };
  }
}

// ============================================================
// Booking Report
// ============================================================

export async function getBookingReport(range: DateRange = "12m") {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const { start, end } = getDateBounds(range);

    const [bookings, venues] = await Promise.all([
      prisma.booking.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: {
          status: true,
          createdAt: true,
          venue: { select: { name: true } },
        },
      }),
      prisma.venue.findMany({ select: { name: true } }),
    ]);

    // By status
    const statusMap = new Map<string, number>();
    for (const b of bookings) {
      statusMap.set(b.status, (statusMap.get(b.status) ?? 0) + 1);
    }
    const bookingsByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
      fill: STATUS_COLORS[status] ?? STATUS_COLORS.HOLD,
    }));

    // By venue
    const venueMap = new Map<string, number>();
    for (const b of bookings) {
      const name = b.venue.name;
      venueMap.set(name, (venueMap.get(name) ?? 0) + 1);
    }
    const bookingsByVenue = Array.from(venueMap.entries())
      .map(([venue, count]) => ({ venue, count }))
      .sort((a, b) => b.count - a.count);

    // By month
    const monthMap = new Map<string, number>();
    const months = range === "12m" ? 12 : range === "90d" ? 3 : 1;
    for (let i = months - 1; i >= 0; i--) {
      const d = subMonths(end, i);
      const key = format(startOfMonth(d), "MMM yyyy");
      monthMap.set(key, 0);
    }
    for (const b of bookings) {
      const key = format(new Date(b.createdAt), "MMM yyyy");
      monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
    }
    const bookingsByMonth = Array.from(monthMap.entries()).map(([month, count]) => ({
      month,
      count,
    }));

    const totalBookings = bookings.length;
    const completed = bookings.filter((b) => b.status === "COMPLETED").length;
    const completionRate = totalBookings > 0 ? Math.round((completed / totalBookings) * 100) : 0;

    return serialize({
      success: true as const,
      data: {
        bookingsByStatus,
        bookingsByVenue,
        bookingsByMonth,
        totalBookings,
        completionRate,
      } satisfies BookingReportData,
    });
  } catch (error) {
    console.error("[BOOKING_REPORT_ERROR]", error);
    return { success: false as const, error: "Failed to load booking report" };
  }
}

// ============================================================
// Pipeline Report
// ============================================================

export async function getPipelineReport(range: DateRange = "12m") {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const { start, end } = getDateBounds(range);

    const [deals, stages, leads] = await Promise.all([
      prisma.deal.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: {
          value: true,
          stage: { select: { name: true, color: true, isWonStage: true, isLostStage: true } },
        },
      }),
      prisma.pipelineStage.findMany({
        orderBy: { order: "asc" },
        select: { name: true, color: true },
      }),
      prisma.lead.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { source: true, status: true },
      }),
    ]);

    // Deals by stage
    const stageMap = new Map<string, { count: number; value: number; color: string }>();
    for (const d of deals) {
      const existing = stageMap.get(d.stage.name) ?? { count: 0, value: 0, color: d.stage.color };
      existing.count += 1;
      existing.value += Number(d.value);
      stageMap.set(d.stage.name, existing);
    }
    const dealsByStage = Array.from(stageMap.entries()).map(([stage, data]) => ({
      stage,
      ...data,
    }));

    const wonDeals = deals.filter((d) => d.stage.isWonStage).length;
    const lostDeals = deals.filter((d) => d.stage.isLostStage).length;
    const totalDecided = wonDeals + lostDeals;
    const conversionRate = totalDecided > 0 ? Math.round((wonDeals / totalDecided) * 100) : 0;

    const totalPipelineValue = deals.reduce((sum, d) => sum + Number(d.value), 0);
    const averageDealValue = deals.length > 0 ? totalPipelineValue / deals.length : 0;

    // Leads by source
    const sourceMap = new Map<string, number>();
    for (const l of leads) {
      sourceMap.set(l.source, (sourceMap.get(l.source) ?? 0) + 1);
    }
    const leadsBySource = Array.from(sourceMap.entries())
      .map(([source, count]) => ({
        source,
        count,
        fill: SOURCE_COLORS[source] ?? SOURCE_COLORS.OTHER,
      }))
      .sort((a, b) => b.count - a.count);

    return serialize({
      success: true as const,
      data: {
        conversionRate,
        averageDealValue,
        totalPipelineValue,
        dealsByStage,
        wonDeals,
        lostDeals,
        leadsBySource,
      } satisfies PipelineReportData,
    });
  } catch (error) {
    console.error("[PIPELINE_REPORT_ERROR]", error);
    return { success: false as const, error: "Failed to load pipeline report" };
  }
}

// ============================================================
// Payment Method Report
// ============================================================

export async function getPaymentMethodReport(range: DateRange = "12m") {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const { start, end } = getDateBounds(range);

    const payments = await prisma.payment.findMany({
      where: {
        status: "COMPLETED",
        paidAt: { gte: start, lte: end },
      },
      select: {
        amount: true,
        method: true,
      },
    });

    const methodMap = new Map<string, { amount: number; count: number }>();
    for (const p of payments) {
      const existing = methodMap.get(p.method) ?? { amount: 0, count: 0 };
      existing.amount += Number(p.amount);
      existing.count += 1;
      methodMap.set(p.method, existing);
    }

    const methods = Array.from(methodMap.entries())
      .map(([method, data]) => ({
        method,
        amount: data.amount,
        count: data.count,
        fill: PAYMENT_METHOD_COLORS[method] ?? PAYMENT_METHOD_COLORS.OTHER,
      }))
      .sort((a, b) => b.amount - a.amount);

    const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    return serialize({
      success: true as const,
      data: { methods, total } satisfies PaymentMethodReportData,
    });
  } catch (error) {
    console.error("[PAYMENT_METHOD_REPORT_ERROR]", error);
    return { success: false as const, error: "Failed to load payment method report" };
  }
}

// ============================================================
// Settlement Report
// ============================================================

export async function getSettlementReport(range: DateRange = "12m") {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const { start, end } = getDateBounds(range);

    const bookingsWithFinancials = await prisma.booking.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: {
        id: true,
        eventName: true,
        status: true,
        invoices: {
          select: {
            totalAmount: true,
            payments: {
              where: { status: "COMPLETED" },
              select: { amount: true },
            },
          },
        },
      },
    });

    const bookings = bookingsWithFinancials.map((b) => {
      const invoiced = b.invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      const paid = b.invoices.reduce(
        (sum, inv) => sum + inv.payments.reduce((pSum, p) => pSum + Number(p.amount), 0),
        0
      );
      return {
        bookingId: b.id,
        eventName: b.eventName,
        invoiced,
        paid,
        outstanding: invoiced - paid,
        status: b.status,
      };
    });

    const totalInvoiced = bookings.reduce((sum, b) => sum + b.invoiced, 0);
    const totalPaid = bookings.reduce((sum, b) => sum + b.paid, 0);
    const totalOutstanding = totalInvoiced - totalPaid;

    return serialize({
      success: true as const,
      data: {
        bookings,
        totalInvoiced,
        totalPaid,
        totalOutstanding,
      } satisfies SettlementReportData,
    });
  } catch (error) {
    console.error("[SETTLEMENT_REPORT_ERROR]", error);
    return { success: false as const, error: "Failed to load settlement report" };
  }
}

// ============================================================
// Deposit Report
// ============================================================

export async function getDepositReport(range: DateRange = "12m") {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const { start, end } = getDateBounds(range);

    const bookingsWithPayments = await prisma.booking.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: {
        id: true,
        eventName: true,
        contact: { select: { firstName: true, lastName: true } },
        invoices: {
          select: {
            payments: {
              where: { status: "COMPLETED" },
              orderBy: { paidAt: "asc" },
              select: {
                amount: true,
                method: true,
                paidAt: true,
              },
            },
          },
        },
      },
    });

    const deposits = bookingsWithPayments
      .map((b) => {
        // Find the earliest payment across all invoices (the deposit)
        const allPayments = b.invoices.flatMap((inv) => inv.payments);
        const firstPayment = allPayments.sort(
          (a, b) => new Date(a.paidAt!).getTime() - new Date(b.paidAt!).getTime()
        )[0];

        if (!firstPayment || !firstPayment.paidAt) return null;

        return {
          bookingId: b.id,
          eventName: b.eventName,
          contactName: `${b.contact.firstName} ${b.contact.lastName}`,
          amount: Number(firstPayment.amount),
          method: firstPayment.method,
          paidAt: format(new Date(firstPayment.paidAt), "yyyy-MM-dd"),
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);

    const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);

    return serialize({
      success: true as const,
      data: { deposits, totalDeposits } satisfies DepositReportData,
    });
  } catch (error) {
    console.error("[DEPOSIT_REPORT_ERROR]", error);
    return { success: false as const, error: "Failed to load deposit report" };
  }
}

// ============================================================
// Revenue Breakdown Report
// ============================================================

export async function getRevenueBreakdownReport(range: DateRange = "12m") {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const { start, end } = getDateBounds(range);

    const lineItems = await prisma.invoiceLineItem.findMany({
      where: {
        invoice: {
          issueDate: { gte: start, lte: end },
        },
      },
      select: {
        description: true,
        amount: true,
      },
    });

    const categoryMap = new Map<string, number>();
    for (const item of lineItems) {
      const category = item.description || "Other";
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + Number(item.amount));
    }

    const categories = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        fill: CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other,
      }))
      .sort((a, b) => b.amount - a.amount);

    const total = categories.reduce((sum, c) => sum + c.amount, 0);

    return serialize({
      success: true as const,
      data: { categories, total } satisfies RevenueBreakdownData,
    });
  } catch (error) {
    console.error("[REVENUE_BREAKDOWN_REPORT_ERROR]", error);
    return { success: false as const, error: "Failed to load revenue breakdown report" };
  }
}

// ============================================================
// Discount Report
// ============================================================

export async function getDiscountReport(range: DateRange = "12m") {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const { start, end } = getDateBounds(range);

    const quotes = await prisma.quote.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["CONVERTED", "ACCEPTED"] },
        discountAmount: { gt: 0 },
      },
      select: {
        quoteNumber: true,
        subtotal: true,
        discountPercent: true,
        discountAmount: true,
        contact: { select: { firstName: true, lastName: true } },
        lead: { select: { eventType: true } },
      },
    });

    const discounts = quotes.map((q) => ({
      quoteNumber: q.quoteNumber,
      eventName: q.lead?.eventType ?? "N/A",
      subtotal: Number(q.subtotal),
      discountPercent: Number(q.discountPercent ?? 0),
      discountAmount: Number(q.discountAmount ?? 0),
      contactName: `${q.contact.firstName} ${q.contact.lastName}`,
    }));

    const totalDiscounts = discounts.reduce((sum, d) => sum + d.discountAmount, 0);

    return serialize({
      success: true as const,
      data: { discounts, totalDiscounts } satisfies DiscountReportData,
    });
  } catch (error) {
    console.error("[DISCOUNT_REPORT_ERROR]", error);
    return { success: false as const, error: "Failed to load discount report" };
  }
}

// ============================================================
// Client Ledger
// ============================================================

export async function getClientLedger(contactId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const [contact, invoices, payments] = await Promise.all([
      prisma.contact.findUnique({
        where: { id: contactId },
        select: { firstName: true, lastName: true, email: true },
      }),
      prisma.invoice.findMany({
        where: { contactId },
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          status: true,
          issueDate: true,
        },
        orderBy: { issueDate: "desc" },
      }),
      prisma.payment.findMany({
        where: {
          invoice: { contactId },
          status: "COMPLETED",
        },
        select: {
          id: true,
          amount: true,
          method: true,
          paidAt: true,
        },
        orderBy: { paidAt: "desc" },
      }),
    ]);

    if (!contact) {
      return { success: false as const, error: "Contact not found" };
    }

    const invoiceList = invoices.map((inv) => ({
      id: inv.id,
      number: inv.invoiceNumber,
      amount: Number(inv.totalAmount),
      status: inv.status,
      date: format(new Date(inv.issueDate), "yyyy-MM-dd"),
    }));

    const paymentList = payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      date: p.paidAt ? format(new Date(p.paidAt), "yyyy-MM-dd") : "",
    }));

    const totalInvoiced = invoiceList.reduce((sum, inv) => sum + inv.amount, 0);
    const totalPaid = paymentList.reduce((sum, p) => sum + p.amount, 0);
    const balance = totalInvoiced - totalPaid;

    return serialize({
      success: true as const,
      data: {
        contactName: `${contact.firstName} ${contact.lastName}`,
        contactEmail: contact.email ?? "",
        invoices: invoiceList,
        payments: paymentList,
        totalInvoiced,
        totalPaid,
        balance,
      } satisfies ClientLedgerData,
    });
  } catch (error) {
    console.error("[CLIENT_LEDGER_ERROR]", error);
    return { success: false as const, error: "Failed to load client ledger" };
  }
}

// ============================================================
// VIP Client Report
// ============================================================

export async function getVIPClientReport() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const loyaltyAccounts = await prisma.loyaltyAccount.findMany({
      where: {
        tier: { in: ["GOLD", "PLATINUM"] },
      },
      select: {
        contactId: true,
        tier: true,
        points: true,
        contact: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            bookings: {
              where: { status: { in: ["COMPLETED", "CONFIRMED"] } },
              select: { totalAmount: true },
            },
          },
        },
      },
    });

    const clients = loyaltyAccounts.map((la) => ({
      contactId: la.contactId,
      name: `${la.contact.firstName} ${la.contact.lastName}`,
      email: la.contact.email ?? "",
      tier: la.tier,
      points: la.points,
      totalSpend: la.contact.bookings.reduce((sum, b) => sum + Number(b.totalAmount), 0),
      bookingCount: la.contact.bookings.length,
    }));

    return serialize({
      success: true as const,
      data: { clients } satisfies VIPClientData,
    });
  } catch (error) {
    console.error("[VIP_CLIENT_REPORT_ERROR]", error);
    return { success: false as const, error: "Failed to load VIP client report" };
  }
}

// ============================================================
// Client Type Report
// ============================================================

export async function getClientTypeReport(range: DateRange = "12m") {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const { start, end } = getDateBounds(range);

    const bookings = await prisma.booking.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: {
        totalAmount: true,
        contact: { select: { id: true, type: true } },
      },
    });

    const typeMap = new Map<string, { bookingCount: number; revenue: number; contacts: Set<string> }>();
    for (const b of bookings) {
      const type = b.contact.type;
      const existing = typeMap.get(type) ?? { bookingCount: 0, revenue: 0, contacts: new Set<string>() };
      existing.bookingCount += 1;
      existing.revenue += Number(b.totalAmount);
      existing.contacts.add(b.contact.id);
      typeMap.set(type, existing);
    }

    const types = Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      bookingCount: data.bookingCount,
      revenue: data.revenue,
      fill: CLIENT_TYPE_COLORS[type] ?? CLIENT_TYPE_COLORS.INDIVIDUAL,
    }));

    const totalClients = new Set(bookings.map((b) => b.contact.id)).size;

    return serialize({
      success: true as const,
      data: { types, totalClients } satisfies ClientTypeReportData,
    });
  } catch (error) {
    console.error("[CLIENT_TYPE_REPORT_ERROR]", error);
    return { success: false as const, error: "Failed to load client type report" };
  }
}

// ============================================================
// Vendor Payment Report
// ============================================================

export async function getVendorPaymentReport(range: DateRange = "12m") {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const { start, end } = getDateBounds(range);

    const payouts = await prisma.payout.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        vendorId: { not: null },
      },
      select: {
        amount: true,
        status: true,
        vendor: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
    });

    const vendorMap = new Map<
      string,
      { name: string; category: string; totalPaid: number; pending: number; approved: number }
    >();

    for (const p of payouts) {
      if (!p.vendor) continue;
      const existing = vendorMap.get(p.vendor.id) ?? {
        name: p.vendor.name,
        category: p.vendor.category,
        totalPaid: 0,
        pending: 0,
        approved: 0,
      };
      const amount = Number(p.amount);
      if (p.status === "PAID") existing.totalPaid += amount;
      if (p.status === "PENDING") existing.pending += amount;
      if (p.status === "APPROVED") existing.approved += amount;
      vendorMap.set(p.vendor.id, existing);
    }

    const vendors = Array.from(vendorMap.entries()).map(([vendorId, data]) => ({
      vendorId,
      ...data,
    }));

    const totalPaid = vendors.reduce((sum, v) => sum + v.totalPaid, 0);
    const totalPending = vendors.reduce((sum, v) => sum + v.pending, 0);

    return serialize({
      success: true as const,
      data: { vendors, totalPaid, totalPending } satisfies VendorPaymentReportData,
    });
  } catch (error) {
    console.error("[VENDOR_PAYMENT_REPORT_ERROR]", error);
    return { success: false as const, error: "Failed to load vendor payment report" };
  }
}

// ============================================================
// Net Revenue Report
// ============================================================

export async function getNetRevenueReport(range: DateRange = "12m") {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const { start, end } = getDateBounds(range);

    const [payments, payouts] = await Promise.all([
      prisma.payment.findMany({
        where: {
          status: "COMPLETED",
          paidAt: { gte: start, lte: end },
        },
        select: { amount: true, paidAt: true },
      }),
      prisma.payout.findMany({
        where: {
          status: "PAID",
          paidAt: { gte: start, lte: end },
        },
        select: { amount: true, paidAt: true },
      }),
    ]);

    // Build monthly data
    const monthCount = range === "12m" ? 12 : range === "90d" ? 3 : 1;
    const monthlyMap = new Map<string, { gross: number; vendor: number }>();
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = subMonths(end, i);
      const key = format(startOfMonth(d), "MMM yyyy");
      monthlyMap.set(key, { gross: 0, vendor: 0 });
    }

    for (const p of payments) {
      if (p.paidAt) {
        const key = format(new Date(p.paidAt), "MMM yyyy");
        const existing = monthlyMap.get(key);
        if (existing) existing.gross += Number(p.amount);
      }
    }

    for (const p of payouts) {
      if (p.paidAt) {
        const key = format(new Date(p.paidAt), "MMM yyyy");
        const existing = monthlyMap.get(key);
        if (existing) existing.vendor += Number(p.amount);
      }
    }

    const months = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      grossRevenue: data.gross,
      vendorCosts: data.vendor,
      netRevenue: data.gross - data.vendor,
    }));

    const totalGross = months.reduce((sum, m) => sum + m.grossRevenue, 0);
    const totalVendorCosts = months.reduce((sum, m) => sum + m.vendorCosts, 0);
    const totalNet = totalGross - totalVendorCosts;

    return serialize({
      success: true as const,
      data: {
        months,
        totalGross,
        totalVendorCosts,
        totalNet,
      } satisfies NetRevenueReportData,
    });
  } catch (error) {
    console.error("[NET_REVENUE_REPORT_ERROR]", error);
    return { success: false as const, error: "Failed to load net revenue report" };
  }
}

// ============================================================
// GST Report
// ============================================================

export async function getGSTReport(range: DateRange = "12m") {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const { start, end } = getDateBounds(range);

    const invoices = await prisma.invoice.findMany({
      where: {
        issueDate: { gte: start, lte: end },
        status: { notIn: ["DRAFT", "CANCELLED"] },
      },
      select: {
        subtotal: true,
        cgstAmount: true,
        sgstAmount: true,
        issueDate: true,
      },
    });

    // Build monthly data
    const monthCount = range === "12m" ? 12 : range === "90d" ? 3 : 1;
    const monthlyMap = new Map<
      string,
      { taxableAmount: number; cgst: number; sgst: number }
    >();
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = subMonths(end, i);
      const key = format(startOfMonth(d), "MMM yyyy");
      monthlyMap.set(key, { taxableAmount: 0, cgst: 0, sgst: 0 });
    }

    for (const inv of invoices) {
      const key = format(new Date(inv.issueDate), "MMM yyyy");
      const existing = monthlyMap.get(key);
      if (existing) {
        existing.taxableAmount += Number(inv.subtotal);
        existing.cgst += Number(inv.cgstAmount);
        existing.sgst += Number(inv.sgstAmount);
      }
    }

    const months = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      taxableAmount: data.taxableAmount,
      cgst: data.cgst,
      sgst: data.sgst,
      totalTax: data.cgst + data.sgst,
    }));

    const totalTaxable = months.reduce((sum, m) => sum + m.taxableAmount, 0);
    const totalTax = months.reduce((sum, m) => sum + m.totalTax, 0);

    return serialize({
      success: true as const,
      data: { months, totalTaxable, totalTax } satisfies GSTReportData,
    });
  } catch (error) {
    console.error("[GST_REPORT_ERROR]", error);
    return { success: false as const, error: "Failed to load GST report" };
  }
}

// ============================================================
// Daily Operations Summary
// ============================================================

export async function getDailyOperationsSummary(date: Date) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const [bookings, payments, tasksCompleted, tasksPending, shifts] = await Promise.all([
      prisma.booking.findMany({
        where: { date: { gte: dayStart, lte: dayEnd } },
        select: {
          eventName: true,
          venue: { select: { name: true } },
          startTime: true,
          timeSlot: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          status: "COMPLETED",
          paidAt: { gte: dayStart, lte: dayEnd },
        },
        select: { amount: true },
      }),
      prisma.task.count({
        where: {
          status: "DONE",
          completedAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      prisma.task.count({
        where: {
          status: { in: ["TODO", "IN_PROGRESS"] },
          dueDate: { gte: dayStart, lte: dayEnd },
        },
      }),
      prisma.shift.findMany({
        where: { date: { gte: dayStart, lte: dayEnd } },
        select: { id: true },
      }),
    ]);

    const paymentsCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const upcomingEvents = bookings.map((b) => ({
      name: b.eventName,
      venue: b.venue.name,
      time: b.startTime ? format(new Date(b.startTime), "HH:mm") : b.timeSlot,
    }));

    return serialize({
      success: true as const,
      data: {
        date: format(dayStart, "yyyy-MM-dd"),
        bookingsToday: bookings.length,
        paymentsCollected,
        tasksCompleted,
        tasksPending,
        staffOnDuty: shifts.length,
        upcomingEvents,
      } satisfies DailyOperationsSummaryData,
    });
  } catch (error) {
    console.error("[DAILY_OPERATIONS_SUMMARY_ERROR]", error);
    return { success: false as const, error: "Failed to load daily operations summary" };
  }
}

// ============================================================
// Task Completion Report
// ============================================================

export async function getTaskCompletionReport(range: DateRange = "12m") {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const { start, end } = getDateBounds(range);
    const now = new Date();

    const tasks = await prisma.task.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        assigneeId: { not: null },
      },
      select: {
        status: true,
        dueDate: true,
        assignee: { select: { name: true } },
      },
    });

    const assigneeMap = new Map<
      string,
      { total: number; completed: number; pending: number; overdue: number }
    >();

    for (const t of tasks) {
      const name = t.assignee?.name ?? "Unassigned";
      const existing = assigneeMap.get(name) ?? {
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
      };
      existing.total += 1;
      if (t.status === "DONE") {
        existing.completed += 1;
      } else {
        if (t.status === "TODO" || t.status === "IN_PROGRESS") {
          existing.pending += 1;
        }
        if (t.dueDate && new Date(t.dueDate) < now) {
          existing.overdue += 1;
        }
      }
      assigneeMap.set(name, existing);
    }

    const assignees = Array.from(assigneeMap.entries()).map(([name, data]) => ({
      name,
      total: data.total,
      completed: data.completed,
      pending: data.pending,
      overdue: data.overdue,
      completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    }));

    const overallTotal = tasks.length;
    const overallCompleted = tasks.filter((t) => t.status === "DONE").length;
    const overallCompletionRate =
      overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;

    return serialize({
      success: true as const,
      data: {
        assignees,
        overall: {
          total: overallTotal,
          completed: overallCompleted,
          completionRate: overallCompletionRate,
        },
      } satisfies TaskCompletionReportData,
    });
  } catch (error) {
    console.error("[TASK_COMPLETION_REPORT_ERROR]", error);
    return { success: false as const, error: "Failed to load task completion report" };
  }
}

// ============================================================
// Bookings by Source Report
// ============================================================

export async function getBookingsBySourceReport(range: DateRange = "12m") {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const { start, end } = getDateBounds(range);

    const [bookings, leads] = await Promise.all([
      prisma.booking.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: {
          contactId: true,
          totalAmount: true,
        },
      }),
      prisma.lead.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: {
          contactId: true,
          source: true,
        },
      }),
    ]);

    // Build a map of contactId -> lead source
    const contactSourceMap = new Map<string, string>();
    for (const l of leads) {
      // Use the first lead source found for each contact
      if (!contactSourceMap.has(l.contactId)) {
        contactSourceMap.set(l.contactId, l.source);
      }
    }

    // Group bookings by lead source (via contactId)
    const sourceMap = new Map<string, { count: number; revenue: number }>();
    for (const b of bookings) {
      const source = contactSourceMap.get(b.contactId) ?? "OTHER";
      const existing = sourceMap.get(source) ?? { count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += Number(b.totalAmount);
      sourceMap.set(source, existing);
    }

    const sources = Array.from(sourceMap.entries())
      .map(([source, data]) => ({
        source,
        count: data.count,
        revenue: data.revenue,
        fill: SOURCE_COLORS[source] ?? SOURCE_COLORS.OTHER,
      }))
      .sort((a, b) => b.count - a.count);

    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);

    return serialize({
      success: true as const,
      data: { sources, totalBookings, totalRevenue } satisfies BookingsBySourceReportData,
    });
  } catch (error) {
    console.error("[BOOKINGS_BY_SOURCE_REPORT_ERROR]", error);
    return { success: false as const, error: "Failed to load bookings by source report" };
  }
}
