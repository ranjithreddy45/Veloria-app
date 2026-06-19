"use client";

import Link from "next/link";
import { ImageIcon } from "lucide-react";

import {
  VENDOR_MODULE_CATEGORY_LABELS,
  VENDOR_PACKAGE_PRICE_UNIT_LABELS,
} from "@/lib/constants";
import { formatINR, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import type { PackageCardData } from "@/app/(dashboard)/vendors/_components/vendor-module";

// ============================================================
// Package status color map
// ============================================================

const PACKAGE_STATUS_COLORS: Record<string, string> = {
  DRAFT:
    "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
  ACTIVE:
    "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  ARCHIVED:
    "bg-slate-50 text-slate-600 border-slate-200/60 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700/40",
};

const CATEGORY_HUE: Record<string, string> = {
  decor: "bg-pink-50 text-pink-700 border-pink-200/80",
  catering: "bg-amber-50 text-amber-700 border-amber-200/80",
  emcee: "bg-violet-50 text-violet-700 border-violet-200/80",
  photography: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
  av_lighting: "bg-orange-50 text-orange-700 border-orange-200/80",
  entertainment: "bg-rose-50 text-rose-700 border-rose-200/80",
};

const COVER_GRADIENT: Record<string, string> = {
  decor: "from-pink-400/80 to-rose-600/80",
  catering: "from-amber-400/80 to-orange-600/80",
  emcee: "from-violet-400/80 to-purple-600/80",
  photography: "from-indigo-400/80 to-blue-600/80",
  av_lighting: "from-orange-400/80 to-red-600/80",
  entertainment: "from-rose-400/80 to-pink-600/80",
};

// ============================================================
// PackageCard
// ============================================================

interface PackageCardProps {
  data: PackageCardData;
  href?: string;
}

export function PackageCard({ data, href }: PackageCardProps) {
  const priceLabel = `${formatINR(data.price)} ${VENDOR_PACKAGE_PRICE_UNIT_LABELS[data.priceUnit] ?? data.priceUnit}`;
  const categoryLabel = VENDOR_MODULE_CATEGORY_LABELS[data.category] ?? data.category;
  const gradient = COVER_GRADIENT[data.category] ?? "from-violet-400/80 to-indigo-600/80";

  const card = (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card transition-shadow duration-200 hover:shadow-card-hover",
        data.status === "ARCHIVED" && "opacity-70"
      )}
    >
      {/* ── Cover image area ── */}
      <div className="relative h-40 w-full shrink-0 overflow-hidden bg-muted">
        {data.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.coverUrl}
            alt={data.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center bg-gradient-to-br",
              gradient
            )}
          >
            <ImageIcon className="size-10 text-white/60" />
          </div>
        )}

        {/* Scrim for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* Category chip — top-left */}
        <span
          className={cn(
            "absolute left-3 top-3 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm",
            CATEGORY_HUE[data.category] ?? "bg-white/90 text-foreground border-border"
          )}
        >
          {categoryLabel}
        </span>

        {/* Price — bottom-right over image */}
        <div className="absolute bottom-2.5 right-3 text-right">
          <p className="text-[15px] font-bold tabular-nums leading-tight text-white drop-shadow">
            {formatINR(data.price)}
          </p>
          <p className="text-[11px] font-medium text-white/80">
            {VENDOR_PACKAGE_PRICE_UNIT_LABELS[data.priceUnit] ?? data.priceUnit}
          </p>
        </div>
      </div>

      {/* ── Card body ── */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Name + status */}
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-[14px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
            {data.name}
          </p>
          <StatusBadge
            status={data.status}
            colorMap={PACKAGE_STATUS_COLORS}
            className="shrink-0 text-[10px]"
          />
        </div>

        {/* Vendor name */}
        <p className="text-[12px] text-muted-foreground">{data.vendor.name}</p>

        {/* Description */}
        {data.description && (
          <p className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
            {data.description}
          </p>
        )}

        {/* Counts footer */}
        <div className="mt-auto flex items-center gap-1 pt-2 text-[11px] tabular-nums text-muted-foreground/70">
          <span className="font-medium text-foreground/70">{data.itemCount}</span>
          <span>{data.itemCount === 1 ? "item" : "items"}</span>
          <span className="mx-1 opacity-40">·</span>
          <span className="font-medium text-foreground/70">{data.sectionCount}</span>
          <span>{data.sectionCount === 1 ? "section" : "sections"}</span>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl">
        {card}
      </Link>
    );
  }

  return card;
}
