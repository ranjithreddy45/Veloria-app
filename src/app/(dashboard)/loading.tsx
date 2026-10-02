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
//   - Any PageHeader whose eyebrow fits on one line. Every PageHeader has an
//     eyebrow: the page's own, or, when it passes none, its module's name
//     (PageHeader falls back to ModuleEyebrow), so no header starts with its
//     title row.
// What it does NOT match, on the routes that fall back to it:
//   - An eyebrow of counts long enough to wrap on a phone: the h1 lands 20px
//     lower there. Bookings, leads, contacts and pipeline, whose eyebrows do
//     that, have their own loading.tsx.
//   - A bespoke record header (a back link or button above the title, an
//     avatar or a card around it). /bd/dashboard, /bd/contracts/[contractId],
//     /beo/[id], /kitchen/[id], /packages/[packageId], /people/[id] and
//     /projects/[id] fall back to this skeleton, so their title can shift
//     when the page lands. A BD lead does not: bd/leads/loading.tsx draws
//     LeadDetailSkeleton, built from the lead's header, on any path below
//     /bd/leads.
// Those records do not get a loading.tsx of their own: on Next 16.1.6, adding
// a route loading.tsx exposes a router race (vercel/next.js#98684) in which a
// link clicked while the route's prefetch is in flight commits the URL with
// an empty page that never fills. src/app/route-loading-boundaries.test.ts
// pins the set of loading.tsx files; read it before adding one.
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
