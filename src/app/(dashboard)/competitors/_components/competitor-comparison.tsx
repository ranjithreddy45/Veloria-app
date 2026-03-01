"use client";

import * as React from "react";
import {
  StarIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  GlobeIcon,
  MapPinIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { COMPETITOR_RATING_COLORS } from "@/lib/constants";

// ============================================================
// Types
// ============================================================

interface CompetitorData {
  id: string;
  name: string;
  website: string | null;
  location: string | null;
  venueTypes: string[];
  priceRange: string | null;
  rating: number | null;
  strengths: string | null;
  weaknesses: string | null;
  notes: string | null;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

interface CompetitorComparisonProps {
  data: CompetitorData[];
}

// ============================================================
// Price Range to Numeric Value (for comparison bar)
// ============================================================

const PRICE_RANGE_VALUES: Record<string, number> = {
  Budget: 1,
  Economy: 2,
  "Mid-Range": 3,
  Premium: 4,
  Luxury: 5,
};

function PriceBar({ priceRange }: { priceRange: string | null }) {
  const level = priceRange ? (PRICE_RANGE_VALUES[priceRange] ?? 0) : 0;
  const maxLevel = 5;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Price Range</span>
        <span className="font-medium">{priceRange || "Unknown"}</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: maxLevel }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 flex-1 rounded-full transition-colors",
              i < level
                ? "bg-amber-400 dark:bg-amber-500"
                : "bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Rating Stars (compact)
// ============================================================

function CompactRating({ rating }: { rating: number | null }) {
  if (!rating) {
    return <span className="text-muted-foreground text-sm">Not rated</span>;
  }

  const colorClass = COMPETITOR_RATING_COLORS[rating] ?? "text-yellow-500";

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon
          key={i}
          className={cn(
            "size-4",
            i < rating
              ? "fill-yellow-400 text-yellow-400"
              : "fill-muted text-muted-foreground/30"
          )}
        />
      ))}
      <span className={cn("ml-1 text-sm font-semibold", colorClass)}>
        {rating}/5
      </span>
    </div>
  );
}

// ============================================================
// Venue Type Overlap Badges
// ============================================================

function VenueOverlapBadges({
  venueTypes,
  allVenueTypes,
}: {
  venueTypes: string[];
  allVenueTypes: string[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {allVenueTypes.map((type) => {
        const hasType = venueTypes.includes(type);
        return (
          <Badge
            key={type}
            variant={hasType ? "default" : "outline"}
            className={cn(
              "text-xs",
              hasType
                ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
                : "opacity-40"
            )}
          >
            {type}
          </Badge>
        );
      })}
    </div>
  );
}

// ============================================================
// CompetitorComparison Component
// ============================================================

export function CompetitorComparison({ data }: CompetitorComparisonProps) {
  // Collect all unique venue types across all competitors
  const allVenueTypes = React.useMemo(() => {
    const types = new Set<string>();
    data.forEach((c) => c.venueTypes.forEach((t) => types.add(t)));
    return Array.from(types).sort();
  }, [data]);

  if (data.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Summary Comparison Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rating Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data
              .slice()
              .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
              .map((competitor) => (
                <div
                  key={competitor.id}
                  className="flex items-center justify-between gap-4 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{competitor.name}</p>
                    {competitor.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPinIcon className="size-3" />
                        {competitor.location}
                      </p>
                    )}
                  </div>
                  <CompactRating rating={competitor.rating} />
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Venue Type Overlap */}
      {allVenueTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Venue Type Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.map((competitor) => (
                <div key={competitor.id} className="space-y-1.5">
                  <p className="text-sm font-medium">{competitor.name}</p>
                  <VenueOverlapBadges
                    venueTypes={competitor.venueTypes}
                    allVenueTypes={allVenueTypes}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SWOT-style Side-by-Side Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((competitor) => (
          <Card key={competitor.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="space-y-1">
                <CardTitle className="text-base">{competitor.name}</CardTitle>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {competitor.location && (
                    <span className="flex items-center gap-1">
                      <MapPinIcon className="size-3" />
                      {competitor.location}
                    </span>
                  )}
                  {competitor.website && (
                    <a
                      href={competitor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <GlobeIcon className="size-3" />
                      Website
                    </a>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              {/* Rating & Price */}
              <CompactRating rating={competitor.rating} />
              <PriceBar priceRange={competitor.priceRange} />

              {/* Strengths */}
              <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ShieldCheckIcon className="size-4 text-green-600 dark:text-green-400" />
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                    Strengths
                  </p>
                </div>
                <p className="text-sm text-green-800 dark:text-green-300 whitespace-pre-line">
                  {competitor.strengths || "No strengths recorded."}
                </p>
              </div>

              {/* Weaknesses */}
              <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ShieldAlertIcon className="size-4 text-red-600 dark:text-red-400" />
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                    Weaknesses
                  </p>
                </div>
                <p className="text-sm text-red-800 dark:text-red-300 whitespace-pre-line">
                  {competitor.weaknesses || "No weaknesses recorded."}
                </p>
              </div>

              {/* Notes (as opportunities/observations) */}
              {competitor.notes && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1.5">
                    Notes &amp; Observations
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-300 whitespace-pre-line">
                    {competitor.notes}
                  </p>
                </div>
              )}

              {/* Venue Types */}
              {competitor.venueTypes.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                    Venue Types
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {competitor.venueTypes.map((type) => (
                      <Badge
                        key={type}
                        variant="secondary"
                        className="text-xs"
                      >
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
