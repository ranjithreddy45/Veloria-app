"use client";

import * as React from "react";
import {
  Boxes, Wallet, TrendingDown, Landmark, Building2, CalendarRange,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2Icon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import { formatINR } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { AddAssetDialog } from "./add-asset-dialog";
import { RunDepreciationButton } from "./run-depreciation-button";
import { TAB_LIST_SCROLL } from "@/lib/mobile-tabs";

export interface AssetRow {
  id: string;
  name: string;
  category: string | null;
  cost: number;
  salvageValue: number;
  purchaseDate: string;
  usefulLifeMonths: number;
  method: string;
  accumulatedDep: number;
  netBookValue: number;
  status: string;
  venueId: string | null;
}

export interface VenuePnl { venueId: string; income: number; expense: number; net: number }
export interface EventPnl { eventId: string; income: number; expense: number; net: number }

function statusHue(status: string): "emerald" | "amber" | "slate" {
  if (status === "ACTIVE") return "emerald";
  if (status === "FULLY_DEPRECIATED") return "amber";
  return "slate";
}

function statusLabel(status: string): string {
  if (status === "FULLY_DEPRECIATED") return "Fully depreciated";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function AssetsWorkspace({
  assets, pnl, canWrite,
}: {
  assets: AssetRow[];
  pnl: { byVenue: VenuePnl[]; byEvent: EventPnl[] };
  canWrite: boolean;
}) {
  const count = assets.length;
  const grossBookValue = assets.reduce((s, a) => s + a.cost, 0);
  const accumulatedDep = assets.reduce((s, a) => s + a.accumulatedDep, 0);
  const netBookValue = grossBookValue - accumulatedDep;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2Icon}
        accent="teal"
        eyebrow="Finance · Fixed Assets"
        title="Fixed assets & profitability"
        description="Track the asset register, run straight-line depreciation that posts to the General Ledger, and read venue & event profitability live from the ledger."
      >
        {canWrite && <AddAssetDialog />}
      </PageHeader>

      <Tabs defaultValue="register">
        <TabsList className={TAB_LIST_SCROLL}>
          <TabsTrigger value="register" className="gap-1.5"><Boxes className="size-3.5" /> Assets register</TabsTrigger>
          <TabsTrigger value="pnl" className="gap-1.5"><Building2 className="size-3.5" /> Venue &amp; Event P&amp;L</TabsTrigger>
        </TabsList>

        {/* ---------- Assets register ---------- */}
        <TabsContent value="register" className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Assets" value={count} accent="indigo" icon={<Boxes className="size-4" />} sub="On the register" />
            <StatTile label="Gross book value" value={formatINR(grossBookValue)} accent="blue" icon={<Wallet className="size-4" />} sub="Total cost" />
            <StatTile label="Accumulated dep." value={formatINR(accumulatedDep)} accent="rose" icon={<TrendingDown className="size-4" />} sub="Charged to date" />
            <StatTile label="Net book value" value={formatINR(netBookValue)} accent="emerald" icon={<Landmark className="size-4" />} sub="Cost − accumulated" />
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            {assets.length === 0 ? (
              <EmptyState
                icon={<Boxes className="size-5" />}
                title="No assets yet"
                description="Add a fixed asset to start tracking depreciation and net book value."
                action={canWrite ? <AddAssetDialog /> : undefined}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Accumulated dep.</TableHead>
                    <TableHead className="text-right">NBV</TableHead>
                    <TableHead>Status</TableHead>
                    {canWrite && <TableHead className="text-right">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-muted-foreground">{a.category ?? "—"}</TableCell>
                      <TableCell className="text-right numeric">{formatINR(a.cost)}</TableCell>
                      <TableCell className="text-right numeric text-destructive">{formatINR(a.accumulatedDep)}</TableCell>
                      <TableCell className="text-right font-medium numeric">{formatINR(a.netBookValue)}</TableCell>
                      <TableCell><StatusPill label={statusLabel(a.status)} hue={statusHue(a.status)} size="xs" /></TableCell>
                      {canWrite && (
                        <TableCell className="text-right">
                          <RunDepreciationButton assetId={a.id} disabled={a.status !== "ACTIVE"} />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ---------- Venue & Event P&L ---------- */}
        <TabsContent value="pnl" className="space-y-5">
          <PnlTable
            title="By venue"
            icon={<Building2 className="size-4" />}
            keyLabel="Venue"
            rows={pnl.byVenue.map((r) => ({ key: r.venueId, income: r.income, expense: r.expense, net: r.net }))}
          />
          <PnlTable
            title="By event"
            icon={<CalendarRange className="size-4" />}
            keyLabel="Event"
            rows={pnl.byEvent.map((r) => ({ key: r.eventId, income: r.income, expense: r.expense, net: r.net }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PnlTable({
  title, icon, keyLabel, rows,
}: {
  title: string;
  icon: React.ReactNode;
  keyLabel: string;
  rows: { key: string; income: number; expense: number; net: number }[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">{icon}</span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={icon}
          title={`No ${keyLabel.toLowerCase()} P&L yet`}
          description="Profitability appears once posted journal lines are tagged with this dimension."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{keyLabel}</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expense</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="numeric text-[12.5px] text-muted-foreground">{r.key}</TableCell>
                <TableCell className="text-right numeric text-success">{formatINR(r.income)}</TableCell>
                <TableCell className="text-right numeric text-destructive">{formatINR(r.expense)}</TableCell>
                <TableCell className={cn("text-right font-medium numeric", r.net >= 0 ? "text-success" : "text-destructive")}>{formatINR(r.net)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
