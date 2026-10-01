"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, SparklesIcon } from "lucide-react";

import { aiScoreAllDeals } from "@/actions/ai.actions";
import { QuickActionButton } from "@/components/ui/quick-actions";

// Runs AI scoring over every open deal. Rendered as a secondary pill in the
// /pipeline header's action cluster. While it runs, the pill is disabled and
// busy and its chip turns into a spinner; the label stays "Score deals" so its
// accessible name does not change mid-action, and the toast reports the result.
export function ScoreAllDealsButton() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function handleScoreAll() {
    setLoading(true);
    try {
      const result = await aiScoreAllDeals();
      if (result.success) {
        toast.success(`AI scored ${result.data.updatedCount} deals`);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to score deals");
      }
    } catch {
      toast.error("Failed to run AI scoring");
    } finally {
      setLoading(false);
    }
  }

  return (
    <QuickActionButton
      label="Score deals"
      module="pipeline"
      icon={loading ? <Loader2 className="animate-spin" strokeWidth={2} aria-hidden /> : SparklesIcon}
      onClick={handleScoreAll}
      disabled={loading}
      aria-busy={loading || undefined}
    />
  );
}
