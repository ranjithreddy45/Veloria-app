"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, GitMerge } from "lucide-react";

import { backfillLeadPipeline } from "@/actions/lead.actions";
import { Button } from "@/components/ui/button";

// One-click backfill: pulls any open/won leads that don't yet have a pipeline
// deal onto the board (audit S-9). Idempotent — safe to run repeatedly.
export function SyncLeadsButton() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function handleSync() {
    setLoading(true);
    try {
      const result = await backfillLeadPipeline();
      if (result.success) {
        toast.success(
          result.data.created > 0
            ? `Added ${result.data.created} lead${result.data.created === 1 ? "" : "s"} to the pipeline`
            : "Pipeline already in sync with leads",
        );
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to sync leads");
      }
    } catch {
      toast.error("Failed to sync leads to pipeline");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={loading}>
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <GitMerge className="size-3.5" />}
      {loading ? "Syncing…" : "Sync leads"}
    </Button>
  );
}
