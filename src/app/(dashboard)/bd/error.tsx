"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BdError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[BD_ERROR]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/30">
        <AlertTriangle className="size-8 text-red-600 dark:text-red-400" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">Something went wrong loading this page.</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        We couldn&apos;t load this part of the workspace just now. This is
        usually temporary — please try again, or head back to the BD dashboard.
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-muted-foreground">
          Error ID: {error.digest}
        </p>
      )}
      <div className="mt-6 flex items-center gap-3">
        <Button variant="outline" onClick={reset}>
          <RotateCcw className="mr-2 size-4" />
          Try again
        </Button>
        <Button asChild>
          <Link href="/bd/dashboard">
            <Home className="mr-2 size-4" />
            BD Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
