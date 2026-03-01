"use client";

import {
  BuildingIcon,
  CalendarIcon,
  IndianRupeeIcon,
  StarIcon,
  SparklesIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/utils";
import type { VenuePerformanceData } from "@/actions/performance.actions";

// ============================================================
// Props
// ============================================================

interface VenuePerformanceGridProps {
  data: VenuePerformanceData[];
}

// ============================================================
// Utilization color helpers
// ============================================================

function getUtilizationColor(rate: number) {
  if (rate >= 70) {
    return {
      bar: "bg-emerald-500",
      text: "text-emerald-700 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
    };
  }
  if (rate >= 40) {
    return {
      bar: "bg-amber-500",
      text: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/30",
    };
  }
  return {
    bar: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-900/30",
  };
}

function getUtilizationLabel(rate: number) {
  if (rate >= 70) return "High";
  if (rate >= 40) return "Medium";
  return "Low";
}

// ============================================================
// Star Rating inline
// ============================================================

function MiniStarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: fullStars }).map((_, i) => (
          <StarIcon
            key={`full-${i}`}
            className="size-3.5 fill-yellow-400 text-yellow-400"
          />
        ))}
        {hasHalf && (
          <StarIcon className="size-3.5 fill-yellow-400/50 text-yellow-400" />
        )}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <StarIcon
            key={`empty-${i}`}
            className="size-3.5 fill-muted text-muted-foreground/30"
          />
        ))}
      </div>
      <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
        {rating > 0 ? rating.toFixed(1) : "N/A"}
      </span>
    </div>
  );
}

// ============================================================
// Venue Performance Grid Component
// ============================================================

export function VenuePerformanceGrid({ data }: VenuePerformanceGridProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <div className="text-center">
            <BuildingIcon className="mx-auto size-10 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              No venue performance data available.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Summary
  const totalRevenue = data.reduce((s, d) => s + d.totalRevenue, 0);
  const totalBookings = data.reduce((s, d) => s + d.totalBookings, 0);
  const avgUtilization =
    data.length > 0
      ? Math.round(
          data.reduce((s, d) => s + d.utilizationRate, 0) / data.length
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Venue Revenue
            </CardTitle>
            <IndianRupeeIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Across {data.length} venue{data.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Bookings
            </CardTitle>
            <CalendarIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalBookings.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-muted-foreground">
              All venues combined
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Utilization
            </CardTitle>
            <SparklesIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgUtilization}%</div>
            <p className="text-xs text-muted-foreground">
              Average across venues
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Venue Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((venue) => {
          const utilColor = getUtilizationColor(venue.utilizationRate);

          return (
            <Card key={venue.venueId} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                      <BuildingIcon className="size-4.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <CardTitle className="text-base">{venue.venueName}</CardTitle>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`${utilColor.bg} ${utilColor.text}`}
                  >
                    {getUtilizationLabel(venue.utilizationRate)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Metrics grid */}
                <div className="grid grid-cols-2 gap-3">
                  <MetricItem
                    label="Bookings"
                    value={venue.totalBookings.toLocaleString("en-IN")}
                  />
                  <MetricItem
                    label="Revenue"
                    value={formatINR(venue.totalRevenue)}
                  />
                  <MetricItem
                    label="Avg Booking"
                    value={formatINR(venue.avgBookingValue)}
                  />
                  <MetricItem
                    label="Top Event"
                    value={venue.topEventType}
                  />
                </div>

                {/* Utilization bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-600 dark:text-zinc-400">
                      Utilization Rate
                    </span>
                    <span className={`font-semibold ${utilColor.text}`}>
                      {venue.utilizationRate}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-full rounded-full transition-all ${utilColor.bar}`}
                      style={{ width: `${venue.utilizationRate}%` }}
                    />
                  </div>
                </div>

                {/* Rating */}
                <div className="flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Avg Rating
                  </span>
                  <MiniStarRating rating={venue.averageRating} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Metric Item helper
// ============================================================

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
        {value}
      </p>
    </div>
  );
}
