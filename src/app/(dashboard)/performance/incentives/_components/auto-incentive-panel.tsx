"use client";

// ============================================================
// Auto-incentive calculator panel — manager sets the rule, previews per-rep
// suggestions from the period's sales, and creates them as pending incentives.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calculator, Loader2, Sparkles, Check } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  computeIncentiveSuggestions, createComputedIncentives, type IncentiveSuggestion,
} from "@/actions/incentive-calc.actions";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function currentPeriod() {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function AutoIncentivePanel() {
  const router = useRouter();
  const [period, setPeriod] = useState(currentPeriod());
  const [upsellPct, setUpsellPct] = useState(5);
  const [perBookingBonus, setPerBookingBonus] = useState(500);
  const [revenueThreshold, setRevenueThreshold] = useState(0);
  const [revenuePct, setRevenuePct] = useState(0);
  const [rows, setRows] = useState<IncentiveSuggestion[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [computing, setComputing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function compute() {
    setComputing(true);
    try {
      const res = await computeIncentiveSuggestions({ period, upsellPct, perBookingBonus, revenueThreshold, revenuePct });
      if (!res.success) return toast.error(res.error);
      setRows(res.data);
      setSelected(new Set(res.data.map((r) => r.userId)));
      if (res.data.length === 0) toast.info("No qualifying bookings for this month.");
    } finally {
      setComputing(false);
    }
  }

  async function create() {
    if (!rows) return;
    const items = rows.filter((r) => selected.has(r.userId)).map((r) => ({ userId: r.userId, bonusAmount: r.bonus }));
    if (!items.length) return toast.error("Select at least one rep.");
    setSaving(true);
    try {
      const res = await createComputedIncentives({ period, items });
      if (!res.success) return toast.error(res.error);
      toast.success(`${res.data.created} incentive(s) created as pending — review and award below.`);
      setRows(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const totalSelected = rows ? rows.filter((r) => selected.has(r.userId)).reduce((s, r) => s + r.bonus, 0) : 0;

  return (
    <Card className="relative gap-0 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card py-0">
      <div className="pointer-events-none absolute -right-16 -top-16 size-52 rounded-full bg-primary/10 blur-3xl" />
      <CardContent className="relative space-y-4 px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Calculator className="size-4" />
          </div>
          <div>
            <h2 className="text-copy font-semibold tracking-[-0.01em] text-foreground">Auto-calculate incentives</h2>
            <p className="text-detail text-muted-foreground">Set your rule, preview each rep&apos;s incentive from the month&apos;s sales, then create them as pending for review.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/60 bg-card/70 p-4 sm:grid-cols-3 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-detail">Month</Label>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-detail">% of upsell</Label>
            <Input type="number" min={0} value={upsellPct} onChange={(e) => setUpsellPct(+e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-detail">₹ / booking</Label>
            <Input type="number" min={0} value={perBookingBonus} onChange={(e) => setPerBookingBonus(+e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-detail">Revenue threshold ₹</Label>
            <Input type="number" min={0} value={revenueThreshold} onChange={(e) => setRevenueThreshold(+e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-detail">% above threshold</Label>
            <Input type="number" min={0} value={revenuePct} onChange={(e) => setRevenuePct(+e.target.value)} />
          </div>
        </div>

        <Button onClick={compute} disabled={computing} size="sm">
          {computing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Calculate
        </Button>

        {rows && rows.length > 0 && (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-detail">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-meta uppercase tracking-wide text-muted-foreground">
                    <th className="w-8 px-2 py-2"></th>
                    <th className="px-2 py-2 font-medium">Rep</th>
                    <th className="px-2 py-2 text-right font-medium">Bookings</th>
                    <th className="px-2 py-2 text-right font-medium">Revenue</th>
                    <th className="px-2 py-2 text-right font-medium">Upsell</th>
                    <th className="px-2 py-2 text-right font-medium">Incentive</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.userId} className="border-b last:border-0">
                      <td className="px-2 py-2">
                        <button type="button" onClick={() => toggle(r.userId)}
                          className={`flex size-4 items-center justify-center rounded border ${selected.has(r.userId) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                          {selected.has(r.userId) && <Check className="size-3" />}
                        </button>
                      </td>
                      <td className="px-2 py-2 font-medium text-foreground">{r.name}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.bookings}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{inr(r.revenue)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{inr(r.upsell)}</td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-success" title={r.breakdown}>{inr(r.bonus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-body text-muted-foreground">Selected total: <b className="text-foreground">{inr(totalSelected)}</b></span>
              <Button onClick={create} disabled={saving} size="sm">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Create as pending incentives
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
