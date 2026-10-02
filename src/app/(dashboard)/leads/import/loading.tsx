import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderSkeleton } from "@/components/layout/page-header-skeleton";

// The Import Leads header has a one-line eyebrow and no actions; the upload
// card (a title and the dashed drop zone) follows.
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full rounded-xl" />
        </CardContent>
      </Card>
    </div>
  );
}
