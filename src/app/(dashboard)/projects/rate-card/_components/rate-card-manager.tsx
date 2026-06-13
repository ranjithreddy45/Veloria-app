"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, GanttChartSquare, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import { seedRateCard, updateRateCardItem } from "@/actions/project-ratecard.actions";

interface RateItem {
  id: string; categoryKey: string; label: string; basis: string; rate: string | number;
  unitLabel: string; durationWeeks: number; luxuryMinPerSqft: string | number | null; isActive: boolean;
}

const BASIS_LABEL: Record<string, string> = { AREA: "per sq ft", UNIT: "per unit", LUMPSUM: "flat" };

export function RateCardManager({ items, canManage }: { items: RateItem[]; canManage: boolean }) {
  if (items.length === 0) {
    return canManage ? <SeedPanel /> : (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">The rate card hasn’t been set up yet. Ask a Projects admin to initialise it.</div>
    );
  }
  return (
    <div className="space-y-5">
      <BuildTimeline items={items.filter((i) => i.isActive)} />
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-4 py-2.5 text-[13px] font-semibold">CapEx rate card</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Basis</TableHead>
              <TableHead className="text-right">Rate (₹)</TableHead>
              <TableHead className="text-right">Luxury floor</TableHead>
              <TableHead className="text-right">Duration (wks)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => <RateRow key={it.id} item={it} canManage={canManage} />)}
          </TableBody>
        </Table>
      </div>
      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <AlertTriangle className="size-3.5 text-amber-500" /> The <strong>luxury floor</strong> (₹/sq ft) flags an AREA line as under-built for a premium venue when a project’s rate falls below it.
      </p>
    </div>
  );
}

function RateRow({ item, canManage }: { item: RateItem; canManage: boolean }) {
  const router = useRouter();
  const [rate, setRate] = React.useState(String(item.rate));
  const [dur, setDur] = React.useState(String(item.durationWeeks));
  const [floor, setFloor] = React.useState(item.luxuryMinPerSqft != null ? String(item.luxuryMinPerSqft) : "");
  const [busy, setBusy] = React.useState(false);
  const dirty = rate !== String(item.rate) || dur !== String(item.durationWeeks) || floor !== (item.luxuryMinPerSqft != null ? String(item.luxuryMinPerSqft) : "");

  async function save() {
    setBusy(true);
    await updateRateCardItem(item.id, { rate: Number(rate) || 0, durationWeeks: Number(dur) || 0, luxuryMinPerSqft: floor === "" ? null : Number(floor) });
    setBusy(false); router.refresh();
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{item.label}</TableCell>
      <TableCell><span className="text-[12px] text-muted-foreground">{BASIS_LABEL[item.basis] ?? item.basis}</span></TableCell>
      <TableCell className="text-right">
        {canManage ? <Input value={rate} onChange={(e) => setRate(e.target.value)} className="ml-auto h-8 w-28 text-right tabular-nums" /> : <span className="tabular-nums">{Number(item.rate).toLocaleString("en-IN")}</span>}
      </TableCell>
      <TableCell className="text-right">
        {item.basis === "AREA" ? (canManage ? <Input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="—" className="ml-auto h-8 w-24 text-right tabular-nums" /> : <span className="tabular-nums">{item.luxuryMinPerSqft ?? "—"}</span>) : <span className="text-muted-foreground/50">—</span>}
      </TableCell>
      <TableCell className="text-right">
        {canManage ? <Input value={dur} onChange={(e) => setDur(e.target.value)} className="ml-auto h-8 w-16 text-right tabular-nums" /> : <span className="tabular-nums">{item.durationWeeks}</span>}
        {canManage && dirty && <Button size="sm" className="ml-2 h-8" disabled={busy} onClick={save}>{busy ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}</Button>}
      </TableCell>
    </TableRow>
  );
}

// Gantt-style build timeline — bars sized by weeks, laid out in a sensible build
// sequence; the longest single pole is the critical path.
function BuildTimeline({ items }: { items: RateItem[] }) {
  const sorted = [...items].sort((a, b) => b.durationWeeks - a.durationWeeks);
  const maxWeeks = Math.max(1, ...sorted.map((i) => i.durationWeeks));
  const critical = sorted[0];

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold"><GanttChartSquare className="size-4 text-primary" /> Standard build timeline</div>
      <div className="space-y-1.5">
        {sorted.map((i) => (
          <div key={i.id} className="flex items-center gap-2">
            <span className="w-44 shrink-0 truncate text-[12px] text-muted-foreground">{i.label}</span>
            <div className="relative h-5 flex-1 rounded bg-muted/40">
              <div
                className={cn("absolute left-0 top-0 h-5 rounded", i.id === critical?.id ? "bg-[#C9A96E]" : "bg-primary/70")}
                style={{ width: `${Math.max(6, (i.durationWeeks / maxWeeks) * 100)}%` }}
              />
              <span className="absolute right-1.5 top-0 flex h-5 items-center text-[10.5px] font-medium text-foreground/70">{i.durationWeeks}w</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[11.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded bg-[#C9A96E]" /> Critical path: {critical?.label} ({critical?.durationWeeks}w)</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded bg-primary/70" /> Other trades (run in parallel on site)</span>
      </div>
    </div>
  );
}

function SeedPanel() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  async function run() {
    setBusy(true); const res = await seedRateCard(); setBusy(false);
    setMsg(res.success ? `Seeded ${res.data.created} rate-card lines.` : res.error); router.refresh();
  }
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-dashed p-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="size-6" /></div>
      <h3 className="mt-4 text-lg font-semibold">Set up the rate card</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">Seed the CapEx rate card from the standard Veloria build benchmarks — rates, luxury floors and build durations. Editable afterwards.</p>
      <Button onClick={run} disabled={busy} className="mt-5 gap-1.5">{busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Set up rate card</Button>
      {msg && <p className="mt-3 text-[13px] text-muted-foreground">{msg}</p>}
    </div>
  );
}
