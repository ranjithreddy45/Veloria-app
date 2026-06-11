"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, SparklesIcon } from "lucide-react";

import { aiScoreAllDeals } from "@/actions/ai.actions";
import { Button } from "@/components/ui/button";

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
    <Button
      variant="outline"
      size="sm"
      onClick={handleScoreAll}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <SparklesIcon className="size-3.5" />
      )}
      {loading ? "Scoring…" : "Score all"}
    </Button>
  );
}
