"use client";

import { useEffect, useMemo, useState, useTransition, useCallback } from "react";
import { Flame, RefreshCw, Loader2, Target, CalendarRange, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { StatTile } from "@/components/ui/stat-tile";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSellDownBoard, computeSellDownNow } from "@/actions/sell-down.actions";
import type { SellDownBoardData } from "@/lib/sales/sell-down";
import { SellDownTargetCard } from "./sell-down-target-card";

function fmtAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const STATUS_OPTIONS = [
  { value: "ACTIONABLE", label: "Open · Working · Filled" },
  { value: "OPEN", label: "Open only" },
  { value: "WORKING", label: "Working" },
  { value: "FILLED", label: "Filled" },
  { value: "EXPIRED", label: "Expired" },
];

export function SellDownBoard({
  initial,
  unauthorized,
}: {
  initial: SellDownBoardData | null;
  unauthorized?: boolean;
}) {
  const [data, setData] = useState<SellDownBoardData | null>(initial);
  const [loading, setLoading] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  const [venueId, setVenueId] = useState<string>("ALL");
  const [peakOnly, setPeakOnly] = useState(false);
  const [status, setStatus] = useState<string>("ACTIONABLE");

  // Venue options derived from whatever the board currently holds.
  const venueOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of data?.targets ?? []) map.set(t.venueId, t.venueName);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSellDownBoard({
        venueId: venueId === "ALL" ? undefined : venueId,
        peakOnly: peakOnly || undefined,
        status: status === "ACTIONABLE" ? undefined : status,
      });
      if (res.success) setData(res.data);
      else toast.error(res.error);
    } finally {
      setLoading(false);
    }
  }, [venueId, peakOnly, status]);

  // Re-query when filters change (skip the very first render — we have `initial`).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!mounted) {
      setMounted(true);
      return;
    }
    load();
  }, [venueId, peakOnly, status]); // eslint-disable-line react-hooks/exhaustive-deps

  function refreshNow() {
    startRefresh(async () => {
      const res = await computeSellDownNow();
      if (res.success) {
        toast.success(`Recomputed — ${res.data.upserts} slots refreshed.`);
        await load();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (unauthorized) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-8 text-center text-muted-foreground">
        You don’t have access to the Sell-Down Board.
      </div>
    );
  }

  const kpis = data?.kpis;
  const targets = data?.targets ?? [];

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Open peak slots"
          value={kpis?.openPeakSlots ?? 0}
          accent="rose"
          icon={<Flame />}
          sub="Perishable peak-date inventory to fill"
        />
        <StatTile
          label="Perishable nights"
          value={kpis?.perishableNights ?? 0}
          accent="amber"
          icon={<CalendarRange />}
          sub="Distinct venue/date combos open"
        />
        <StatTile
          label="Lead coverage"
          value={`${kpis?.matchedLeadCoveragePct ?? 0}%`}
          accent="violet"
          icon={<Target />}
          pct={kpis?.matchedLeadCoveragePct ?? 0}
          sub="Open slots with a matched lead"
        />
        <StatTile
          label="Matched open leads"
          value={kpis?.totalMatchedLeads ?? 0}
          accent="emerald"
          icon={<Sparkles />}
          sub="Distinct leads to chase"
        />
      </div>

      {/* Filters + refresh */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card p-3">
        <Select value={venueId} onValueChange={setVenueId}>
          <SelectTrigger className="h-9 w-[12rem]">
            <SelectValue placeholder="All venues" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All venues</SelectItem>
            {venueOptions.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[14rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch id="peakOnly" checked={peakOnly} onCheckedChange={setPeakOnly} />
          <Label htmlFor="peakOnly" className="cursor-pointer text-[13px]">
            Peak dates only
          </Label>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-[12px] text-muted-foreground">
            Updated {fmtAgo(data?.computedAt ?? null)}
          </span>
          <Button size="sm" variant="outline" className="h-9" onClick={refreshNow} disabled={refreshing}>
            {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Refresh now
          </Button>
        </div>
      </div>

      {/* Target list */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card p-10 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading targets…
        </div>
      ) : targets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center">
          <p className="text-[15px] font-medium">No low-occupancy slots in this window.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Everything in range is well booked, or no targets have been computed yet. Try “Refresh now”.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {targets.map((t) => (
            <SellDownTargetCard key={t.id} target={t} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}
