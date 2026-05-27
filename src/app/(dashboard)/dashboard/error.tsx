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
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30">
            <AlertTriangle className="size-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              Failed to load the dashboard. This could be a temporary issue.
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
