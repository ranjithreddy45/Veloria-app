"use client";

import * as React from "react";
import {
  PackageIcon,
  CheckCircle2Icon,
  LayersIcon,
  IndianRupeeIcon,
} from "lucide-react";

import { formatINR } from "@/lib/utils";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import {
  SegmentedControl,
  type SegmentOption,
} from "@/components/ui/segmented-control";
import { PackageCard } from "./package-card";

// ============================================================
// PackagesCatalog — colorful summary strip + category filter + card grid.
// Client component (filter state). Visual-only; no data fetching here.
// ============================================================

interface Pkg {
  id: string;
  name: string;
  description: string | null;
  eventType: string | null;
  basePrice: number;
  tier: string;
  isActive: boolean;
  imageUrl: string | null;
  _count: { items: number };
}

interface PackagesCatalogProps {
  packages: Pkg[];
}

const ALL = "__all__";

export function PackagesCatalog({ packages }: PackagesCatalogProps) {
  const [eventType, setEventType] = React.useState<string>(ALL);

  // Distinct event types (the natural catalog "category").
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of packages) {
      if (p.eventType) set.add(p.eventType);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [packages]);

  const filtered = React.useMemo(() => {
    if (eventType === ALL) return packages;
    return packages.filter((p) => p.eventType === eventType);
  }, [packages, eventType]);

  // Summary stats (existing data only).
  const total = packages.length;
  const active = packages.filter((p) => p.isActive).length;
  const priced = packages.filter((p) => p.basePrice > 0);
  const minPrice = priced.length
    ? Math.min(...priced.map((p) => p.basePrice))
    : 0;
  const maxPrice = priced.length
    ? Math.max(...priced.map((p) => p.basePrice))
    : 0;

  const priceValue =
    priced.length === 0
      ? "—"
      : minPrice === maxPrice
        ? formatINR(minPrice)
        : `${formatINR(minPrice)} – ${formatINR(maxPrice)}`;

  const filterOptions: SegmentOption<string>[] = [
    { value: ALL, label: "All" },
    ...categories.map((c) => ({ value: c, label: c })),
  ];

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Total packages"
          value={<span className="tabular-nums">{total}</span>}
          accent="indigo"
          icon={<PackageIcon className="size-4" />}
        />
        <StatTile
          label="Active"
          value={<span className="tabular-nums">{active}</span>}
          accent="emerald"
          icon={<CheckCircle2Icon className="size-4" />}
          sub={total > 0 ? `${total - active} inactive` : undefined}
        />
        <StatTile
          label="Categories"
          value={<span className="tabular-nums">{categories.length}</span>}
          accent="gold"
          icon={<LayersIcon className="size-4" />}
        />
        <StatTile
          label="Price range"
          value={<span className="text-lg">{priceValue}</span>}
          accent="amber"
          icon={<IndianRupeeIcon className="size-4" />}
        />
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <SegmentedControl
            options={filterOptions}
            value={eventType}
            onChange={setEventType}
            ariaLabel="Filter packages by category"
            size="sm"
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            {filtered.length} {filtered.length === 1 ? "package" : "packages"}
          </span>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<PackageIcon className="size-5" />}
          title="No packages in this category"
          description="Try a different category, or create a new package."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}
    </div>
  );
}
