import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ============================================================
// A function sheet (/beo/<id>) while it loads.
// ------------------------------------------------------------
// Without this file the sheet fell back to (dashboard)/loading.tsx, whose
// title box sits under a 16px eyebrow placeholder at 24px. The sheet's header
// is bespoke (beo-detail.tsx): a "Function sheets" back link, then the title
// row (module chip, a 32.5px text-h2 h1 and the status pill), dropped 4px from
// sm up so the title's first line centres on the chip. This repeats the
// header's own wrappers and classes, and draws the back link itself (it is the
// same on every sheet), so the title row starts exactly where it will,
// whatever the font's line metrics. Keep it in step with beo-detail.tsx.
//
// The Guest numbers panel (CoversPanel) now renders under the header, so its
// height, which depends on the guest list, can only move what comes after it,
// never the title. Its placeholder is the panel's frame with the four figures.
// The Publish / Lock buttons depend on role and status, so they get no
// placeholder; they sit right of (or, on a phone, below) the title block and
// never move it.
//
// data-slot / data-skeleton-part match PageHeaderSkeleton's, so the e2e
// helper measureSkeletonTitle can measure this header too.
// ============================================================

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <div
        aria-busy="true"
        data-slot="page-header-skeleton"
        className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <span className="sr-only">Loading…</span>
        <div className="min-w-0 space-y-1.5">
          <Link
            href="/beo"
            className="inline-flex items-center gap-1 text-detail text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Function sheets
          </Link>
          <div className="flex min-w-0 items-start gap-2.5">
            <Skeleton className="mr-1 hidden size-10 shrink-0 rounded-xl sm:block" />
            <div className="flex min-w-0 items-center gap-2.5 sm:pt-1">
              {/* The h1's 32.5px line box; it is the row's tallest item, so
                  the row centres the pill on it as it does on the h1. */}
              <Skeleton data-skeleton-part="title" className="h-8 w-40 min-w-0 rounded-xl" />
              <Skeleton className="h-5.5 w-20 shrink-0 rounded-full" />
            </div>
          </div>
          {/* Event · type · venue · date · covers: one text-body line. */}
          <div className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-80 max-w-full rounded-full" />
          </div>
        </div>
      </div>

      {/* Guest numbers: the panel's frame, heading and four figures. */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <div className="flex h-5 items-center gap-2">
          <Skeleton className="size-4 rounded-full" />
          <Skeleton className="h-3.5 w-28 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-2.5 w-20 rounded-full" />
              <Skeleton className="h-6 w-12 rounded-lg" />
              <Skeleton className="h-2.5 w-24 max-w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Covers, Run of show and Department briefs; Incidents and package
          snapshots in the side column. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          {[2, 5, 4].map((rows, c) => (
            <Card key={c}>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: rows }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full rounded-md" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex flex-col gap-5">
          {[3, 2].map((rows, c) => (
            <Card key={c}>
              <CardHeader>
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: rows }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3.5 w-40 max-w-full" />
                    <Skeleton className="h-2.5 w-24 rounded-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
