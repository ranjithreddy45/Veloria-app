"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  IndianRupeeIcon,
  TrendingUpIcon,
  TargetIcon,
  TrophyIcon,
  UsersIcon,
  Loader2Icon,
} from "lucide-react";

import { StatTile } from "@/components/ui/stat-tile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR } from "@/lib/utils";
import {
  getChannelAttribution,
  getCampaignAttribution,
} from "@/actions/attribution-analytics.actions";
import type { AttributionBucket } from "@/schemas/attribution.schema";

interface MarketingDashboardProps {
  initialChannels: AttributionBucket[];
  initialCampaigns: AttributionBucket[];
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function num(n: number | null, suffix = ""): string {
  if (n === null) return "—";
  return `${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${suffix}`;
}

function sum(buckets: AttributionBucket[], key: "spend" | "bookedRevenue" | "leadCount" | "wonCount"): number {
  return buckets.reduce((acc, b) => acc + (b[key] as number), 0);
}

export function MarketingDashboard({
  initialChannels,
  initialCampaigns,
}: MarketingDashboardProps) {
  const [channels, setChannels] = React.useState(initialChannels);
  const [campaigns, setCampaigns] = React.useState(initialCampaigns);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  function applyRange() {
    const params = { from: from || undefined, to: to || undefined };
    startTransition(async () => {
      const [chRes, cmRes] = await Promise.all([
        getChannelAttribution(params),
        getCampaignAttribution(params),
      ]);
      if (chRes.success) setChannels(chRes.data);
      else toast.error(chRes.error ?? "Failed to load channel attribution");
      if (cmRes.success) setCampaigns(cmRes.data);
      else toast.error(cmRes.error ?? "Failed to load campaign attribution");
    });
  }

  function resetRange() {
    setFrom("");
    setTo("");
    startTransition(async () => {
      const [chRes, cmRes] = await Promise.all([
        getChannelAttribution(),
        getCampaignAttribution(),
      ]);
      if (chRes.success) setChannels(chRes.data);
      else toast.error(chRes.error ?? "Failed to load channel attribution");
      if (cmRes.success) setCampaigns(cmRes.data);
      else toast.error(cmRes.error ?? "Failed to load campaign attribution");
    });
  }

  // Blended KPIs.
  const totalSpend = sum(channels, "spend");
  const totalRevenue = sum(channels, "bookedRevenue");
  const totalLeads = sum(channels, "leadCount");
  const totalWon = sum(channels, "wonCount");
  const blendedCac = totalWon > 0 && totalSpend > 0 ? totalSpend / totalWon : null;
  const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : null;
  const winRate = totalLeads > 0 ? totalWon / totalLeads : 0;

  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile
          label="Total spend"
          value={formatINR(totalSpend)}
          accent="amber"
          icon={<IndianRupeeIcon />}
          sub="Across all campaigns"
        />
        <StatTile
          label="Booked revenue"
          value={formatINR(totalRevenue)}
          accent="emerald"
          icon={<TrendingUpIcon />}
          sub="Attributed, won leads"
        />
        <StatTile
          label="Blended CAC"
          value={blendedCac === null ? "—" : formatINR(blendedCac)}
          accent="rose"
          icon={<TargetIcon />}
          sub="Spend ÷ won"
        />
        <StatTile
          label="Blended ROAS"
          value={blendedRoas === null ? "—" : `${blendedRoas.toFixed(2)}×`}
          accent="gold"
          icon={<TrophyIcon />}
          sub="Revenue ÷ spend"
        />
        <StatTile
          label="Win rate"
          value={pct(winRate)}
          accent="blue"
          icon={<UsersIcon />}
          sub={`${totalWon} won / ${totalLeads} leads`}
        />
      </div>

      {/* Date-range filter */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <Button onClick={applyRange} disabled={isPending}>
          {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          Apply
        </Button>
        <Button variant="ghost" onClick={resetRange} disabled={isPending}>
          Reset
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          Win rate = WON leads ÷ total leads in bucket.
        </span>
      </div>

      {/* Per-channel table */}
      <Card>
        <CardHeader>
          <CardTitle>By channel</CardTitle>
        </CardHeader>
        <CardContent>
          <AttributionTable buckets={channels} emptyLabel="No channel data yet." />
        </CardContent>
      </Card>

      {/* Per-campaign table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>By campaign</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/marketing/campaigns">Link spend</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <AttributionTable
            buckets={campaigns}
            emptyLabel="No campaigns linked yet. Create a campaign and set its UTM to attribute leads."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function AttributionTable({
  buckets,
  emptyLabel,
}: {
  buckets: AttributionBucket[];
  emptyLabel: string;
}) {
  if (buckets.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">Won</TableHead>
            <TableHead className="text-right">Win rate</TableHead>
            <TableHead className="text-right">Spend</TableHead>
            <TableHead className="text-right">Booked rev.</TableHead>
            <TableHead className="text-right">CAC</TableHead>
            <TableHead className="text-right">ROAS</TableHead>
            <TableHead className="text-right">Avg LTV</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {buckets.map((b) => (
            <TableRow key={b.key}>
              <TableCell className="font-medium">{b.label}</TableCell>
              <TableCell className="text-right tabular-nums">{b.leadCount}</TableCell>
              <TableCell className="text-right tabular-nums">{b.wonCount}</TableCell>
              <TableCell className="text-right tabular-nums">{pct(b.winRate)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatINR(b.spend)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatINR(b.bookedRevenue)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {b.cac === null ? "—" : formatINR(b.cac)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {b.roas === null ? "—" : `${num(b.roas)}×`}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {b.avgLtv === null ? "—" : formatINR(b.avgLtv)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
