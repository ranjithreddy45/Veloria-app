import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PAGE_HEADER_CLASSES as C } from "@/components/layout/page-header";

// ============================================================
// PageHeaderSkeleton: PageHeader's shape while a route loads.
// ------------------------------------------------------------
// Built from PageHeader's own exported class strings (root, title column,
// title row, chip spacing, meta row, action slot), so the placeholder and the
// settled header cannot drift: the title box lands where the h1 will, at
// every width. Every (dashboard) page shows a module chip at sm and above, so
// one neutral chip placeholder fits every route; like the real chip it is
// hidden below sm.
//
// Only reserve action pills where the route's settled header really has them;
// a placeholder button that never arrives reads as jank.
// ============================================================

export interface PageHeaderSkeletonProps {
  /** Pill placeholders in the action slot. 0 (the default) for a header with no actions. */
  actions?: number;
  /** A meta-row placeholder under the description (pages that pass `children` with `actions`). */
  meta?: boolean;
  /** The eyebrow placeholder. Most headers have an eyebrow, so it is on by default. */
  eyebrow?: boolean;
  className?: string;
}

export function PageHeaderSkeleton({ actions = 0, meta = false, eyebrow = true, className }: PageHeaderSkeletonProps) {
  const pills = Math.max(0, Math.floor(actions));

  return (
    <div
      aria-busy="true"
      data-slot="page-header-skeleton"
      className={cn(pills > 0 ? C.rootWithActions : C.root, className)}
    >
      <span className="sr-only">Loading…</span>
      <div className={C.titleColumn}>
        {eyebrow && (
          // h-4 is the eyebrow's line box (11px text at line-height 1.45).
          <div className="flex h-4 items-center">
            <Skeleton className="h-2.5 w-40 rounded-full" />
          </div>
        )}
        <div className={C.titleRow}>
          <Skeleton className={cn("hidden shrink-0 sm:block", C.chipBox, C.chip)} />
          {/* The h1's line box: 26px type below sm, 34px at sm and above. */}
          <Skeleton className="h-8 w-56 max-w-full rounded-xl sm:h-10 sm:w-72" />
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
