"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderSkeleton } from "@/components/layout/page-header-skeleton";

// ============================================================
// A project's pages while they load: the venue record (/projects/<id>) and,
// below it, its procurement board (/projects/<id>/procurement), which has no
// loading.tsx of its own.
// ------------------------------------------------------------
// Without this file both fell back to (dashboard)/loading.tsx, a plain
// PageHeader shape. The record's header is bespoke (project-detail.tsx): a
// ghost "Projects" back button, then the module chip and the venue name (a
// 28px text-lg h1) over its locality, centred on each other, with the phase
// pill and the 48px readiness donut on the right. The donut is the row's
// tallest item and is always there, so the left block always centres on it.
// This repeats that row's wrappers and classes, and draws the back button
// itself (it is the same on every project), so the title starts exactly where
// it will. Keep it in step with project-detail.tsx.
//
// The procurement board is a "Back to venue" link over a plain PageHeader
// (its eyebrow is the module's name, as the page passes none) with no
// actions, so it gets that link and the plain PageHeaderSkeleton.
//
// A client component because only the URL tells the two apart: the router
// commits the destination URL together with the loading state.
//
// data-slot / data-skeleton-part match PageHeaderSkeleton's, so the e2e
// helper measureSkeletonTitle can measure the record's header too.
// ============================================================

export default function Loading() {
  const pathname = (usePathname() ?? "").replace(/\/+$/, "");
  // /projects/<id> is the record; anything deeper is the procurement board.
  const record = /^\/projects\/[^/]+$/.test(pathname);
  return record ? <ProjectRecordSkeleton /> : <ProcurementSkeleton venueHref={venueHref(pathname)} />;
}

/** /projects/<id>/procurement → /projects/<id>, for the board's back link. */
function venueHref(pathname: string): string {
  const match = /^\/projects\/[^/]+/.exec(pathname);
  return match ? match[0] : "/projects";
}

function ProjectRecordSkeleton() {
  return (
    <div className="space-y-5">
      <div
        aria-busy="true"
        data-slot="page-header-skeleton"
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2"
      >
        <span className="sr-only">Loading…</span>
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" /> Projects
            </Link>
          </Button>
          <div className="flex min-w-0 items-center gap-2.5">
            <Skeleton className="mr-1 hidden size-10 shrink-0 rounded-xl sm:block" />
            <div className="min-w-0">
              {/* The h1's 28px text-lg line box. */}
              <Skeleton data-skeleton-part="title" className="h-7 w-48 max-w-full min-w-0 rounded-xl" />
              {/* Locality, city: one text-xs line. */}
              <div className="flex h-4 items-center">
                <Skeleton className="h-2.5 w-32 max-w-full rounded-full" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* The phase pill (size sm) and the readiness donut. */}
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="size-12 rounded-full" />
        </div>
      </div>

      {/* Stage stepper */}
      <Skeleton className="h-14 w-full rounded-[22px] sm:h-24" />

      {/* Workflow / next action */}
      <Card className="border-0">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-48 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-3 w-80 max-w-full rounded-full" />
          <div className="flex justify-start sm:justify-end">
            <Skeleton className="h-9 w-48 rounded-xl" />
          </div>
        </CardContent>
      </Card>

      {/* Tabs and the Readiness tab's checklist */}
      <div className="space-y-4">
        <Skeleton className="h-9 w-full max-w-2xl rounded-xl" />
        <Card>
          <CardContent className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProcurementSkeleton({ venueHref }: { venueHref: string }) {
  return (
    <div className="space-y-5">
      <Link
        href={venueHref}
        className="inline-flex items-center gap-1.5 text-body text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to venue
      </Link>
      <PageHeaderSkeleton />

      {/* Budget figures, then the work packages and purchase orders. */}
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 surface-glass rounded-[22px] p-4">
              <Skeleton className="h-3 w-20 rounded-full" />
              <Skeleton className="h-7 w-24 max-w-full rounded-lg" />
            </div>
          ))}
        </div>
        {Array.from({ length: 2 }).map((_, t) => (
          <div key={t} className="surface-glass rounded-[22px]">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <Skeleton className="h-3.5 w-32 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
                <Skeleton className="h-3.5 w-44 max-w-full rounded-full" />
                <Skeleton className="ml-auto h-3.5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
