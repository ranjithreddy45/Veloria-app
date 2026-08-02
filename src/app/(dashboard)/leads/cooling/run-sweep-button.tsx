"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PlayIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runCoolingLeadCatchNow } from "@/actions/cooling-lead.actions";

// ============================================================
// On-demand cooling sweep trigger. settings:read gated server-side; this
// button only renders when the page decides the user may trigger it.
// ============================================================

export function RunSweepButton() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);

  function onClick() {
    setMsg(null);
    startTransition(async () => {
      const res = await runCoolingLeadCatchNow();
      if (!res.success) {
        setMsg(res.error);
        return;
      }
      if (res.data.noCadence) {
        setMsg("No active 'Cooling Lead Re-warm' cadence configured — nothing enrolled.");
      } else {
        setMsg(
          `Swept ${res.data.scanned} · enrolled ${res.data.enrolled} · skipped ${res.data.skipped}.`
        );
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={onClick} disabled={pending} variant="outline">
        {pending ? (
          <Loader2Icon className="mr-2 size-4 animate-spin" />
        ) : (
          <PlayIcon className="mr-2 size-4" />
        )}
        Run sweep now
      </Button>
      {msg && <p className="text-meta text-muted-foreground">{msg}</p>}
    </div>
  );
}
