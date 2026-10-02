import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================
// An employee profile (/people/<id>) while it loads.
// ------------------------------------------------------------
// Without this file the profile fell back to (dashboard)/loading.tsx, a plain
// PageHeader shape. The profile's header is bespoke (people/[id]/page.tsx):
// an "All people" back link, then the identity card, where the avatar comes
// first and the column beside it holds the employee code (the eyebrow), the
// title row (module chip, then a text-h2 / sm:text-h1 h1 and the status
// pill), the designation and the entity line. This repeats the back link and
// that card with their own wrappers and classes, and draws the back link
// itself (it is the same on every profile), so the title starts exactly where
// it will. Keep it in step with the page.
//
// The Edit / Request edit button depends on role and on whose profile it is,
// so it gets no placeholder; it sits right of the column and never moves the
// title.
//
// data-slot / data-skeleton-part match PageHeaderSkeleton's, so the e2e
// helper measureSkeletonTitle can measure this header too.
// ============================================================

export default function Loading() {
  return (
    <div className="space-y-6">
      <div aria-busy="true" data-slot="page-header-skeleton" className="space-y-6">
        <Link
          href="/people"
          className="inline-flex items-center gap-1.5 text-body text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> All people
        </Link>

        <div className="flex flex-wrap items-start gap-5 surface-glass rounded-[22px] p-5 sm:p-6">
          <span className="sr-only">Loading…</span>
          <Skeleton className="size-16 shrink-0 rounded-full sm:size-20" />
          <div className="min-w-0 flex-1">
            {/* The employee code: one text-meta line. */}
            <div className="flex h-4 items-center">
              <Skeleton className="h-2.5 w-16 rounded-full" />
            </div>
            <div className="mt-1 flex min-w-0 items-start gap-2.5">
              <Skeleton className="mr-1 hidden size-10 shrink-0 rounded-xl sm:block" />
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                {/* The h1's line box: 26px type below sm, 34px at sm and up. */}
                <Skeleton
                  data-skeleton-part="title"
                  className="h-8 w-48 max-w-full min-w-0 rounded-xl sm:h-10 sm:w-64"
                />
                <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
              </div>
            </div>
            {/* Designation · department: one text-copy line. */}
            <div className="mt-1.5 flex h-5.5 items-center">
              <Skeleton className="h-3.5 w-48 max-w-full rounded-full" />
            </div>
            {/* Legal entity, vertical and location. */}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
              <div className="flex h-5 items-center">
                <Skeleton className="h-3 w-32 rounded-full" />
              </div>
              <div className="flex h-5 items-center">
                <Skeleton className="h-3 w-24 rounded-full" />
              </div>
              <div className="flex h-5 items-center">
                <Skeleton className="h-3 w-20 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The tab strip, then the Overview tab: the login link and four
          definition cards. */}
      <div className="space-y-5">
        <Skeleton className="h-9 w-full max-w-lg rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-[22px]" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, c) => (
              <div key={c} className="surface-glass rounded-[22px] p-5">
                <Skeleton className="mb-4 h-2.5 w-24 rounded-full" />
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-2.5 w-20 rounded-full" />
                      <Skeleton className="h-3.5 w-32 max-w-full rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
