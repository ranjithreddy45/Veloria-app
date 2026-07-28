import { Skeleton } from "@/components/ui/skeleton";

export default function PortalLoading() {
  return (
    <div className="space-y-10">
      {/* Page header skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="h-8 w-56 rounded-xl" />
        <Skeleton className="h-4 w-80 rounded-full" />
      </div>

      {/* Cards skeleton */}
      <div className="grid gap-5 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-card shadow-card space-y-3 rounded-2xl border p-6"
          >
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="bg-card shadow-card space-y-4 rounded-2xl border p-6">
        <Skeleton className="h-3 w-36 rounded-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
