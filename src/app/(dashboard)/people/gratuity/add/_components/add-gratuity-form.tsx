"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { recordGratuitySettlement } from "@/actions/hr-gratuity.actions";
import type { GratuityRow } from "@/app/(dashboard)/people/gratuity/_lib/gratuity-types";
import { formatInr } from "@/app/(dashboard)/people/gratuity/_lib/gratuity-types";

export function AddGratuityForm({ rows }: { rows: GratuityRow[] }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = React.useState("");
  const [settlementDate, setSettlementDate] = React.useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  // Tracks whether the user manually edited the amount, so re-picking an
  // employee only re-fills an untouched field (never clobbers manual input).
  const [amountDirty, setAmountDirty] = React.useState(false);

  const selected = rows.find((r) => r.id === employeeId) ?? null;

  function pickEmployee(id: string) {
    setEmployeeId(id);
    const row = rows.find((r) => r.id === id);
    if (row && !amountDirty) {
      // Pre-fill from the shared calculator's projection (null → blank).
      setAmount(row.projectedPayout != null ? String(row.projectedPayout) : "");
    }
  }

  async function submit() {
    if (!employeeId) {
      toast.error("Pick an employee.");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    setSaving(true);
    const res = await recordGratuitySettlement({
      employeeId,
      settlementDate,
      amount: amt,
      note: note.trim() || undefined,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Gratuity settlement recorded.");
    setEmployeeId("");
    setAmount("");
    setNote("");
    setAmountDirty(false);
    router.refresh();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-premium">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-[12.5px]">Employee</Label>
            <Select value={employeeId} onValueChange={pickEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Select an employee" />
              </SelectTrigger>
              <SelectContent>
                {rows.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} · {r.empCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Settlement date</Label>
            <Input
              type="date"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Amount (₹)</Label>
            <Input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountDirty(true);
              }}
            />
            {selected?.projectedPayout != null && (
              <p className="text-[11.5px] text-muted-foreground">
                Calculated projection: {formatInr(selected.projectedPayout)} (editable).
              </p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-[12.5px]">Reason / note</Label>
            <Textarea
              rows={3}
              placeholder="Why this manual settlement / override?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={submit} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Record settlement
          </Button>
        </div>
      </div>

      <aside className="space-y-3">
        {selected && (
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-premium">
            <p className="text-[12.5px] font-semibold">{selected.name}</p>
            <dl className="mt-2 space-y-1.5 text-[12.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Years of service</dt>
                <dd className="tabular-nums">{selected.yearsOfService.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Eligible (5y+)</dt>
                <dd>{selected.eligible ? "Yes" : "No"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Last drawn basic</dt>
                <dd className="tabular-nums">
                  {selected.lastBasic == null ? "—" : formatInr(selected.lastBasic)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Projected payout</dt>
                <dd className="tabular-nums font-semibold">
                  {selected.projectedPayout == null ? "—" : formatInr(selected.projectedPayout)}
                </dd>
              </div>
            </dl>
            {selected.lastBasic == null && (
              <p className="mt-2 text-[11.5px] text-warning">
                No current salary structure — projection unavailable. You can still record a manual
                amount.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2 rounded-2xl border border-border/60 bg-muted/30 p-4 text-[12px] text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Recorded settlements are stored as an audit-log entry (there is no dedicated gratuity
            payment table yet). A queryable GratuityPayment ledger with GL posting is a planned
            follow-up.
          </p>
        </div>
      </aside>
    </div>
  );
}
