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
        <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="size-8 text-destructive" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="font-editorial text-title tracking-[-0.01em] text-foreground">
            That didn&apos;t load the way it should
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Something went wrong on our side, not yours. Try again — and if it
            keeps happening, tell your Veloria contact.
          </p>
          {error.digest && (
            <p className="numeric text-xs text-muted-foreground/60">
              Reference: {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 rounded-xl" onClick={reset}>
            <RotateCcw className="size-4" />
            Try again
          </Button>
          <Button className="gap-2 rounded-xl" asChild>
            <Link href="/vendor-portal">
              <ArrowLeft className="size-4" />
              Back to portal
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
