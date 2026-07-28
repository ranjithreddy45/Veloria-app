"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md rounded-2xl border bg-card shadow-card">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
            <AlertTriangle className="size-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-editorial text-[19px] font-semibold">
              Something went wrong
            </h2>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              We couldn&apos;t load the dashboard. This is usually temporary —
              try again in a moment.
            </p>
          </div>
          <Button onClick={reset} variant="outline" className="gap-2">
            <RefreshCcw className="size-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
