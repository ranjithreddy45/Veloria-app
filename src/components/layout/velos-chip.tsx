"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Trophy } from "lucide-react";
import { getVelosHeaderSummary } from "@/actions/velos.actions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { CountUp } from "@/components/ui/count-up";
import { celebrate } from "@/lib/celebrate";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================
// VelosChip — always-visible engagement hook in the top bar. Shows this
// period's points + leaderboard rank, links to the Velos hub, and celebrates
// (confetti + toast) the moment a user earns points — driving them back in.
// Read-only; polls the existing summary action. Never affects app logic.
// ============================================================

export function VelosChip() {
  const { user } = useCurrentUser();
  const prevPoints = React.useRef<number | null>(null);

  const { data } = useQuery({
    queryKey: ["velos", "header", user?.id],
    queryFn: () => getVelosHeaderSummary(),
    enabled: !!user?.id,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  // Celebrate when points increase between polls (i.e. the user just earned).
  React.useEffect(() => {
    if (!data) return;
    const pts = data.points;
    if (prevPoints.current !== null && pts > prevPoints.current) {
      const gained = pts - prevPoints.current;
      celebrate({ y: 0.2 });
      const chase =
        data.ptsToNextRank != null && data.rank != null
          ? `Only ${data.ptsToNextRank} pts to overtake #${data.rank - 1}!`
          : data.leadOverNext != null
          ? `You're #1 — leading by ${data.leadOverNext} pts`
          : data.rank
          ? `You're #${data.rank} this month`
          : "Keep it going";
      toast.success(`+${gained} Velos!`, {
        description: chase,
        icon: "🎉",
      });
    }
    prevPoints.current = pts;
  }, [data]);

  if (!data) return null;

  const rankLabel = data.rank ? `#${data.rank}` : "—";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/performance/velos"
          aria-label={`Velos: ${data.points} points this month, rank ${rankLabel}`}
          className={cn(
            "group/velos hidden items-center gap-2 rounded-full border border-border/70 bg-card/70 px-2.5 py-1 text-[12.5px] font-semibold shadow-card backdrop-blur transition-all duration-200 hover:-translate-y-px hover:border-primary/40 hover:shadow-[0_4px_14px_oklch(0.55_0.25_293/0.18)] hover:ring-1 hover:ring-primary/20 active:scale-[0.97] sm:inline-flex"
          )}
        >
          <Sparkles className="size-3.5 text-primary transition-transform duration-200 group-hover/velos:scale-110" />
          <span className="tabular-nums text-brand-gradient">
            <CountUp value={data.points} />
          </span>
          <span className="hidden text-muted-foreground md:inline">pts</span>
          {data.rank && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
              <Trophy className="size-3" />
              {rankLabel}
            </span>
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{data.identity}</p>
        <p className="text-muted-foreground">
          {data.points} pts this month
          {data.rank ? ` · #${data.rank} of ${data.players}` : ""}
        </p>
        {/* Goal-gradient: always show the small gap to chase (or the lead to defend). */}
        {data.ptsToNextRank != null && data.rank != null && (
          <p className="font-medium text-warning">
            🔥 Only {data.ptsToNextRank} pts to overtake #{data.rank - 1}
          </p>
        )}
        {data.leadOverNext != null && (
          <p className="font-medium text-success">
            👑 You lead #2 by {data.leadOverNext} pts — defend it
          </p>
        )}
        <p className="text-muted-foreground">Tap to open your Velos hub</p>
      </TooltipContent>
    </Tooltip>
  );
}
