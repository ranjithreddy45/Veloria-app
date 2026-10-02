import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderSkeleton } from "@/components/layout/page-header-skeleton";

// ============================================================
// List, board and form skeletons, streamed by a route's `loading.tsx` so the
// shell paints instantly on navigation instead of blocking on the data query.
// ------------------------------------------------------------
// The header is PageHeaderSkeleton: the same boxes the real PageHeader draws
// (eyebrow, module-chip placeholder, title line box, description), so the
// title does not jump sideways when the page replaces the skeleton.
//
// Only the route knows what its settled header shows, so each route sets its
// action-slot placeholders with `headerActions` (none unless it passes a count),
// `headerMeta` when the header has a meta row under the description,
// `headerEyebrowLines={2}` when its eyebrow of counts wraps on a phone, and
// `headerEyebrow={false}` only for a bespoke header with no eyebrow at all (a
// PageHeader always has one: the page's own, or its module's name). A
// placeholder button that never arrives points the eye at the wrong place.
// The body stays generic: action pills live in the header, never in a row
// inside the body.
// ============================================================

interface HeaderSkeletonOptions {
  /**
   * Pill placeholders in the header's action slot: how many actions the
   * route's settled header shows. Defaults to 0, like PageHeaderSkeleton: a
   * route whose header has a button says so (contracts, bd/leads and bd/deals
   * pass 1), and one with none (payments, bd/properties) reserves nothing.
   */
  headerActions?: number;
  /**
   * A meta-row placeholder under the description, for a header that passes
   * `actions` and also renders `children` (they become a row of links and
   * notes there).
   */
  headerMeta?: boolean;
  /**
   * Lines the header's eyebrow takes below sm: 2 for an eyebrow of counts that
   * wraps on a phone, so the title box keeps the settled h1's top there.
   */
  headerEyebrowLines?: 1 | 2;
  /**
   * The eyebrow placeholder. On by default, as every PageHeader has an
   * eyebrow (the module's name when the page passes none); false only for a
   * bespoke header without one (its title row comes first, so its h1 sits
   * 24px higher).
   */
  headerEyebrow?: boolean;
}

export interface ListSkeletonProps extends HeaderSkeletonOptions {
  /** Table rows to draw. */
  rows?: number;
}

/** Generic list/table page skeleton. */
export function ListSkeleton({
  rows = 8,
  headerActions = 0,
  headerMeta = false,
  headerEyebrowLines = 1,
  headerEyebrow = true,
}: ListSkeletonProps) {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton
        actions={headerActions}
        meta={headerMeta}
        eyebrow={headerEyebrow}
        eyebrowLines={headerEyebrowLines}
      />

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-64 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="border-b py-3">
          <Skeleton className="h-4 w-full max-w-md" />
        </CardHeader>
        <CardContent className="divide-y p-0">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export interface BoardSkeletonProps extends HeaderSkeletonOptions {
  /** Board columns to draw. */
  columns?: number;
}

/** Kanban/board skeleton (pipeline + BD deal board). */
export function BoardSkeleton({
  columns = 5,
  headerActions = 0,
  headerMeta = false,
  headerEyebrowLines = 1,
  headerEyebrow = true,
}: BoardSkeletonProps) {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton
        actions={headerActions}
        meta={headerMeta}
        eyebrow={headerEyebrow}
        eyebrowLines={headerEyebrowLines}
      />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: columns }).map((_, c) => (
          <div key={c} className="w-72 shrink-0 space-y-3">
            <Skeleton className="h-6 w-40" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="space-y-2 p-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface FormSkeletonProps extends HeaderSkeletonOptions {
  /** Form sections (cards) to draw. */
  sections?: number;
}

/**
 * Create/edit form page skeleton (/leads/new, /bookings/new): the header,
 * then the form's section cards in the same centred max-w-3xl column the
 * form pages use.
 */
export function FormSkeleton({
  sections = 2,
  headerActions = 0,
  headerMeta = false,
  headerEyebrowLines = 1,
  headerEyebrow = true,
}: FormSkeletonProps) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton
        actions={headerActions}
        meta={headerMeta}
        eyebrow={headerEyebrow}
        eyebrowLines={headerEyebrowLines}
      />
      <div className="mx-auto max-w-3xl space-y-6">
        {Array.from({ length: sections }).map((_, s) => (
          <Card key={s}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3.5 w-24 rounded-full" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
