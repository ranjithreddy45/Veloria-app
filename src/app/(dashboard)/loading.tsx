import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-6 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="grid gap-6 lg:grid-cols-7">
        <div className="rounded-lg border p-6 lg:col-span-4 space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-[250px] w-full" />
        </div>
        <div className="rounded-lg border p-6 lg:col-span-3 space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-[250px] w-full" />
        </div>
      </div>
    </div>
  );
}
