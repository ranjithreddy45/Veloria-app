import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderSkeleton } from "@/components/layout/page-header-skeleton";

// The Catalog Funnel header has a one-line eyebrow and no action pills (its
// Resend prompt button sits in the children slot, beside the title column), so
// the title box lands where its h1 does. Without this file the route falls
// back to whatsapp/loading.tsx, whose inbox header has no eyebrow, and the
// title dropped 24px when the page arrived. The stat tiles and the sessions
// table follow.
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={0} />

      {/* Stage tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-32 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent sessions table */}
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-80 max-w-full rounded-full" />
        </CardHeader>
        <CardContent className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="ml-auto h-4 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
