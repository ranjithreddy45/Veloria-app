"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PORTAL_ERROR]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-warning/10">
        <AlertTriangle className="size-8 text-warning" />
      </div>
      <h2 className="font-editorial text-foreground mt-5 text-title font-semibold">
        This page didn&apos;t load
      </h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
        Something went wrong on our side — not yours. Try once more, or head back
        to your portal and we&apos;ll pick up where you left off.
      </p>
      {error.digest && (
        <p className="numeric text-muted-foreground/60 mt-3 text-meta">
          Reference {error.digest}
        </p>
      )}
      <div className="mt-7 flex items-center gap-3">
        <Button variant="outline" onClick={reset}>
          <RotateCcw className="mr-2 size-4" />
          Try again
        </Button>
        <Button asChild>
          <Link href="/portal">
            <Home className="mr-2 size-4" />
            Back to my portal
          </Link>
        </Button>
      </div>
    </div>
  );
}
