"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Wallet, Pencil, Loader2, History, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { formatINR, formatDate } from "@/lib/utils";
import { saveSalaryStructure, applyIncrement, type SalaryStructureRow } from "@/actions/hr-compensation.actions";

export function CompensationPanel({
  employeeId, current, history, canWrite,
}: {
  employeeId: string;
  current: SalaryStructureRow | null;
  history: SalaryStructureRow[];
  canWrite: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-success" />
            <h3 className="text-meta font-semibold uppercase tracking-[0.12em] text-muted-foreground">Current compensation</h3>
          </div>
          {canWrite && (
            <div className="flex items-center gap-2">
              {current && <IncrementDialog employeeId={employeeId} current={current} />}
              <ReviseDialog employeeId={employeeId} current={current} />
            </div>
          )}
        </div>

        {current ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Annual CTC" value={formatINR(current.annualCtc)} big />
              <Stat label="Monthly CTC" value={formatINR(current.monthlyCtc)} />
              <Stat label="Basic" value={`${current.basicPct}% of CTC`} />
            </div>
            <p className="mt-2 text-detail text-muted-foreground">
              Effective {formatDate(current.effectiveFrom)}{current.note ? ` · ${current.note}` : ""}
            </p>

            <div className="mt-5">
              <h4 className="mb-2 text-meta font-semibold uppercase tracking-wide text-muted-foreground">Monthly breakdown</h4>
              <div className="divide-y overflow-hidden rounded-xl border">
                {current.lines.map((l) => (
                  <div key={l.code} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-body">
                    <span className="inline-flex items-center gap-2">
                      {l.name}
                      {l.kind === "DEDUCTION" && <StatusPill label="Deduction" hue="rose" size="xs" />}
                      {!l.taxable && <StatusPill label="Tax-free" hue="slate" size="xs" />}
                    </span>
                    <span className="numeric font-medium">{formatINR(l.monthly)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 border-t-2 bg-muted/50 px-3.5 py-3 text-body font-semibold">
                  <span>Total monthly CTC</span>
                  <span className="numeric text-copy">{formatINR(current.monthlyCtc)}</span>
                </div>
              </div>
              <p className="mt-2 text-detail text-muted-foreground">
                Statutory deductions (PF, ESI, PT, TDS) are computed by the payroll engine at each pay run — they are not shown in the CTC build-up.
              </p>
            </div>
          </>
        ) : (
          <EmptyState
            icon={<Wallet className="size-5" />}
            title="No salary structure on file"
            description={
              canWrite
                ? "Use “Revise salary” to set the annual CTC and basic split — payroll builds every payslip from it."
                : "A salary structure hasn’t been recorded for this employee yet."
            }
            className="py-10"
          />
        )}
      </div>

      {history.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <h3 className="text-meta font-semibold uppercase tracking-[0.12em] text-muted-foreground">Revision history</h3>
          </div>
          <div className="divide-y">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 py-3 text-body first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="numeric font-medium">{formatINR(h.annualCtc)}</span>
                    <span className="text-muted-foreground">/yr</span>
                    {h.isCurrent && <StatusPill label="Current" hue="emerald" size="xs" />}
                  </div>
                  <span className="text-detail text-muted-foreground">
                    Effective {formatDate(h.effectiveFrom)} · Basic {h.basicPct}%{h.note ? ` · ${h.note}` : ""}
                  </span>
                </div>
                <span className="numeric shrink-0 text-muted-foreground">{formatINR(h.monthlyCtc)}/mo</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3">
      <div className="text-meta uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`numeric mt-1 font-semibold leading-none ${big ? "text-title" : "text-lede"}`}>{value}</div>
    </div>
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function ReviseDialog({ employeeId, current }: { employeeId: string; current: SalaryStructureRow | null }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [annualCtc, setAnnualCtc] = React.useState(current ? String(current.annualCtc) : "");
  const [basicPct, setBasicPct] = React.useState(current ? String(current.basicPct) : "50");
  const [effectiveFrom, setEffectiveFrom] = React.useState(todayIso());
  const [note, setNote] = React.useState("");

  async function save() {
    setError(null);
    setSaving(true);
    const res = await saveSalaryStructure(employeeId, {
      annualCtc: Number(annualCtc) || 0,
      basicPct: Number(basicPct) || 0,
      effectiveFrom,
      note: note.trim() || undefined,
    });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setNote("");
    setOpen(false);
    router.refresh();
  }

  const monthlyPreview = Number(annualCtc) > 0 ? Math.round(Number(annualCtc) / 12) : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="size-3.5" /> Revise salary
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Revise salary</DialogTitle>
          <DialogDescription>
            Saving creates a new revision and supersedes the current structure. The monthly breakdown is resolved from your active pay components.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-detail">Annual CTC (₹)</Label>
            <Input type="number" inputMode="numeric" value={annualCtc} onChange={(e) => setAnnualCtc(e.target.value)} placeholder="1200000" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-detail">Basic (% of CTC)</Label>
            <Input type="number" inputMode="numeric" value={basicPct} onChange={(e) => setBasicPct(e.target.value)} placeholder="50" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-detail">Effective from</Label>
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-detail">Monthly CTC</Label>
            <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-body font-medium tabular-nums text-muted-foreground">
              {monthlyPreview > 0 ? formatINR(monthlyPreview) : "—"}
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-detail">Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Annual increment, promotion, ..." />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Save revision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IncrementDialog({ employeeId, current }: { employeeId: string; current: SalaryStructureRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [mode, setMode] = React.useState<"PCT" | "AMOUNT">("PCT");
  const [pct, setPct] = React.useState("10");
  const [newAmount, setNewAmount] = React.useState(String(current.annualCtc));
  const [effectiveFrom, setEffectiveFrom] = React.useState(todayIso());
  const [note, setNote] = React.useState("");

  // Live preview of the resulting new annual CTC (mirrors the server math).
  const pctNum = Number(pct);
  const amtNum = Number(newAmount);
  const previewCtc =
    mode === "PCT"
      ? Number.isFinite(pctNum)
        ? Math.round(current.annualCtc * (1 + pctNum / 100))
        : 0
      : Number.isFinite(amtNum) && amtNum > 0
        ? Math.round(amtNum)
        : 0;
  const delta = previewCtc - current.annualCtc;

  async function save() {
    setError(null);
    setSaving(true);
    const res = await applyIncrement(employeeId, {
      mode,
      pct: mode === "PCT" ? Number(pct) || 0 : undefined,
      newAnnualCtc: mode === "AMOUNT" ? Number(newAmount) || 0 : undefined,
      effectiveFrom,
      note: note.trim(),
    });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setNote("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <TrendingUp className="size-3.5 text-success" /> Apply increment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply increment</DialogTitle>
          <DialogDescription>
            Raise the current CTC ({formatINR(current.annualCtc)}/yr) by a percentage or set a new amount. This writes a new salary revision — reference the appraisal or increment reason in the note.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-detail">Method</Label>
            <div className="flex rounded-md border p-0.5">
              <button
                type="button"
                onClick={() => setMode("PCT")}
                className={`flex-1 rounded px-3 py-1.5 text-detail font-medium transition ${mode === "PCT" ? "bg-success text-white" : "text-muted-foreground hover:bg-muted"}`}
              >
                % raise
              </button>
              <button
                type="button"
                onClick={() => setMode("AMOUNT")}
                className={`flex-1 rounded px-3 py-1.5 text-detail font-medium transition ${mode === "AMOUNT" ? "bg-success text-white" : "text-muted-foreground hover:bg-muted"}`}
              >
                New amount
              </button>
            </div>
          </div>

          {mode === "PCT" ? (
            <div className="space-y-1.5">
              <Label className="text-detail">Increment (%)</Label>
              <Input type="number" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="10" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-detail">New annual CTC (₹)</Label>
              <Input type="number" inputMode="numeric" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="1320000" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-detail">Effective from</Label>
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-detail">New annual CTC</Label>
            <div className="flex h-9 items-center justify-between rounded-md border bg-muted/40 px-3 text-body font-medium tabular-nums">
              <span>{previewCtc > 0 ? formatINR(previewCtc) : "—"}</span>
              {previewCtc > 0 && delta !== 0 && (
                <span className={delta > 0 ? "text-success" : "text-destructive"}>
                  {delta > 0 ? "+" : ""}{formatINR(delta)}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-detail">Reason / note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Increment: 10% — FY25 appraisal" />
            <p className="text-meta text-muted-foreground">
              Reference the appraisal outcome or KRA payout that drove this raise. Basic % ({current.basicPct}%) carries over from the current structure.
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || previewCtc <= 0} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Apply increment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
