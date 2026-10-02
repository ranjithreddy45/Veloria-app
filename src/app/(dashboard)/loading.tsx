import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/layout/page-header-skeleton";

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
// The header is PageHeaderSkeleton, built from the real header's own class
// strings, including the module-chip placeholder (PageHeader takes its chip
// from the route, so every PageHeader under (dashboard) shows one at sm and
// above). Its title box sits 24px down, under a 16px eyebrow placeholder and
// the column's 8px gap, and 54px in from sm up (chip, mr-1, gap-2.5).
//
// What it matches, so the title does not move when the page arrives:
//   - A PageHeader with a one-line eyebrow.
// What it does NOT match, on the routes that still fall back to it:
//   - A PageHeader with no eyebrow: the h1 lands 24px higher.
//   - /beo/[id]: the page renders its Guest numbers panel (CoversPanel)
//     above the header whenever the booking resolves, and that panel's
//     height depends on the guest list, so no fixed placeholder can hold the
//     h1's top there. Its title is also dropped 4px from sm up to centre on
//     the chip.
//   - people/[id] and projects/[id]: the title follows an avatar or a back
//     button, and there is no module chip.
//   Each of those needs a loading.tsx of its own, drawn from its real header.
// The bespoke headers that have one: /bd/dashboard, /bd/leads/[leadId] (and
// bd/leads/loading.tsx draws the same LeadDetailSkeleton on any path below
// /bd/leads, for a lead opened from another module),
// /bd/contracts/[contractId] and /packages/[packageId] (which also covers its
// /edit form).
//
// It reserves no action pills: this fallback cannot know which header has
// them, and a placeholder button that never arrives is worse than none.
//
// It also guessed at two side-by-side chart panels. Most routes here are a
// header + stat tiles + a table, so that's the shape it holds now.
// ============================================================

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      {/* Stat tiles — same 3-up grid and card treatment as the real pages:
          StatTile's bordered glass surface and padding, its label top-left
          and its chip top-right in a 36px band. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 surface-glass rounded-[22px] border border-border p-4 sm:p-5"
          >
            <div className="flex h-9 items-center justify-between gap-2">
              <Skeleton className="h-2.5 w-24 rounded-full" />
              <Skeleton className="size-9 rounded-xl" />
            </div>
            <Skeleton className="h-7 w-20 rounded-lg" />
            <Skeleton className="h-2.5 w-28 rounded-full" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden surface-glass rounded-[22px]">
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
