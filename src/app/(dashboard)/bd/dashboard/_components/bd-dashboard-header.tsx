import Link from "next/link";
import { BarChart3 as BarChart3Icon } from "lucide-react";
import { ModuleChip } from "@/components/layout/module-chip";

// ============================================================
// The BD dashboard's header band (page.tsx).
// ------------------------------------------------------------
// /bd/dashboard has no loading.tsx of its own (a new route loading boundary
// trips a Next.js router race; see src/app/route-loading-boundaries.test.ts),
// so while the analytics load it shows the generic (dashboard)/loading.tsx
// skeleton, which is not drawn from this header.
//
// Nothing in the header depends on data, so a loading state can draw the
// real header rather than a copy made of fixed-width boxes. A copy could not
// wrap the way the text does: the eyebrow wraps beside the Full reports
// button only below a viewport of about 450px, and a placeholder that
// reserved two lines for it on every phone-width screen left the title 16px
// off between about 455px and 640px.
//
// `loading` is that mode: the same header, marked the way PageHeaderSkeleton
// marks its own root and title box (data-slot / data-skeleton-part). It was
// written for the route's own loading.tsx, since removed, and nothing passes
// it now.
// ============================================================

export function BdDashboardHeader({ loading = false }: { loading?: boolean }) {
  return (
    <div
      aria-busy={loading || undefined}
      data-slot={loading ? "page-header-skeleton" : undefined}
      className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-border"
    >
      {loading && <span className="sr-only">Loading…</span>}
      <div>
        <p className="text-meta font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-0.5">
          Business Development · Acquisition
        </p>
        {/* The module chip leads the title row, as in PageHeader (top-aligned,
            14px to the title, hidden below sm). The h1 is text-h2 at
            leading-tight, a 32.5px line, so from sm up it is dropped 4px to
            centre that line on the 40px chip. */}
        <div className="flex items-start gap-2.5">
          <ModuleChip className="mr-1" />
          <h1
            data-skeleton-part={loading ? "title" : undefined}
            className="text-h2 font-black text-foreground tracking-tight leading-tight sm:mt-1"
          >
            BD Dashboard
          </h1>
        </div>
        <p className="text-detail text-muted-foreground mt-0.5">
          Employee-wise acquisition funnel, activity and leaderboard.
        </p>
      </div>
      <Link
        href="/bd/reports"
        className="flex items-center gap-2 shrink-0 mt-1 rounded-xl border border-border bg-muted px-4 py-2 text-detail font-semibold text-foreground hover:bg-border hover:border-white/20 transition-all"
      >
        <BarChart3Icon className="size-4" />
        Full reports
      </Link>
    </div>
  );
}
