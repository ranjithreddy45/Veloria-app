"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  budgetSchema,
  generateForecastSchema,
  type BudgetInput,
} from "@/schemas/forecast.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import {
  generateDemandForecast,
  generateVenueHeatmap,
} from "@/lib/ai/forecasting";

// ============================================================
// Get Budgets (Filtered)
// ============================================================

export async function getBudgets(filters?: {
  year?: number;
  venueId?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (filters?.year) {
      where.year = filters.year;
    }

    if (filters?.venueId) {
      where.venueId = filters.venueId;
    }

    const budgets = await prisma.budget.findMany({
      where,
      orderBy: [{ year: "desc" }, { month: "asc" }],
    });

    return {
      success: true as const,
      data: serialize(budgets),
    };
  } catch (error) {
    console.error("[GET_BUDGETS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch budgets" };
  }
}

// ============================================================
// Get Budget By ID
// ============================================================

export async function getBudgetById(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const budget = await prisma.budget.findUnique({
      where: { id },
    });

    if (!budget) {
      return { success: false as const, error: "Budget not found" };
    }

    return { success: true as const, data: serialize(budget) };
  } catch (error) {
    console.error("[GET_BUDGET_BY_ID_ERROR]", error);
    return { success: false as const, error: "Failed to fetch budget" };
  }
}

// ============================================================
// Create Budget
// ============================================================

export async function createBudget(data: BudgetInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = budgetSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const budgetData = parsed.data;

    const budget = await prisma.budget.create({
      data: {
        name: budgetData.name,
        venueId: budgetData.venueId || null,
        month: budgetData.month,
        year: budgetData.year,
        revenue: budgetData.revenue,
        expenses: budgetData.expenses,
        profit: budgetData.profit,
        category: budgetData.category || null,
        notes: budgetData.notes || null,
      },
    });

    logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Budget",
      entityId: budget.id,
    });

    revalidatePath("/analytics/budget");
    return { success: true as const, data: serialize(budget) };
  } catch (error) {
    console.error("[CREATE_BUDGET_ERROR]", error);
    return { success: false as const, error: "Failed to create budget" };
  }
}

// ============================================================
// Update Budget
// ============================================================

export async function updateBudget(id: string, data: BudgetInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = budgetSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.budget.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return { success: false as const, error: "Budget not found" };
    }

    const budgetData = parsed.data;

    const budget = await prisma.budget.update({
      where: { id },
      data: {
        name: budgetData.name,
        venueId: budgetData.venueId || null,
        month: budgetData.month,
        year: budgetData.year,
        revenue: budgetData.revenue,
        expenses: budgetData.expenses,
        profit: budgetData.profit,
        category: budgetData.category || null,
        notes: budgetData.notes || null,
      },
    });

    logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Budget",
      entityId: budget.id,
    });

    revalidatePath("/analytics/budget");
    revalidatePath(`/analytics/budget/${id}/edit`);
    return { success: true as const, data: serialize(budget) };
  } catch (error) {
    console.error("[UPDATE_BUDGET_ERROR]", error);
    return { success: false as const, error: "Failed to update budget" };
  }
}

// ============================================================
// Delete Budget
// ============================================================

export async function deleteBudget(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.budget.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return { success: false as const, error: "Budget not found" };
    }

    await prisma.budget.delete({ where: { id } });

    logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "Budget",
      entityId: id,
    });

    revalidatePath("/analytics/budget");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_BUDGET_ERROR]", error);
    return { success: false as const, error: "Failed to delete budget" };
  }
}

// ============================================================
// Get Forecast Entries
// ============================================================

export async function getForecastEntries(year?: number) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (year) {
      where.year = year;
    }

    const entries = await prisma.forecastEntry.findMany({
      where,
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });

    return {
      success: true as const,
      data: serialize(entries),
    };
  } catch (error) {
    console.error("[GET_FORECAST_ENTRIES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch forecast entries" };
  }
}

// ============================================================
// Generate Forecast (Placeholder AI Logic)
// ============================================================
// Calculate predicted revenue as average of last 6 months * 1.1
// Predicted bookings as average count of last 6 months
// Confidence fixed at 0.7

export async function generateForecast(months: number) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = generateForecastSchema.safeParse({ months });
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const monthsAhead = parsed.data.months;

    // Get historical data — last 6 months of completed payments
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    const recentPayments = await prisma.payment.findMany({
      where: {
        status: "COMPLETED",
        paidAt: { gte: sixMonthsAgo },
      },
      select: {
        amount: true,
        paidAt: true,
      },
    });

    // Group payments by month to calculate monthly revenue
    const monthlyRevenue: Record<string, number> = {};
    for (const payment of recentPayments) {
      if (payment.paidAt) {
        const key = `${payment.paidAt.getFullYear()}-${String(payment.paidAt.getMonth() + 1).padStart(2, "0")}`;
        monthlyRevenue[key] = (monthlyRevenue[key] || 0) + Number(payment.amount);
      }
    }

    const revenueValues = Object.values(monthlyRevenue);
    const avgRevenue =
      revenueValues.length > 0
        ? revenueValues.reduce((sum, v) => sum + v, 0) / revenueValues.length
        : 100000; // Default if no data

    // Get booking counts for last 6 months
    const recentBookings = await prisma.booking.findMany({
      where: {
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        createdAt: true,
      },
    });

    const monthlyBookings: Record<string, number> = {};
    for (const booking of recentBookings) {
      const key = `${booking.createdAt.getFullYear()}-${String(booking.createdAt.getMonth() + 1).padStart(2, "0")}`;
      monthlyBookings[key] = (monthlyBookings[key] || 0) + 1;
    }

    const bookingValues = Object.values(monthlyBookings);
    const avgBookings =
      bookingValues.length > 0
        ? Math.round(
            bookingValues.reduce((sum, v) => sum + v, 0) / bookingValues.length
          )
        : 5; // Default if no data

    // Generate forecast entries for each future month
    const forecastEntries = [];
    for (let i = 1; i <= monthsAhead; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const month = String(futureDate.getMonth() + 1).padStart(2, "0");
      const year = futureDate.getFullYear();
      const monthStr = `${year}-${month}`;

      // Delete existing forecast entry for this month/year if any
      await prisma.forecastEntry.deleteMany({
        where: { month: monthStr, year },
      });

      const entry = await prisma.forecastEntry.create({
        data: {
          month: monthStr,
          year,
          predictedRevenue: Math.round(avgRevenue * 1.1 * 100) / 100, // 10% growth
          predictedBookings: avgBookings,
          confidence: 0.7,
        },
      });

      forecastEntries.push(entry);
    }

    logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "ForecastEntry",
      entityId: forecastEntries[0]?.id ?? "batch",
      changes: { monthsGenerated: monthsAhead },
    });

    revalidatePath("/analytics/forecast");
    return { success: true as const, data: serialize(forecastEntries) };
  } catch (error) {
    console.error("[GENERATE_FORECAST_ERROR]", error);
    return { success: false as const, error: "Failed to generate forecast" };
  }
}

// ============================================================
// Get Budget vs Actual (Compare budget vs payment revenue by month)
// ============================================================

export async function getBudgetVsActual(year: number) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    // Get all budgets for the year
    const budgets = await prisma.budget.findMany({
      where: { year },
      orderBy: { month: "asc" },
    });

    // Get actual revenue from completed payments for the year
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const payments = await prisma.payment.findMany({
      where: {
        status: "COMPLETED",
        paidAt: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      select: {
        amount: true,
        paidAt: true,
      },
    });

    // Group actual revenue by month
    const actualByMonth: Record<string, number> = {};
    for (const payment of payments) {
      if (payment.paidAt) {
        const month = `${year}-${String(payment.paidAt.getMonth() + 1).padStart(2, "0")}`;
        actualByMonth[month] = (actualByMonth[month] || 0) + Number(payment.amount);
      }
    }

    // Build comparison data
    const comparison = budgets.map((budget) => ({
      id: budget.id,
      name: budget.name,
      month: budget.month,
      budgetedRevenue: Number(budget.revenue),
      budgetedExpenses: Number(budget.expenses),
      budgetedProfit: Number(budget.profit),
      actualRevenue: actualByMonth[budget.month] || 0,
      variance:
        (actualByMonth[budget.month] || 0) - Number(budget.revenue),
    }));

    return {
      success: true as const,
      data: serialize(comparison),
    };
  } catch (error) {
    console.error("[GET_BUDGET_VS_ACTUAL_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch budget vs actual data",
    };
  }
}

// ============================================================
// Get Venues (for budget form)
// ============================================================

export async function getVenuesForBudget() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const venues = await prisma.venue.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    return { success: true as const, data: serialize(venues) };
  } catch (error) {
    console.error("[GET_VENUES_FOR_BUDGET_ERROR]", error);
    return { success: false as const, error: "Failed to fetch venues" };
  }
}

// ============================================================
// AI Demand Forecast (Placeholder)
// ============================================================

export async function getAIDemandForecast(params?: {
  venueId?: string;
  months?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "forecast:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const predictions = await generateDemandForecast({
      venueId: params?.venueId,
      months: params?.months ?? 6,
    });

    return {
      success: true as const,
      data: serialize(predictions),
    };
  } catch (error) {
    console.error("[GET_AI_DEMAND_FORECAST_ERROR]", error);
    return { success: false as const, error: "Failed to generate AI demand forecast" };
  }
}

// ============================================================
// Venue Demand Heatmap
// ============================================================

export async function getVenueDemandHeatmap(year?: number) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "forecast:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const heatmap = await generateVenueHeatmap({ year });

    return {
      success: true as const,
      data: serialize(heatmap),
    };
  } catch (error) {
    console.error("[GET_VENUE_DEMAND_HEATMAP_ERROR]", error);
    return { success: false as const, error: "Failed to generate venue demand heatmap" };
  }
}
