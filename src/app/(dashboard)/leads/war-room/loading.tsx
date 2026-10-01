import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/layout/page-header-skeleton";

export default function WarRoomLoading() {
  return (
    <div className="space-y-5">
      {/* Header: PageHeader's own shape (chip placeholder included), so the
          title does not jump when the page replaces this. No action cluster. */}
      <PageHeaderSkeleton />

      {/* Summary tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Live board */}
      <div className="rounded-2xl border p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
