import { prisma } from "@/lib/prisma";

// ============================================================
// AI Demand Forecasting (Rule-Based Placeholder)
// ============================================================
// Mimics AI-powered demand forecasting using deterministic rules.
// Will be replaced with real OpenAI/ML-based forecasting later.

// ============================================================
// Types
// ============================================================

export interface ForecastPrediction {
  month: string; // "2026-03"
  predictedRevenue: number;
  predictedBookings: number;
  confidence: number; // 0-1
  factors: string[];
}

export interface VenueHeatmapEntry {
  venueId: string;
  venueName: string;
  months: {
    month: string;
    demand: "high" | "medium" | "low";
    bookings: number;
  }[];
}

// ============================================================
// Seasonal Multipliers
// ============================================================

const SEASONAL_MULTIPLIERS: Record<number, { multiplier: number; label: string }> = {
  1:  { multiplier: 0.9,  label: "Winter slowdown" },
  2:  { multiplier: 0.9,  label: "Winter slowdown" },
  3:  { multiplier: 1.3,  label: "Wedding season peak" },
  4:  { multiplier: 1.3,  label: "Wedding season peak" },
  5:  { multiplier: 1.3,  label: "Wedding season peak" },
  6:  { multiplier: 1.3,  label: "Wedding season peak" },
  7:  { multiplier: 0.8,  label: "Monsoon season dip" },
  8:  { multiplier: 0.8,  label: "Monsoon season dip" },
  9:  { multiplier: 0.8,  label: "Monsoon season dip" },
  10: { multiplier: 1.2,  label: "Festive season boost" },
  11: { multiplier: 1.2,  label: "Festive season boost" },
  12: { multiplier: 1.2,  label: "Festive season boost" },
};

// Year-over-year growth assumption
const YOY_GROWTH = 0.1; // 10%

// ============================================================
// Generate Demand Forecast
// ============================================================
// Looks at past 12 months of bookings from prisma
// Calculates monthly averages, applies seasonal multipliers
// Returns predictions with confidence decreasing the further out

export async function generateDemandForecast(params: {
  venueId?: string;
  months?: number;
}): Promise<ForecastPrediction[]> {
  const monthsAhead = params.months ?? 6;
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);

  // Build where clause for historical bookings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookingWhere: any = {
    createdAt: { gte: twelveMonthsAgo },
  };
  if (params.venueId) {
    bookingWhere.venueId = params.venueId;
  }

  // Fetch historical bookings
  const historicalBookings = await prisma.booking.findMany({
    where: bookingWhere,
    select: {
      createdAt: true,
      totalAmount: true,
    },
  });

  // Group by month
  const monthlyData: Record<string, { revenue: number; count: number }> = {};
  for (const booking of historicalBookings) {
    const key = `${booking.createdAt.getFullYear()}-${String(booking.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyData[key]) {
      monthlyData[key] = { revenue: 0, count: 0 };
    }
    monthlyData[key].revenue += Number(booking.totalAmount);
    monthlyData[key].count += 1;
  }

  const dataPoints = Object.values(monthlyData);
  const avgRevenue =
    dataPoints.length > 0
      ? dataPoints.reduce((sum, d) => sum + d.revenue, 0) / dataPoints.length
      : 100000;
  const avgBookings =
    dataPoints.length > 0
      ? Math.round(
          dataPoints.reduce((sum, d) => sum + d.count, 0) / dataPoints.length
        )
      : 5;

  // Generate predictions
  const predictions: ForecastPrediction[] = [];

  for (let i = 1; i <= monthsAhead; i++) {
    const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const futureMonth = futureDate.getMonth() + 1;
    const monthStr = `${futureDate.getFullYear()}-${String(futureMonth).padStart(2, "0")}`;

    const seasonal = SEASONAL_MULTIPLIERS[futureMonth];
    const growthFactor = 1 + YOY_GROWTH;

    // Apply seasonal multiplier + growth + small variance
    const variance = 1 + (Math.random() * 0.1 - 0.05); // -5% to +5%
    const predictedRevenue =
      Math.round(avgRevenue * seasonal.multiplier * growthFactor * variance * 100) / 100;
    const predictedBookings = Math.max(
      1,
      Math.round(avgBookings * seasonal.multiplier * growthFactor * variance)
    );

    // Confidence decreases the further out we forecast
    // Starts at 0.85 and drops by 0.05 per month
    const confidence = Math.max(0.3, Math.round((0.85 - (i - 1) * 0.05) * 100) / 100);

    // Build factor descriptions
    const factors: string[] = [seasonal.label, "Historical trend"];
    if (growthFactor > 1) {
      factors.push(`${Math.round(YOY_GROWTH * 100)}% year-over-year growth`);
    }
    if (dataPoints.length === 0) {
      factors.push("Default baseline (no historical data)");
    }
    if (i > 3) {
      factors.push("Extended forecast - lower confidence");
    }

    predictions.push({
      month: monthStr,
      predictedRevenue,
      predictedBookings,
      confidence,
      factors,
    });
  }

  return predictions;
}

// ============================================================
// Generate Venue Heatmap
// ============================================================
// Queries bookings grouped by venue and month
// Classifies demand based on booking count vs venue capacity

export async function generateVenueHeatmap(params?: {
  year?: number;
}): Promise<VenueHeatmapEntry[]> {
  const year = params?.year ?? new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  // Get all active venues with their capacity
  const venues = await prisma.venue.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      capacity: true,
    },
    orderBy: { name: "asc" },
  });

  // Get all bookings for the year grouped by venue
  const bookings = await prisma.booking.findMany({
    where: {
      date: {
        gte: yearStart,
        lte: yearEnd,
      },
    },
    select: {
      venueId: true,
      date: true,
    },
  });

  // Group bookings by venue and month
  const bookingMap: Record<string, Record<string, number>> = {};
  for (const booking of bookings) {
    const venueId = booking.venueId;
    const month = `${year}-${String(new Date(booking.date).getMonth() + 1).padStart(2, "0")}`;

    if (!bookingMap[venueId]) {
      bookingMap[venueId] = {};
    }
    bookingMap[venueId][month] = (bookingMap[venueId][month] || 0) + 1;
  }

  // Build heatmap entries
  const heatmapEntries: VenueHeatmapEntry[] = venues.map((venue) => {
    const venueBookings = bookingMap[venue.id] || {};

    // Calculate max possible bookings per month as reference
    // Assume ~30 days per month, each day can hold one event
    const maxMonthlyBookings = 30;

    const months = Array.from({ length: 12 }, (_, i) => {
      const monthStr = `${year}-${String(i + 1).padStart(2, "0")}`;
      const bookingCount = venueBookings[monthStr] || 0;

      // Classify demand based on utilization rate
      const utilization = bookingCount / maxMonthlyBookings;
      let demand: "high" | "medium" | "low";
      if (utilization >= 0.5 || bookingCount >= 15) {
        demand = "high";
      } else if (utilization >= 0.2 || bookingCount >= 6) {
        demand = "medium";
      } else {
        demand = "low";
      }

      return {
        month: monthStr,
        demand,
        bookings: bookingCount,
      };
    });

    return {
      venueId: venue.id,
      venueName: venue.name,
      months,
    };
  });

  return heatmapEntries;
}
