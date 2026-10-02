"use client";

import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderSkeleton } from "@/components/layout/page-header-skeleton";

// ============================================================
// A package's pages while they load: the record (/packages/<id>) and, below
// it, the edit form (/packages/<id>/edit), which has no loading.tsx of its own.
// ------------------------------------------------------------
// Without this file both fell back to (dashboard)/loading.tsx, whose title box
// sits under a 16px eyebrow placeholder at 24px. Neither page has an eyebrow,
// so each title landed 24px higher than the placeholder promised.
//
// The record's header is bespoke (package-detail.tsx): the title row comes
// first, module chip then a 32px text-2xl h1 and the tier and status badges,
// dropped 4px from sm up so the title's first line centres on the chip; the
// Edit, Duplicate and Delete buttons render for every viewer, so they get
// placeholders. This repeats that header's wrappers and classes; keep the two
// in step. The edit page is a plain PageHeader with no eyebrow and no actions
// over the form's cards, so it gets PageHeaderSkeleton without the eyebrow.
//
// A client component because only the URL tells the two apart: the router
// commits the destination URL together with the loading state.
// ============================================================

export default function Loading() {
  const pathname = (usePathname() ?? "").replace(/\/+$/, "");
  // /packages/<id> is the record; anything deeper is the edit form.
  const isRecord = /^\/packages\/[^/]+$/.test(pathname);
  return isRecord ? <PackageRecordSkeleton /> : <PackageEditSkeleton />;
}

function PackageRecordSkeleton() {
  return (
    <div className="space-y-6">
      <div
        aria-busy="true"
        data-slot="page-header-skeleton"
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <span className="sr-only">Loading…</span>
        <div>
          <div className="flex items-start gap-2.5">
            <Skeleton className="mr-1 hidden size-10 shrink-0 rounded-xl sm:block" />
            <div className="flex items-center gap-3 sm:pt-1">
              {/* The h1's 32px line box. Narrower on a phone: this row has no
                  wrap, and fixed-width boxes (unlike the h1's text) cannot
                  shrink below their width, so 224px plus the badges would
                  run past a 375px screen. */}
              <Skeleton data-skeleton-part="title" className="h-8 w-44 rounded-xl sm:w-56" />
              <Skeleton className="h-5.5 w-16 rounded-full" />
              <Skeleton className="h-5.5 w-14 rounded-full" />
            </div>
          </div>
        </div>
        {/* Edit, Duplicate, Delete (default size). */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>

      {/* Package information and pricing summary */}
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, c) => (
          <Card key={c}>
            <CardHeader>
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-4 shrink-0 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-2.5 w-20 rounded-full" />
                    <Skeleton className="h-3.5 w-32" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Included items */}
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border p-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40 max-w-full" />
                <Skeleton className="h-2.5 w-56 max-w-full rounded-full" />
              </div>
              <div className="ml-4 shrink-0 space-y-1.5">
                <Skeleton className="ml-auto h-3.5 w-16" />
                <Skeleton className="h-2.5 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function PackageEditSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton eyebrow={false} />
      {/* The form's Package details and Package items cards, in the same
          centred max-w-3xl column. */}
      <div className="mx-auto max-w-3xl space-y-6">
        {Array.from({ length: 2 }).map((_, s) => (
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
