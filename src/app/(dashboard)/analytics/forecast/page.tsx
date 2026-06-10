import type { Metadata } from "next";
import {
  TrendingUpIcon,
  CalendarIcon,
  TargetIcon,
} from "lucide-react";

import {
  getForecastEntries,
  getVenueDemandHeatmap,
  getVenuesForBudget,
} from "@/actions/forecast.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { formatINR } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GenerateForecastButton } from "./_components/generate-forecast-button";
import { ForecastDashboard } from "./_components/forecast-dashboard";

export const metadata: Metadata = { title: "Revenue Forecast" };

// ============================================================
// Forecast Dashboard Page
// ============================================================

export default async function ForecastPage() {
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
        title="Revenue Forecast"
        help={<PageHelp id="forecast" />}
        description="AI-powered demand forecasting with predicted revenue, bookings, and venue demand heatmaps."
      >
        <GenerateForecastButton />
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Next Month Predicted Revenue
            </CardTitle>
            <TrendingUpIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {nextMonthForecast
                ? formatINR(nextMonthForecast.predictedRevenue)
                : "--"}
            </div>
            <p className="text-xs text-muted-foreground">
              {nextMonthForecast
                ? `For ${nextMonthForecast.month}`
                : "No forecast generated yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Next Month Predicted Bookings
            </CardTitle>
            <CalendarIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {nextMonthForecast
                ? nextMonthForecast.predictedBookings
                : "--"}
            </div>
            <p className="text-xs text-muted-foreground">
              {nextMonthForecast
                ? `For ${nextMonthForecast.month}`
                : "No forecast generated yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Confidence
            </CardTitle>
            <TargetIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {entries.length > 0
                ? `${Math.round(avgConfidence * 100)}%`
                : "--"}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {entries.length} forecast{entries.length !== 1 ? "s" : ""}
              {" | "}
              Total predicted: {formatINR(totalPredictedRevenue)},{" "}
              {totalPredictedBookings} bookings
            </p>
          </CardContent>
        </Card>
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
