"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckSquare } from "lucide-react";
import { getMyPendingApprovalsCount } from "@/actions/pending-approvals.actions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================
// PendingApprovalsChip — a small header chip showing the count of items
// awaiting THIS user's action (leave approvals, regularizations, flagged
// punches). The count action is fully self-scoped and permission-aware, so a
// user with no HR permissions and no reports sees nothing at all (total = 0 →
// no chip). Polls at most once a minute; read-only, never affects app logic.
// ============================================================

/** Pick the single most relevant queue to deep-link into, by count priority. */
function primaryHref(b: { leave: number; regularizations: number; flagged: number }): string {
  if (b.leave > 0) return "/people/leave/approvals";
  if (b.regularizations > 0) return "/people/attendance/regularizations";
  if (b.flagged > 0) return "/people/attendance/flagged";
  return "/people/leave/approvals";
}

export function PendingApprovalsChip() {
  const { user } = useCurrentUser();

  const { data } = useQuery({
    queryKey: ["pending-approvals", user?.id],
    queryFn: () => getMyPendingApprovalsCount(),
    enabled: !!user?.id,
    // Fetch once on mount, then at most once a minute — cheap for a per-page header.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 45_000,
  });

  // Render only when there is genuinely something for this user to action.
  if (!data || data.total <= 0) return null;

  const { total, breakdown } = data;
  const parts: string[] = [];
  if (breakdown.leave > 0) parts.push(`${breakdown.leave} leave`);
  if (breakdown.regularizations > 0) parts.push(`${breakdown.regularizations} regularization${breakdown.regularizations === 1 ? "" : "s"}`);
  if (breakdown.flagged > 0) parts.push(`${breakdown.flagged} flagged punch${breakdown.flagged === 1 ? "" : "es"}`);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={primaryHref(breakdown)}
          aria-label={`${total} item${total === 1 ? "" : "s"} awaiting your approval`}
          className={cn(
            "group/appr hidden items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[12.5px] font-semibold text-amber-700 shadow-card backdrop-blur transition-all duration-200 hover:-translate-y-px hover:border-amber-500/60 hover:bg-amber-500/15 active:scale-[0.97] sm:inline-flex dark:text-amber-400"
          )}
        >
          <CheckSquare className="size-3.5 transition-transform duration-200 group-hover/appr:scale-110" />
          <span className="tabular-nums">{total}</span>
          <span className="hidden text-amber-700/80 md:inline dark:text-amber-400/80">
            to approve
          </span>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">Awaiting your action</p>
        <p className="text-muted-foreground">
          {parts.length > 0 ? parts.join(" · ") : `${total} pending`}
        </p>
        <p className="text-muted-foreground">Tap to open the queue</p>
      </TooltipContent>
    </Tooltip>
  );
}
