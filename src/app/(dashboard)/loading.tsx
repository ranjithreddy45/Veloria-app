import { Skeleton } from "@/components/ui/skeleton";

// ============================================================
// The fallback skeleton for every dashboard route that doesn't ship its own.
//
// A skeleton's ONLY job is to hold the shape the real page is about to take.
// This one used `rounded-lg border p-6` while every real page uses
// `rounded-2xl shadow-card` — so the placeholder appeared, then the content
// landed in visibly different boxes and everything jumped. A skeleton that
// doesn't match is worse than no skeleton: it promises a layout and then
// breaks the promise, which reads as jank rather than speed.
//
// It also guessed at two side-by-side chart panels. Most routes here are a
// header + stat tiles + a table, so that's the shape it holds now.
// ============================================================

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Page header: eyebrow, title, description */}
      <div className="space-y-2.5">
        <Skeleton className="h-2.5 w-40 rounded-full" />
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="h-3.5 w-96 max-w-full rounded-full" />
      </div>

      {/* Stat tiles — same 3-up grid and card treatment as the real pages */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="shadow-card space-y-3 rounded-2xl border bg-card p-5"
          >
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-9 rounded-xl" />
              <Skeleton className="h-3 w-24 rounded-full" />
            </div>
            <Skeleton className="h-7 w-20 rounded-lg" />
            <Skeleton className="h-2.5 w-28 rounded-full" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="shadow-card overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center gap-3 border-b p-4">
          <Skeleton className="h-9 w-64 rounded-lg" />
          <Skeleton className="ml-auto h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-0">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-3.5 w-48 rounded-full" />
            <Skeleton className="h-3.5 w-32 rounded-full max-lg:hidden" />
            <Skeleton className="ml-auto h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
