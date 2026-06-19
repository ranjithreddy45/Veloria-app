"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { setPackageStatus } from "@/actions/vendor-catalog.actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================
// PackageStatusControl
// ============================================================

interface PackageStatusControlProps {
  packageId: string;
  currentStatus: string;
}

export function PackageStatusControl({
  packageId,
  currentStatus,
}: PackageStatusControlProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [unmet, setUnmet] = React.useState<string[]>([]);

  const handleTransition = (targetStatus: string) => {
    setUnmet([]);
    startTransition(async () => {
      const res = await setPackageStatus(packageId, targetStatus);
      if (res.success) {
        toast.success(
          targetStatus === "ACTIVE"
            ? "Package activated"
            : targetStatus === "ARCHIVED"
            ? "Package archived"
            : "Package set to draft"
        );
        router.refresh();
      } else {
        if (res.error === "CANNOT_ACTIVATE" && res.unmet) {
          setUnmet(res.unmet);
          toast.error("Cannot activate — requirements not met");
        } else {
          toast.error(res.error ?? "Failed to update status");
        }
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-card space-y-3">
      <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
        Status control
      </p>

      <div className="flex flex-col gap-2">
        {currentStatus !== "ACTIVE" && currentStatus !== "ARCHIVED" && (
          <Button
            size="sm"
            className="h-8 w-full text-[12px] bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => handleTransition("ACTIVE")}
            disabled={isPending}
          >
            Activate
          </Button>
        )}

        {currentStatus === "ACTIVE" && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-full text-[12px]"
            onClick={() => handleTransition("DRAFT")}
            disabled={isPending}
          >
            Move to draft
          </Button>
        )}

        {currentStatus !== "ARCHIVED" && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-full text-[12px] text-muted-foreground hover:text-destructive"
            onClick={() => handleTransition("ARCHIVED")}
            disabled={isPending}
          >
            Archive
          </Button>
        )}

        {currentStatus === "ARCHIVED" && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-full text-[12px]"
            onClick={() => handleTransition("DRAFT")}
            disabled={isPending}
          >
            Restore to draft
          </Button>
        )}
      </div>

      {/* Unmet activation requirements */}
      {unmet.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive">
            <AlertCircleIcon className="size-3.5" />
            Not yet ready to activate:
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-destructive/80">
            {unmet.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
