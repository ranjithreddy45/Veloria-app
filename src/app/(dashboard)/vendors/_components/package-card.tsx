"use client";

import Link from "next/link";
import { ImageIcon, LayersIcon, ListChecksIcon } from "lucide-react";

import {
  VENDOR_MODULE_CATEGORY_LABELS,
  VENDOR_PACKAGE_PRICE_UNIT_LABELS,
} from "@/lib/constants";
import { formatINR, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import type { PackageCardData } from "@/app/(dashboard)/vendors/_components/vendor-module";

// ============================================================
// Package status colour map — alpha tints so both themes work
// ============================================================

const PACKAGE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border-border",
  ACTIVE:
    "bg-success/12 text-success border-success/25",
  ARCHIVED:
    "bg-slate-500/12 text-slate-600 border-slate-500/20 dark:text-slate-300",
};

const CATEGORY_HUE: Record<string, string> = {
  decor: "bg-pink-500/12 text-pink-700 border-pink-500/25 dark:text-pink-300",
  catering: "bg-amber-500/14 text-amber-700 border-amber-500/25 dark:text-amber-300",
  emcee: "bg-violet-500/12 text-violet-700 border-violet-500/25 dark:text-violet-300",
  photography: "bg-indigo-500/12 text-indigo-700 border-indigo-500/25 dark:text-indigo-300",
  av_lighting: "bg-orange-500/12 text-orange-700 border-orange-500/25 dark:text-orange-300",
  entertainment: "bg-rose-500/12 text-rose-700 border-rose-500/25 dark:text-rose-300",
};

// ============================================================
// PackageCard
// ============================================================

interface PackageCardProps {
  data: PackageCardData;
  href?: string;
}

export function PackageCard({ data, href }: PackageCardProps) {
  const categoryLabel =
    VENDOR_MODULE_CATEGORY_LABELS[data.category] ?? data.category;
  const priceUnitLabel =
    VENDOR_PACKAGE_PRICE_UNIT_LABELS[data.priceUnit] ?? data.priceUnit;

  const card = (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-card transition-shadow duration-200",
        href && "hover:shadow-card-hover",
        data.status === "ARCHIVED" && "opacity-70"
      )}
    >
      {/* ── Cover ── */}
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-muted">
        {data.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.coverUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-teal-500/10 via-muted to-muted">
            <ImageIcon className="size-7 text-muted-foreground/50" />
            <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
              No photo yet
            </span>
          </div>
        )}

        {/* Category chip — top-left, legible over any image */}
        <Badge
          variant="outline"
          className={cn(
            "absolute left-3 top-3 border text-[11px] font-semibold backdrop-blur-md",
            CATEGORY_HUE[data.category] ??
              "border-border bg-background/85 text-foreground"
          )}
        >
          {categoryLabel}
        </Badge>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Vendor eyebrow → package name hierarchy */}
        <div className="space-y-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {data.vendor.name}
          </p>
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
              {data.name}
            </p>
            <StatusBadge
              status={data.status}
              colorMap={PACKAGE_STATUS_COLORS}
              className="mt-0.5 shrink-0 text-[10px]"
            />
          </div>
        </div>

        {/* Description */}
        {data.description && (
          <p className="line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
            {data.description}
          </p>
        )}

        {/* Inclusions summary — scannable, quiet */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ListChecksIcon className="size-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
            <span className="numeric font-medium text-foreground">
              {data.itemCount}
            </span>
            {data.itemCount === 1 ? "inclusion" : "inclusions"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <LayersIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
            <span className="numeric font-medium text-foreground">
              {data.sectionCount}
            </span>
            {data.sectionCount === 1 ? "section" : "sections"}
          </span>
        </div>

        {/* Price — the anchor */}
        <div className="mt-auto flex items-baseline justify-between gap-2 border-t pt-3">
          <p className="numeric text-[19px] font-semibold leading-none tracking-[-0.01em] text-foreground">
            {formatINR(data.price)}
          </p>
          <p className="text-[11.5px] font-medium text-muted-foreground">
            {priceUnitLabel}
          </p>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {card}
      </Link>
    );
  }

  return card;
}
