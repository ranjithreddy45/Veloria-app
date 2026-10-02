import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderSkeleton } from "@/components/layout/page-header-skeleton";

// A lead's header has a one-line eyebrow (CRM · Lead and the created date) and
// no action cluster: its controls render beside the title block and wrap
// below it, so they never move the title and get no placeholder here. The body
// is the lead's two-thirds / one-third card grid. The edit page under it has
// the same header.
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {Array.from({ length: 2 }).map((_, c) => (
            <Card key={c}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-2.5 w-20 rounded-full" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-2 w-full rounded-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
