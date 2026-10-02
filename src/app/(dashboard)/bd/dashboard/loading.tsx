import { Skeleton } from "@/components/ui/skeleton";
import { BdDashboardHeader } from "./_components/bd-dashboard-header";

// ============================================================
// The BD dashboard while it loads.
// ------------------------------------------------------------
// Without this file it fell back to (dashboard)/loading.tsx, whose title box
// sits under a 16px eyebrow placeholder at 24px from the content edge. This
// header is bespoke: it sits in its own band (px-5 pt-5 pb-4, border-b), its
// eyebrow wraps beside the Full reports button on a narrow screen, and its h1
// is dropped 4px from sm up to centre on the chip.
//
// Nothing in that header depends on the analytics, so this draws the real one
// (BdDashboardHeader, shared with page.tsx) in its loading mode: the title is
// exactly where it will be at every width, the eyebrow wraps exactly when the
// settled one does, and the two cannot drift. A copy built from fixed-width
// boxes had to guess the wrap and was 16px off between about 455px and 640px.
// Below the header: the filter band, then the body's p-5 column with its KPI
// row.
//
// The header's loading mode carries PageHeaderSkeleton's data-slot and
// data-skeleton-part, so the e2e helper measureSkeletonTitle measures it too.
// ============================================================

export default function Loading() {
  return (
    <div className="flex flex-col min-h-full">
      <BdDashboardHeader loading />

      {/* Filter band: the range and employee pills, and the range label. */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 border-b border-border">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-3 w-28 rounded-full" />
      </div>

      {/* Body: the KPI row, then the panels. */}
      <div className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-2.5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-7 w-16 rounded-lg" />
              <Skeleton className="h-2.5 w-24 rounded-full" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
