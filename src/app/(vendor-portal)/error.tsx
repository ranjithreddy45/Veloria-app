"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// ============================================================
// Vendor Portal — Error Boundary
// ============================================================

export default function VendorPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[VENDOR_PORTAL_ERROR]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        {/* Icon */}
        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-950/50 dark:to-orange-950/50">
          <AlertTriangle className="size-8 text-red-600 dark:text-red-400" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Something went wrong
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We encountered an error loading this page. Please try again or
            contact support if the problem persists.
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-muted-foreground/60">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 rounded-xl" onClick={reset}>
            <RotateCcw className="size-4" />
            Try Again
          </Button>
          <Button
            className="gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
            asChild
          >
            <Link href="/vendor-portal">
              <ArrowLeft className="size-4" />
              Back to Portal
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
