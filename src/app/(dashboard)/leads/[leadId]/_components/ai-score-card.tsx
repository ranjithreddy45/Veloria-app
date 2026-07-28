"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SparklesIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { aiScoreLead } from "@/actions/ai.actions";

// ============================================================
// AI Score Card Props
// ============================================================

interface AIScoreCardProps {
  leadId: string;
  aiScore: number | null;
  aiScoreReason: string | null;
  aiScoredAt: string | null;
}

// ============================================================
// AI Score Card Component
// ============================================================

export function AIScoreCard({
  leadId,
  aiScore,
  aiScoreReason,
  aiScoredAt,
}: AIScoreCardProps) {
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  async function handleRescore() {
    setLoading(true);
    try {
      const result = await aiScoreLead(leadId);
      if (result.success) {
        toast.success("AI score updated successfully");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to score lead with AI");
    } finally {
      setLoading(false);
    }
  }

  const scoreColor =
    aiScore !== null && aiScore >= 70
      ? "text-green-600"
      : aiScore !== null && aiScore >= 40
        ? "text-yellow-600"
        : "text-red-600";

  const badgeColor =
    aiScore !== null && aiScore >= 70
      ? "bg-green-100 text-green-800 border-green-200"
      : aiScore !== null && aiScore >= 40
        ? "bg-yellow-100 text-yellow-800 border-yellow-200"
        : "bg-red-100 text-red-800 border-red-200";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <SparklesIcon className="size-4" />
          AI Insight
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRescore}
          disabled={loading}
        >
          <RefreshCwIcon className={cn("mr-2 size-3.5", loading && "animate-spin")} />
          {loading ? "Scoring..." : aiScore !== null ? "Rescore" : "Score Now"}
        </Button>
      </CardHeader>
      <CardContent>
        {aiScore !== null ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className={cn("numeric text-4xl font-bold tracking-[-0.03em]", scoreColor)}>
                {aiScore}
              </span>
              <span className="numeric text-sm text-muted-foreground">/ 100</span>
              <Badge
                variant="outline"
                className={cn("ml-auto border font-medium", badgeColor)}
              >
                {aiScore >= 70
                  ? "High Priority"
                  : aiScore >= 40
                    ? "Medium Priority"
                    : "Low Priority"}
              </Badge>
            </div>

            <p className="mt-2 text-[13px] text-muted-foreground">
              Advisory assessment only — the rule-based{" "}
              <span className="font-medium">Lead Score</span> below is what drives
              prioritisation and sorting.
            </p>

            {aiScoredAt && (
              <p className="numeric mt-2 text-[11.5px] text-muted-foreground">
                Last scored {format(new Date(aiScoredAt), "dd MMM yyyy, hh:mm a")}
              </p>
            )}

            {aiScoreReason && (
              <>
                <Separator className="my-4" />
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    AI Analysis
                  </p>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                    {aiScoreReason}
                  </p>
                </div>
              </>
            )}
          </>
        ) : (
          <EmptyState
            className="py-8"
            icon={<SparklesIcon />}
            title="No AI score yet"
            description="Run Score Now to generate an AI-powered read on how likely this enquiry is to close."
          />
        )}
      </CardContent>
    </Card>
  );
}
