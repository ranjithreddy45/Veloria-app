"use client";

import Link from "next/link";
import { useState } from "react";
import { Flame, Loader2, CheckCircle2, Hand, Users, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markSellDownTargetStatus } from "@/actions/sell-down.actions";
import type { SellDownTargetView } from "@/lib/sales/sell-down";

function fmtDate(iso: string): string {
  // iso is a UTC day key "YYYY-MM-DD" — format in UTC to avoid TZ drift.
  const d = new Date(iso + "T00:00:00.000Z");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function occColor(pct: number): string {
  if (pct <= 0) return "bg-emerald-500";
  if (pct <= 33) return "bg-lime-500";
  return "bg-amber-500";
}

const STATUS_BADGE: Record<string, { label: string; variant: "secondary" | "warning" | "success" | "outline" }> = {
  OPEN: { label: "Open", variant: "secondary" },
  WORKING: { label: "Working", variant: "warning" },
  FILLED: { label: "Filled", variant: "success" },
  EXPIRED: { label: "Expired", variant: "outline" },
};

export function SellDownTargetCard({
  target,
  onChanged,
}: {
  target: SellDownTargetView;
  onChanged?: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const pct = Math.max(0, Math.min(100, Math.round(target.occupancyPct)));
  const statusInfo = STATUS_BADGE[target.status] ?? STATUS_BADGE.OPEN;
  const isClosed = target.status === "FILLED" || target.status === "EXPIRED";

  async function setStatus(status: "WORKING" | "FILLED" | "EXPIRED") {
    setPending(status);
    try {
      const res = await markSellDownTargetStatus(target.id, status);
      if (res.success) {
        toast.success(
          status === "WORKING" ? "Claimed — you're working this slot." : status === "FILLED" ? "Marked filled." : "Dismissed."
        );
        onChanged?.();
      } else {
        toast.error(res.error);
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card p-4 shadow-premium transition-shadow hover:shadow-card-hover",
        isClosed && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">{target.venueName}</span>
            {target.isPeakDate && (
              <Badge variant="warning" className="gap-1">
                <Flame className="size-3" /> Peak date
              </Badge>
            )}
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[12.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" /> {fmtDate(target.dateISO)}
            </span>
            <span>·</span>
            <span>{target.slotLabel}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Occupancy</div>
          <div className="text-[20px] font-bold tabular-nums leading-none">{pct}%</div>
        </div>
      </div>

      {/* Occupancy bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", occColor(pct))} style={{ width: `${pct}%` }} />
      </div>

      {/* Matched leads */}
      <div className="mt-3.5">
        {target.matchedLeads.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">No matching open leads yet — pull from the funnel.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {target.matchedLeads.slice(0, 6).map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="group inline-flex max-w-[15rem] items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[12px] transition-colors hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                title={`${lead.title}${lead.contactName ? ` · ${lead.contactName}` : ""} · score ${lead.score}`}
              >
                <span className="truncate font-medium">{lead.contactName ?? lead.title}</span>
                {typeof lead.guestCount === "number" && (
                  <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                    <Users className="size-3" />
                    {lead.guestCount}
                  </span>
                )}
                <span className="rounded-full bg-violet-100 px-1.5 text-[10.5px] font-semibold tabular-nums text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                  {lead.score}
                </span>
              </Link>
            ))}
            {target.matchedLeads.length > 6 && (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[12px] text-muted-foreground">
                +{target.matchedLeads.length - 6} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {target.matchedLeads[0] && (
          <Button asChild size="sm" variant="outline" className="h-8">
            <Link href={`/quotations/builder?leadId=${target.matchedLeads[0].id}`}>Build quote</Link>
          </Button>
        )}
        {!isClosed && target.status !== "WORKING" && (
          <Button size="sm" variant="outline" className="h-8" disabled={pending !== null} onClick={() => setStatus("WORKING")}>
            {pending === "WORKING" ? <Loader2 className="size-3.5 animate-spin" /> : <Hand className="size-3.5" />}
            Work it
          </Button>
        )}
        {!isClosed && (
          <Button size="sm" variant="ghost" className="h-8 text-success" disabled={pending !== null} onClick={() => setStatus("FILLED")}>
            {pending === "FILLED" ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            Filled
          </Button>
        )}
        {!isClosed && (
          <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" disabled={pending !== null} onClick={() => setStatus("EXPIRED")}>
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
}
