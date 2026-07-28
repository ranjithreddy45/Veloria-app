"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/shared/status-pill";
import {
  upsertPayComponent, togglePayComponent, seedDefaultPayComponents,
  type PayComponentRow,
} from "@/actions/hr-payroll-config.actions";

const CALC_LABELS: Record<string, string> = {
  FLAT: "Flat amount",
  PCT_OF_BASIC: "% of Basic",
  PCT_OF_CTC: "% of CTC",
  BALANCE: "Balance (residual)",
};
const KIND_LABELS: Record<string, string> = { EARNING: "Earning", DEDUCTION: "Deduction" };

function rateLabel(c: PayComponentRow): string {
  if (c.calcType === "FLAT") return `₹${c.rate.toLocaleString("en-IN")}/mo`;
  if (c.calcType === "BALANCE") return "residual";
  return `${c.rate}%`;
}

export function PayComponentsAdmin({ components }: { components: PayComponentRow[] }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold">Pay components</h3>
          <p className="text-[12.5px] text-muted-foreground">
            The earning and deduction heads used to build salary structures.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {components.length === 0 && <SeedButton />}
          <ComponentDialog />
        </div>
      </div>

      {components.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No pay components yet. Use <span className="font-medium">Seed defaults</span> to add HRA, Conveyance,
          Medical and Special Allowance, or add your own.
        </div>
      ) : (
        <div className="divide-y">
          {components.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2.5 first:pt-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{c.name}</span>
                  <StatusPill
                    label={KIND_LABELS[c.kind] ?? c.kind}
                    hue={c.kind === "EARNING" ? "emerald" : "rose"}
                    size="xs"
                  />
                  {c.statutory !== "NONE" && <StatusPill label={c.statutory} hue="violet" size="xs" />}
                  {!c.taxable && <StatusPill label="Tax-free" hue="slate" size="xs" />}
                  {!c.active && <StatusPill label="Inactive" hue="slate" size="xs" />}
                </div>
                <span className="text-[12px] text-muted-foreground">
                  {c.code} · {CALC_LABELS[c.calcType] ?? c.calcType} · {rateLabel(c)}
                  {c.partOfCtc ? " · part of CTC" : " · over & above CTC"}
                </span>
              </div>
              <ComponentDialog existing={c} />
              <ToggleActive id={c.id} active={c.active} />
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-[12px] text-muted-foreground">
        Statutory deductions — PF, ESI, Professional Tax and TDS — are calculated by the payroll engine from
        current law, not configured as components.
      </p>
    </div>
  );
}

function SeedButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="outline" size="sm" className="gap-1.5" disabled={busy}
      onClick={async () => { setBusy(true); await seedDefaultPayComponents(); setBusy(false); router.refresh(); }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Seed defaults
    </Button>
  );
}

function ToggleActive({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={active}
        disabled={busy}
        onCheckedChange={async (v) => { setBusy(true); await togglePayComponent(id, v); setBusy(false); router.refresh(); }}
        aria-label={active ? "Deactivate component" : "Activate component"}
      />
      {busy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
    </div>
  );
}

function ComponentDialog({ existing }: { existing?: PayComponentRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [code, setCode] = React.useState(existing?.code ?? "");
  const [name, setName] = React.useState(existing?.name ?? "");
  const [kind, setKind] = React.useState(existing?.kind ?? "EARNING");
  const [calcType, setCalcType] = React.useState(existing?.calcType ?? "FLAT");
  const [rate, setRate] = React.useState(existing ? String(existing.rate) : "");
  const [taxable, setTaxable] = React.useState(existing?.taxable ?? true);
  const [partOfCtc, setPartOfCtc] = React.useState(existing?.partOfCtc ?? true);
  const [order, setOrder] = React.useState(existing ? String(existing.order) : "50");

  const needsRate = calcType !== "BALANCE";

  async function save() {
    setError(null);
    setSaving(true);
    const res = await upsertPayComponent({
      id: existing?.id,
      code,
      name,
      kind: kind as PayComponentRow["kind"],
      calcType: calcType as PayComponentRow["calcType"],
      rate: needsRate ? Number(rate) || 0 : 0,
      taxable,
      partOfCtc,
      order: Number(order) || 0,
      active: existing?.active ?? true,
    });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false);
    if (!existing) {
      setCode(""); setName(""); setKind("EARNING"); setCalcType("FLAT");
      setRate(""); setTaxable(true); setPartOfCtc(true); setOrder("50");
    }
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><Pencil className="size-4" /></Button>
        ) : (
          <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add component</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit pay component" : "New pay component"}</DialogTitle>
          <DialogDescription>
            Earnings build up the salary; one “Balance” earning absorbs the residual so the structure sums to CTC.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="HRA" disabled={!!existing} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="House Rent Allowance" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Calculation</Label>
            <Select value={calcType} onValueChange={(v) => setCalcType(v as typeof calcType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CALC_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {needsRate && (
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">{calcType === "FLAT" ? "Amount (₹/mo)" : "Rate (%)"}</Label>
              <Input type="number" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={calcType === "FLAT" ? "1600" : "40"} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Order</Label>
            <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} placeholder="50" />
          </div>
          <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
            <Switch checked={taxable} onCheckedChange={setTaxable} /> Taxable
          </label>
          <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
            <Switch checked={partOfCtc} onCheckedChange={setPartOfCtc} /> Part of CTC
          </label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
