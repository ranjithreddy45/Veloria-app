import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ============================================================
// LeadDetailSkeleton: a BD lead's page while it loads.
// ------------------------------------------------------------
// The lead's header is bespoke, not PageHeader: a "Back to Leads" link, then
// the title row (module chip, a 27px text-title h1, the status pill) dropped
// 6px from sm up so the title's first line centres on the chip. The generic
// PageHeaderSkeleton puts its title box under a 16px eyebrow placeholder, at
// 24px, which is 8px or more above where this h1 lands. So this skeleton
// repeats the header's own wrappers and classes instead, and draws the back
// link itself: the link is static (the same text and href on every lead), and
// rendering the real one makes the title row start exactly where it will,
// whatever the font's line metrics, while the link already works.
//
// The manage buttons (Edit, Reassign, Delete) depend on the viewer's role,
// so they get no placeholder; Call and WhatsApp always render, so they do.
//
// data-slot / data-skeleton-part match PageHeaderSkeleton's, so the e2e
// helper measureSkeletonTitle can measure this header too.
// ============================================================

export function LeadDetailSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div aria-busy="true" data-slot="page-header-skeleton">
        <span className="sr-only">Loading…</span>
        <Link
          href="/bd/leads"
          className="mb-3 inline-flex items-center gap-1.5 text-body text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to Leads
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-start gap-2.5">
              <Skeleton className="mr-1 hidden size-10 shrink-0 rounded-xl sm:block" />
              <div className="flex flex-wrap items-center gap-2 sm:pt-1.5">
                {/* The h1's 27px line box. */}
                <Skeleton data-skeleton-part="title" className="h-7 w-56 max-w-full rounded-lg" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
            {/* Owner · type · city · locality, one text-body line. */}
            <div className="flex h-5 items-center">
              <Skeleton className="h-3 w-72 max-w-full rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Call and WhatsApp (size sm). */}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Lead details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-2.5 w-20 rounded-full" />
                <Skeleton className="h-3.5 w-28 max-w-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Status & actions, then the qualification checklist */}
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-11 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="size-4 rounded-full" />
                  <Skeleton className="h-3 w-44 max-w-full rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
