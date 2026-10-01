"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, GitMerge } from "lucide-react";

import { backfillLeadPipeline } from "@/actions/lead.actions";
import { QuickActionButton } from "@/components/ui/quick-actions";

// One-click backfill: pulls any open/won leads that don't yet have a pipeline
// deal onto the board (audit S-9). Idempotent — safe to run repeatedly.
//
// Rendered as a secondary pill in the /pipeline header's action cluster. While
// it runs, the pill is disabled and busy and its chip turns into a spinner;
// the label stays "Sync leads" so its accessible name does not change
// mid-action, and the toast reports the result.
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
    <QuickActionButton
      label="Sync leads"
      module="pipeline"
      icon={loading ? <Loader2 className="animate-spin" strokeWidth={2} aria-hidden /> : GitMerge}
      onClick={handleSync}
      disabled={loading}
      aria-busy={loading || undefined}
    />
  );
}
