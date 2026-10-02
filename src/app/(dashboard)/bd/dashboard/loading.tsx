import { Skeleton } from "@/components/ui/skeleton";

// ============================================================
// The BD dashboard while it loads.
// ------------------------------------------------------------
// Without this file it fell back to (dashboard)/loading.tsx, whose title box
// sits under a 16px eyebrow placeholder at 24px from the content edge. This
// header is bespoke (bd/dashboard/page.tsx): it sits in its own band
// (px-5 pt-5 pb-4, border-b), its eyebrow takes 18px (a text-meta line plus
// mb-0.5; on a phone it wraps beside the button, to two lines), and its
// text-h2 h1 is dropped 4px from sm up to centre on the chip, so the settled
// title landed 20px right of the placeholder and 14px or more below it. This
// repeats the header's wrappers and boxes (measured in Chromium with Geist:
// the title box lands within 0.1px of the h1 at 1440, 700 and 390); keep the
// two in step.
//
// "Full reports" renders for every viewer, so it gets a placeholder. Below
// the header: the filter band, then the body's p-5 column with its KPI row.
//
// data-slot / data-skeleton-part match PageHeaderSkeleton's, so the e2e
// helper measureSkeletonTitle can measure this header too.
// ============================================================

export default function Loading() {
  return (
    <div className="flex flex-col min-h-full">
      <div
        aria-busy="true"
        data-slot="page-header-skeleton"
        className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-border"
      >
        <span className="sr-only">Loading…</span>
        {/* min-w-0 and max-w-full boxes: the placeholders must shrink beside
            the button on a phone, where fixed widths would overflow. */}
        <div className="min-w-0">
          {/* The eyebrow plus its mb-0.5: one 16px text-meta line from sm up.
              On a phone, beside the button, it wraps to two lines (32px). */}
          <div className="mb-0.5 flex h-8 flex-col justify-center gap-1.5 sm:h-4">
            <Skeleton className="h-2.5 w-48 max-w-full rounded-full" />
            <Skeleton className="h-2.5 w-24 max-w-full rounded-full sm:hidden" />
          </div>
          <div className="flex items-start gap-2.5">
            <Skeleton className="mr-1 hidden size-10 shrink-0 rounded-xl sm:block" />
            {/* The h1's 32.5px line box. */}
            <Skeleton data-skeleton-part="title" className="h-8 w-48 max-w-full rounded-xl sm:mt-1" />
          </div>
          {/* The description: one text-xs line plus mt-0.5. */}
          <div className="mt-0.5 flex h-4 items-center">
            <Skeleton className="h-3 w-72 max-w-full rounded-full" />
          </div>
        </div>
        {/* Full reports (34px tall, 122px wide). */}
        <Skeleton className="mt-1 h-8.5 w-30 shrink-0 rounded-xl" />
      </div>

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
