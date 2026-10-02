import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PAGE_HEADER_CLASSES as C } from "@/components/layout/page-header";

// ============================================================
// PageHeaderSkeleton: PageHeader's shape while a route loads.
// ------------------------------------------------------------
// Built from PageHeader's own exported class strings (root, title column,
// title row, chip spacing, meta row, action slot), so the placeholder and the
// settled header cannot drift: the title box lands where the h1 will, at
// every width. Every PageHeader under (dashboard) shows a module chip at sm
// and above (the bespoke record headers render ModuleChip in their title
// row too), so one neutral chip placeholder
// fits every such route; like the real chip it is hidden below sm.
//
// Only reserve action pills where the route's settled header really has them;
// a placeholder button that never arrives reads as jank.
//
// The title box's top is the eyebrow's height plus the column's 8px gap, so
// the eyebrow placeholder must be as tall as the real eyebrow. A landing whose
// eyebrow carries counts (bookings, leads, contacts, pipeline) wraps it to two
// lines on a phone; those routes pass `eyebrowLines={2}`.
// ============================================================

export interface PageHeaderSkeletonProps {
  /** Pill placeholders in the action slot. 0 (the default) for a header with no actions. */
  actions?: number;
  /** A meta-row placeholder under the description (pages that pass `children` with `actions`). */
  meta?: boolean;
  /**
   * The eyebrow placeholder. On by default: every PageHeader has an eyebrow
   * (the module's name when the page passes none). False only for a bespoke
   * header without one.
   */
  eyebrow?: boolean;
  /**
   * How many lines the eyebrow takes below sm. 2 for an eyebrow of counts that
   * wraps on a phone (a `flex-wrap gap-y-1` row: two 16px lines and a 4px
   * gap). From sm up the eyebrow is one line either way.
   */
  eyebrowLines?: 1 | 2;
  className?: string;
}

export function PageHeaderSkeleton({
  actions = 0,
  meta = false,
  eyebrow = true,
  eyebrowLines = 1,
  className,
}: PageHeaderSkeletonProps) {
  const pills = Math.max(0, Math.floor(actions));

  return (
    <div
      aria-busy="true"
      data-slot="page-header-skeleton"
      className={cn(pills > 0 ? C.rootWithActions : C.root, className)}
    >
      <span className="sr-only">Loading…</span>
      <div className={C.titleColumn}>
        {eyebrow &&
          (eyebrowLines === 2 ? (
            // Below sm: two 11px lines at line-height 1.45 (16px each) and the
            // eyebrow row's 4px gap, 36px in all. From sm up: one line.
            <div className="flex h-9 flex-col justify-center gap-1 sm:h-4">
              <Skeleton className="h-2.5 w-40 rounded-full" />
              <Skeleton className="h-2.5 w-24 rounded-full sm:hidden" />
            </div>
          ) : (
            // h-4 is the eyebrow's line box (11px text at line-height 1.45).
            <div className="flex h-4 items-center">
              <Skeleton className="h-2.5 w-40 rounded-full" />
            </div>
          ))}
        <div className={C.titleRow}>
          <Skeleton className={cn("hidden shrink-0 sm:block", C.chipBox, C.chip)} />
          {/* The h1's line box: 26px type below sm, 34px at sm and above.
              data-skeleton-part marks it for header-geometry.spec.ts, which
              checks that it sits where the settled h1 lands. */}
          <Skeleton data-skeleton-part="title" className="h-8 w-56 max-w-full rounded-xl sm:h-10 sm:w-72" />
        </div>
        {/* One description line (13px/14px type at leading-relaxed). */}
        <div className="flex h-5 items-center sm:h-6">
          <Skeleton className="h-3.5 w-96 max-w-full rounded-full" />
        </div>
        {meta && (
          <div className={C.meta}>
            <Skeleton className="h-8 w-40 rounded-lg" />
          </div>
        )}
      </div>
      {pills > 0 && (
        // flex-wrap here because the placeholders sit directly in the slot;
        // in the real header the pill list inside the slot does the wrapping.
        <div className={cn(C.actions, "flex-wrap")}>
          {Array.from({ length: pills }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-36 rounded-xl pointer-coarse:h-11" />
          ))}
        </div>
      )}
    </div>
  );
}
