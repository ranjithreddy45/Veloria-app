"use client";

import { FlameIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface HeatmapMonth {
  month: string;
  demand: "high" | "medium" | "low";
  bookings: number;
}

interface HeatmapVenue {
  venueId: string;
  venueName: string;
  months: HeatmapMonth[];
}

interface DemandHeatmapProps {
  data: HeatmapVenue[];
  year: number;
}

// ============================================================
// Month Labels
// ============================================================

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ============================================================
// Demand Color Map
// ============================================================

const DEMAND_COLORS: Record<
  "high" | "medium" | "low",
  { bg: string; text: string; label: string }
> = {
  high: {
    bg: "bg-emerald-500 dark:bg-emerald-600",
    text: "text-white",
    label: "High",
  },
  medium: {
    bg: "bg-amber-400 dark:bg-amber-500",
    text: "text-amber-950 dark:text-white",
    label: "Medium",
  },
  low: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    label: "Low",
  },
};

// ============================================================
// DemandHeatmap Component
// ============================================================

export function DemandHeatmap({ data, year }: DemandHeatmapProps) {
  if (data.length === 0) {
    return (
      <Card className="rounded-2xl border bg-card shadow-card">
        <CardContent>
          <EmptyState
            icon={<FlameIcon />}
            title="No demand pattern yet"
            description="Add active venues to see which months run hot across the year."
            className="py-10"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border bg-card shadow-card">
      <CardHeader>
        <CardTitle>Venue Demand Heatmap</CardTitle>
        <CardDescription>
          Booking demand by venue and month for {year}. Hover over cells for
          booking counts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-detail">
          <span className="text-meta uppercase tracking-wide text-muted-foreground">
            Demand
          </span>
          {(["high", "medium", "low"] as const).map((level) => (
            <div key={level} className="flex items-center gap-1.5">
              <span
                className={cn("size-2.5 rounded-[3px]", DEMAND_COLORS[level].bg)}
              />
              <span className="text-muted-foreground">
                {DEMAND_COLORS[level].label}
              </span>
            </div>
          ))}
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Header Row - Month Labels */}
            <div className="grid grid-cols-[180px_repeat(12,1fr)] gap-1 mb-1">
              <div className="px-2 py-1 text-meta font-medium uppercase tracking-wide text-muted-foreground">
                Venue
              </div>
              {MONTH_LABELS.map((label) => (
                <div
                  key={label}
                  className="py-1 text-center text-meta font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Data Rows - One per venue */}
            {data.map((venue) => (
              <div
                key={venue.venueId}
                className="grid grid-cols-[180px_repeat(12,1fr)] gap-1 mb-1"
              >
                {/* Venue Name */}
                <div className="flex items-center truncate px-2 py-2 text-body font-medium">
                  {venue.venueName}
                </div>

                {/* Month Cells */}
                {venue.months.map((monthData) => {
                  const colors = DEMAND_COLORS[monthData.demand];
                  return (
                    <div
                      key={monthData.month}
                      className={cn(
                        "numeric flex items-center justify-center rounded-md py-2 text-meta font-medium transition-opacity hover:opacity-80",
                        colors.bg,
                        colors.text
                      )}
                      title={`${venue.venueName} - ${monthData.month}: ${monthData.bookings} booking${monthData.bookings !== 1 ? "s" : ""} (${colors.label} demand)`}
                    >
                      {monthData.bookings > 0 ? monthData.bookings : "-"}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
