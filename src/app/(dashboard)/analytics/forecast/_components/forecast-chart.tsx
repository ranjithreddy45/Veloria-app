"use client";

import { SparklesIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatINR } from "@/lib/utils";
import { FORECAST_CONFIDENCE_COLORS } from "@/lib/constants";

// ============================================================
// Types
// ============================================================

interface ForecastPrediction {
  month: string;
  predictedRevenue: number;
  predictedBookings: number;
  confidence: number;
  factors: string[];
}

interface ForecastEntry {
  id: string;
  month: string;
  year: number;
  predictedRevenue: number;
  predictedBookings: number;
  confidence: number;
  generatedAt: string;
}

interface ForecastChartProps {
  predictions: ForecastPrediction[];
  actuals: ForecastEntry[];
}

// ============================================================
// Helpers
// ============================================================

function getMonthLabel(monthStr: string): string {
  const [year, mon] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(mon) - 1);
  return date.toLocaleString("en-IN", { month: "short" });
}

function getConfidenceLevel(confidence: number): "HIGH" | "MEDIUM" | "LOW" {
  if (confidence >= 0.7) return "HIGH";
  if (confidence >= 0.5) return "MEDIUM";
  return "LOW";
}

// ============================================================
// ForecastChart Component
// ============================================================

export function ForecastChart({ predictions, actuals }: ForecastChartProps) {
  // Build a merged dataset: match actuals to predictions by month
  const actualsByMonth = new Map(actuals.map((a) => [a.month, a]));

  // Find the max revenue across all data for scaling
  const allRevenues = [
    ...predictions.map((p) => p.predictedRevenue),
    ...actuals.map((a) => a.predictedRevenue),
  ];
  const maxRevenue = Math.max(...allRevenues, 1);

  if (predictions.length === 0 && actuals.length === 0) {
    return (
      <Card className="gap-0 rounded-2xl border bg-card py-0 shadow-card">
        <CardContent className="px-5 py-5">
          <EmptyState
            icon={<SparklesIcon />}
            title="No forecast yet"
            description="Generate a forecast to project revenue and bookings for the months ahead."
            className="py-10"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0 rounded-2xl border bg-card py-0 shadow-card">
      <CardContent className="p-5">
        <div className="mb-4">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
            Revenue Forecast Chart
          </h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            AI-predicted revenue by month. Dashed bars indicate predicted
            values, solid bars show existing forecast entries.
          </p>
        </div>
        {/* Legend */}
        <div className="mb-4 flex flex-wrap items-center gap-4 text-[12px]">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-6 rounded-sm bg-emerald-500 dark:bg-emerald-600" />
            <span className="text-muted-foreground">Existing Forecast</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-6 rounded-sm border-2 border-dashed border-blue-500 dark:border-blue-400 bg-blue-100 dark:bg-blue-900/30" />
            <span className="text-muted-foreground">AI Prediction</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-6 rounded-sm bg-blue-200/50 dark:bg-blue-800/30" />
            <span className="text-muted-foreground">Confidence Band</span>
          </div>
        </div>

        {/* Chart Container */}
        <div className="relative">
          {/* Y-Axis Labels */}
          <div className="numeric absolute bottom-8 left-0 top-0 flex w-20 flex-col justify-between text-[10.5px] text-muted-foreground">
            <span>{formatINR(maxRevenue)}</span>
            <span>{formatINR(maxRevenue * 0.75)}</span>
            <span>{formatINR(maxRevenue * 0.5)}</span>
            <span>{formatINR(maxRevenue * 0.25)}</span>
            <span>{formatINR(0)}</span>
          </div>

          {/* Chart Area */}
          <div className="ml-20">
            {/* Grid Lines */}
            <div className="relative border-l border-b border-border">
              {/* Horizontal grid lines */}
              {[0.25, 0.5, 0.75, 1].map((fraction) => (
                <div
                  key={fraction}
                  className="absolute left-0 right-0 border-t border-dashed border-border/50"
                  style={{ bottom: `${fraction * 100}%` }}
                />
              ))}

              {/* Bars */}
              <div
                className="flex items-end gap-1 px-1"
                style={{ height: "280px" }}
              >
                {predictions.map((prediction) => {
                  const actual = actualsByMonth.get(prediction.month);
                  const barHeightPredicted =
                    (prediction.predictedRevenue / maxRevenue) * 100;
                  const barHeightActual = actual
                    ? (actual.predictedRevenue / maxRevenue) * 100
                    : 0;

                  return (
                    <div
                      key={prediction.month}
                      className="flex-1 flex flex-col items-center gap-0.5 min-w-0"
                    >
                      {/* Bar Group */}
                      <div className="relative w-full flex items-end justify-center gap-0.5 flex-1">
                        {/* Confidence band (background) */}
                        <div
                          className="absolute bottom-0 left-0 right-0 rounded-t-sm bg-blue-100/50 dark:bg-blue-800/20 transition-all"
                          style={{
                            height: `${barHeightPredicted * (1 + (1 - prediction.confidence) * 0.3)}%`,
                            opacity: prediction.confidence,
                          }}
                        />

                        {/* Actual bar (solid) */}
                        {actual && (
                          <div
                            className="relative z-10 w-[40%] rounded-t-sm bg-emerald-500 dark:bg-emerald-600 transition-all"
                            style={{ height: `${barHeightActual}%` }}
                            title={`Existing: ${formatINR(actual.predictedRevenue)}`}
                          />
                        )}

                        {/* Predicted bar (dashed border) */}
                        <div
                          className="relative z-10 w-[40%] rounded-t-sm border-2 border-dashed border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 transition-all"
                          style={{ height: `${barHeightPredicted}%` }}
                          title={`AI Predicted: ${formatINR(prediction.predictedRevenue)} | Bookings: ${prediction.predictedBookings} | Confidence: ${Math.round(prediction.confidence * 100)}%`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-Axis Labels */}
            <div className="flex gap-1 px-1 mt-2">
              {predictions.map((prediction) => (
                <div
                  key={prediction.month}
                  className="flex-1 text-center min-w-0"
                >
                  <span className="numeric block truncate text-[11px] text-muted-foreground">
                    {getMonthLabel(prediction.month)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Prediction Details */}
        <div className="mt-6 space-y-2">
          <h4 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
            AI Prediction Details
          </h4>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {predictions.map((prediction) => {
              const confidenceLevel = getConfidenceLevel(prediction.confidence);
              const confidenceColors =
                FORECAST_CONFIDENCE_COLORS[confidenceLevel];

              return (
                <div
                  key={prediction.month}
                  className="space-y-2.5 rounded-xl border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold tracking-[-0.01em]">
                      {getMonthLabel(prediction.month)}{" "}
                      <span className="numeric font-medium text-muted-foreground">
                        {prediction.month.split("-")[0]}
                      </span>
                    </span>
                    <Badge
                      variant="secondary"
                      className={`numeric ${confidenceColors}`}
                    >
                      {Math.round(prediction.confidence * 100)}%
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">Revenue</span>
                      <span className="numeric font-medium text-emerald-700 dark:text-emerald-400">
                        {formatINR(prediction.predictedRevenue)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">Bookings</span>
                      <span className="numeric font-medium">
                        {prediction.predictedBookings}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {prediction.factors.map((factor, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-[11px] font-normal text-muted-foreground"
                      >
                        {factor}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
