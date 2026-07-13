"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BanIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  markWinbackRecovered,
  suppressWinbackTarget,
} from "@/actions/winback.actions";
import type { WinbackStatus } from "@prisma/client";

// ============================================================
// Win-back row controls (client). Two operator actions on a WinbackTarget:
//   • Suppress      → status = SUPPRESSED (permanent opt-out of future sends)
//   • Mark recovered → status = RECOVERED (won; drops off the active list)
// Both are gated server-side by marketing:manage; the buttons only render when
// canManage. Uses useTransition + sonner toast + router.refresh() so the server
// component re-reads the updated rows.
// ============================================================

// Terminal statuses can't be acted on further.
const TERMINAL: WinbackStatus[] = ["RECOVERED", "SUPPRESSED"];

interface WinbackRowActionsProps {
  targetId: string;
  status: WinbackStatus;
}

export function WinbackRowActions({ targetId, status }: WinbackRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  if (TERMINAL.includes(status)) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  function suppress() {
    startTransition(async () => {
      const res = await suppressWinbackTarget(targetId);
      if (res.success) {
        toast.success("Target suppressed — excluded from future win-back sends.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to suppress target");
      }
    });
  }

  function recover() {
    startTransition(async () => {
      const res = await markWinbackRecovered(targetId);
      if (res.success) {
        toast.success("Marked recovered.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to mark recovered");
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={recover}
        className="h-7 gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
      >
        {isPending ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : (
          <CheckCircle2Icon className="size-3.5" />
        )}
        Recovered
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={suppress}
        className="h-7 gap-1 text-muted-foreground hover:text-destructive"
      >
        <BanIcon className="size-3.5" />
        Suppress
      </Button>
    </div>
  );
}
