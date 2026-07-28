import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  TrendingUpIcon,
  CalendarIcon,
  TargetIcon,
} from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import {
  getForecastEntries,
  getVenueDemandHeatmap,
  getVenuesForBudget,
} from "@/actions/forecast.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { formatINR } from "@/lib/utils";
import { StatTile } from "@/components/ui/stat-tile";
import { GenerateForecastButton } from "./_components/generate-forecast-button";
import { ForecastDashboard } from "./_components/forecast-dashboard";

export const metadata: Metadata = { title: "Revenue Forecast" };

// ============================================================
// Forecast Dashboard Page
// ============================================================

export default async function ForecastPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  if (!hasPermission(session.user.role as string, "forecast:read")) {
    redirect("/not-authorized");
  }

  // Fetch data in parallel
  const [forecastResult, heatmapResult, venuesResult] = await Promise.all([
    getForecastEntries(),
    getVenueDemandHeatmap(),
    getVenuesForBudget(),
  ]);

  const entries = forecastResult.success ? forecastResult.data : [];
  const heatmapData = heatmapResult.success ? heatmapResult.data : [];
  const venues = venuesResult.success ? venuesResult.data : [];

  // Find the next month forecast (first future entry)
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const futureEntries = entries.filter(
    (entry: { month: string }) => entry.month > currentMonthStr
  );
  const nextMonthForecast = futureEntries.length > 0 ? futureEntries[0] : null;

  // Calculate stats from all entries
  const totalPredictedRevenue = entries.reduce(
    (sum: number, e: { predictedRevenue: number }) => sum + e.predictedRevenue,
    0
  );
  const totalPredictedBookings = entries.reduce(
    (sum: number, e: { predictedBookings: number }) => sum + e.predictedBookings,
    0
  );
  const avgConfidence =
    entries.length > 0
      ? entries.reduce(
          (sum: number, e: { confidence: number }) => sum + e.confidence,
          0
        ) / entries.length
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="Analytics · Forecast"
        icon={TrendingUpIcon}
        accent="emerald"
        title="Revenue Forecast"
        help={<PageHelp id="forecast" />}
        description="AI-powered demand forecasting with predicted revenue, bookings, and venue demand heatmaps."
      >
        <GenerateForecastButton />
      </PageHeader>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Next Month Predicted Revenue"
          value={
            nextMonthForecast
              ? formatINR(nextMonthForecast.predictedRevenue)
              : "--"
          }
          accent="emerald"
          icon={<TrendingUpIcon className="size-4" />}
          sub={
            nextMonthForecast
              ? `For ${nextMonthForecast.month}`
              : "No forecast generated yet"
          }
        />
        <StatTile
          label="Next Month Predicted Bookings"
          value={nextMonthForecast ? nextMonthForecast.predictedBookings : "--"}
          accent="blue"
          icon={<CalendarIcon className="size-4" />}
          sub={
            nextMonthForecast
              ? `For ${nextMonthForecast.month}`
              : "No forecast generated yet"
          }
        />
        <StatTile
          label="Average Confidence"
          value={
            entries.length > 0 ? `${Math.round(avgConfidence * 100)}%` : "--"
          }
          accent="violet"
          icon={<TargetIcon className="size-4" />}
          pct={entries.length > 0 ? Math.round(avgConfidence * 100) : undefined}
          sub={`Across ${entries.length} forecast${entries.length !== 1 ? "s" : ""} · Total predicted: ${formatINR(totalPredictedRevenue)}, ${totalPredictedBookings} bookings`}
        />
      </div>

      {/* Forecast Dashboard with Tabs */}
      <ForecastDashboard
        entries={entries}
        heatmapData={heatmapData}
        venues={venues}
        currentYear={now.getFullYear()}
      />
    </div>
  );
}
