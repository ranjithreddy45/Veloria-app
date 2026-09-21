import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the home layout (header, four tiles, 8/4 band) so nothing jumps when
// the real page streams in.
export default function DashboardLoading() {
  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-[18px]" aria-busy="true" aria-label="Loading your home">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-9 w-full max-w-[520px]" />
        <Skeleton className="h-4 w-full max-w-[420px]" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="gap-2 p-[18px]">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-3 w-36" />
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="gap-3 p-[18px] lg:col-span-8">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-full rounded-[15px]" />
          ))}
        </Card>
        <Card className="gap-3 p-[18px] lg:col-span-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-32 w-full rounded-[13px]" />
        </Card>
      </div>
    </div>
  );
}
