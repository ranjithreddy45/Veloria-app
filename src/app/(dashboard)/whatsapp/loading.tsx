import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

// ============================================================
// WhatsApp Page Loading Skeleton
// ============================================================

export default function WhatsAppLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-3 p-4">
              <Skeleton className="size-10 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-10" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Inbox */}
      <Card className="overflow-hidden">
        <div className="grid h-[calc(100vh-320px)] min-h-[500px] md:grid-cols-[360px_1fr]">
          {/* Conversation list skeleton */}
          <div className="border-r p-3 space-y-3">
            <Skeleton className="h-9 w-full rounded-md" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                <Skeleton className="size-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              </div>
            ))}
          </div>

          {/* Chat skeleton */}
          <div className="flex flex-col">
            <div className="flex items-center gap-3 border-b p-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex-1" />
          </div>
        </div>
      </Card>
    </div>
  );
}
