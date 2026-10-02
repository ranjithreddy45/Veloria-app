import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ============================================================
// A BD contract's page while it loads.
// ------------------------------------------------------------
// Neither /bd nor /bd/contracts has a loading.tsx, so without this file the
// contract fell back to (dashboard)/loading.tsx, whose title box sits under a
// 16px eyebrow placeholder at 24px, at least 8px above where this h1 lands.
// The contract's header is bespoke: a "Back to Contracts" link, then the title
// row (module chip, a 27px text-title h1, the status and phase pills), dropped
// 6px from sm up so the title's first line centres on the chip. This repeats
// the header's own wrappers and classes, and draws the back link itself (it is
// the same on every contract), so the title row starts exactly where it will,
// whatever the font's line metrics. Keep it in step with contract-detail.tsx.
//
// "Preview / Download PDF" renders for every viewer, so it gets a placeholder;
// the lifecycle actions depend on role and status and live in the body.
//
// data-slot / data-skeleton-part match PageHeaderSkeleton's, so the e2e
// helper measureSkeletonTitle can measure this header too.
// ============================================================

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <div aria-busy="true" data-slot="page-header-skeleton">
        <span className="sr-only">Loading…</span>
        <Link
          href="/bd/contracts"
          className="mb-3 inline-flex items-center gap-1.5 text-body text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to Contracts
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-start gap-2.5">
              <Skeleton className="mr-1 hidden size-10 shrink-0 rounded-xl sm:block" />
              <div className="flex flex-wrap items-center gap-2 sm:pt-1.5">
                {/* The h1's 27px line box. */}
                <Skeleton data-skeleton-part="title" className="h-7 w-64 max-w-full rounded-lg" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5.5 w-20 rounded-full" />
              </div>
            </div>
            {/* Property · owner, one text-body line. */}
            <div className="flex h-5 items-center">
              <Skeleton className="h-3 w-56 max-w-full rounded-full" />
            </div>
          </div>
          <Skeleton className="h-8 w-48 rounded-lg" />
        </div>
      </div>

      {/* Authoring: the title and two buttons, then the 14-row draft. */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-44 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-72 w-full rounded-md" />
          <Skeleton className="h-2.5 w-80 max-w-full rounded-full" />
        </CardContent>
      </Card>

      {/* Lifecycle stepper */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 w-20 rounded-full" />
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-4 w-16" />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-2.5 w-20 rounded-full" />
                <Skeleton className="h-3.5 w-28 max-w-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-16" />
          </CardHeader>
          <CardContent className="grid gap-2">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
