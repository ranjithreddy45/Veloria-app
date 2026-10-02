import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ============================================================
// A kitchen plan (/kitchen/<id>) while it loads.
// ------------------------------------------------------------
// Without this file the plan fell back to (dashboard)/loading.tsx, whose title
// box sits under a 16px eyebrow placeholder, 24px down. The plan's header is
// bespoke (kitchen-detail.tsx): an "All plans" back row, then a card whose
// title row is the module chip and a 28px text-xl h1, dropped 6px from sm up
// so it centres on the chip, with the event date under it. This repeats the
// back row and that card with their own wrappers and classes, and draws the
// back link itself (it is the same on every plan), so the title starts
// exactly where it will. Keep it in step with kitchen-detail.tsx.
//
// The back row is held at the Function Sheet link's height (min-h-6.5) on the
// page too, so whether or not a plan links to a sheet, the card does not move;
// the link itself gets no placeholder. The covers control and the status
// select (or, for a read-only viewer, the status pill) sit right of the title
// from sm up and below it on a phone, so they never move it.
//
// The Guest numbers panel (CoversPanel) renders under the header, so its
// height, which depends on the guest list, can only move what comes after it,
// never the title. Its placeholder is the panel's frame with the four figures.
//
// data-slot / data-skeleton-part match PageHeaderSkeleton's, so the e2e
// helper measureSkeletonTitle can measure this header too.
// ============================================================

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <div aria-busy="true" data-slot="page-header-skeleton" className="flex flex-col gap-5">
        <span className="sr-only">Loading…</span>
        <div>
          <div className="flex min-h-6.5 items-center justify-between gap-2">
            <Link
              href="/kitchen"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> All plans
            </Link>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex min-w-0 items-start gap-2.5">
                <Skeleton className="mr-1 hidden size-10 shrink-0 rounded-xl sm:block" />
                {/* The h1's 28px line box, with the same 6px drop from sm up. */}
                <Skeleton
                  data-skeleton-part="title"
                  className="h-7 w-56 max-w-full min-w-0 rounded-xl sm:mt-1.5"
                />
              </div>
              {/* The event date: one text-sm line. */}
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-36 rounded-full" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {/* Covers */}
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className="h-3.5 w-20 rounded-full" />
              </div>
              {/* Status */}
              <Skeleton className="h-8 w-36 rounded-lg" />
            </div>
          </CardContent>
        </Card>
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

      {/* The ingredient indent; the cost summary and post-event actuals in the
          side column. */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <Skeleton className="h-3.5 w-44 rounded-full" />
                <Skeleton className="h-3 w-12 rounded-full" />
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
                  <Skeleton className="h-3.5 w-40 max-w-full rounded-full" />
                  <Skeleton className="ml-auto h-3.5 w-16 rounded-full" />
                  <Skeleton className="h-3.5 w-16 rounded-full max-sm:hidden" />
                  <Skeleton className="h-3.5 w-20 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <Skeleton className="h-3.5 w-28 rounded-full" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="space-y-3 surface-glass rounded-[22px] border border-border p-4"
                  >
                    <div className="flex h-9 items-center justify-between gap-2">
                      <Skeleton className="h-2.5 w-16 rounded-full" />
                      <Skeleton className="size-9 rounded-xl" />
                    </div>
                    <Skeleton className="h-7 w-20 max-w-full rounded-lg" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-12 w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-3.5 w-32 rounded-full" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-28 rounded-full" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-16 rounded-full" />
                <Skeleton className="h-20 w-full rounded-md" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
