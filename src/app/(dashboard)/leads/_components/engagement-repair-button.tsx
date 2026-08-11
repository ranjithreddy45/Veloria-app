"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runLeadEngagementRepair } from "@/actions/lead.actions";

/**
 * Recompute the Touches / Last contacted columns on demand.
 *
 * The roll-up is derived nightly, so a freshly-deployed or freshly-imported
 * board shows "Not logged" everywhere until the cron runs — which looks exactly
 * like a broken feature. This closes that gap without waiting.
 */
export function EngagementRepairButton() {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await runLeadEngagementRepair();
          if (!res.success) {
            toast.error(res.error ?? "Could not recompute engagement");
            return;
          }
          setDone(true);
          toast.success(
            res.updated === 0
              ? `Engagement already up to date (${res.scanned} leads checked).`
              : `Updated ${res.updated} of ${res.scanned} leads.`
          );
        })
      }
    >
      <RefreshCw className={`mr-2 size-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Recomputing…" : done ? "Recompute again" : "Recompute engagement"}
    </Button>
  );
}
