"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Send } from "lucide-react";
import {
  computeCapex,
  CAPEX_CATEGORIES,
  DEFAULT_CONTINGENCY_PCT,
  type CapexInput,
  type CapexLineInput,
} from "@/lib/projects/capex-calc";
import { createCapex, updateCapex, submitCapex } from "@/actions/projects.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

interface Props {
  projectId: string;
  capexId?: string;
  initialInput?: CapexInput;
  initialNotes?: string;
  readOnly?: boolean;
}

export function CapexCalculator({ projectId, capexId, initialInput, initialNotes, readOnly }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [area, setArea] = useState(String(initialInput?.builtUpAreaSqft ?? 5000));
  const [seats, setSeats] = useState(String(initialInput?.guestSeats ?? 300));
  const [contingency, setContingency] = useState(String(initialInput?.contingencyPct ?? DEFAULT_CONTINGENCY_PCT));
  const [weeks, setWeeks] = useState(initialInput?.weeks ? String(initialInput.weeks) : "");
  const [notes, setNotes] = useState(initialNotes ?? "");

  // line state keyed by category
  const initLines = new Map((initialInput?.lines ?? []).map((l) => [l.key, l]));
  const [lines, setLines] = useState<Record<string, CapexLineInput>>(() => {
    const o: Record<string, CapexLineInput> = {};
    for (const c of CAPEX_CATEGORIES) {
      const l = initLines.get(c.key);
      o[c.key] = { key: c.key, included: l ? l.included : true, rate: l?.rate, qty: l?.qty };
    }
    return o;
  });

  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };

  const input: CapexInput = useMemo(
    () => ({
      builtUpAreaSqft: num(area),
      guestSeats: num(seats),
      contingencyPct: contingency ? num(contingency) : DEFAULT_CONTINGENCY_PCT,
      weeks: weeks ? num(weeks) : undefined,
      lines: Object.values(lines),
    }),
    [area, seats, contingency, weeks, lines]
  );
  const result = useMemo(() => computeCapex(input), [input]);

  function setLine(key: string, patch: Partial<CapexLineInput>) {
    setLines((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function save(submit: boolean) {
    setSaving(true);
    try {
      let id = capexId;
      if (id) {
        const res = await updateCapex(id, input, notes);
        if (!res.success) return toast.error(res.error);
      } else {
        const res = await createCapex(projectId, input, notes);
        if (!res.success) return toast.error(res.error);
        id = res.data.id;
      }
      if (submit && id) {
        const sub = await submitCapex(id);
        if (!sub.success) return toast.error(sub.error);
        toast.success("CapEx submitted for approval.");
      } else {
        toast.success("CapEx saved.");
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Venue inputs</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Built-up area (sq ft) *</Label>
              <Input type="number" min={1} value={area} onChange={(e) => setArea(e.target.value)} disabled={readOnly} />
            </div>
            <div className="space-y-1.5">
              <Label>Guest seats</Label>
              <Input type="number" min={0} value={seats} onChange={(e) => setSeats(e.target.value)} disabled={readOnly} />
            </div>
            <div className="space-y-1.5">
              <Label>Contingency %</Label>
              <Input type="number" min={0} max={100} value={contingency} onChange={(e) => setContingency(e.target.value)} disabled={readOnly} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Cost categories (edit rates/quantities)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {CAPEX_CATEGORIES.map((c) => {
              const l = lines[c.key];
              const rl = result.lines.find((x) => x.key === c.key);
              return (
                <div key={c.key} className="rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={l.included} onCheckedChange={(v) => setLine(c.key, { included: !!v })} disabled={readOnly} />
                    <span className="flex-1 text-sm font-medium">{c.label}</span>
                    <span className="text-sm tabular-nums font-medium">{rl ? inr(rl.amount) : "—"}</span>
                  </div>
                  {l.included && (
                    <div className="mt-2 grid grid-cols-2 gap-2 pl-6 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Rate (₹ {c.unitLabel})</Label>
                        <Input type="number" min={0} value={l.rate ?? c.defaultRate} onChange={(e) => setLine(c.key, { rate: e.target.value === "" ? undefined : num(e.target.value) })} disabled={readOnly} className="h-8" />
                      </div>
                      {c.basis !== "LUMPSUM" && (
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            {c.basis === "AREA" ? "Area (sq ft)" : "Quantity"}
                          </Label>
                          <Input
                            type="number" min={0}
                            value={l.qty ?? (c.basis === "AREA" ? num(area) : c.key === "furniture" ? num(seats) : 1)}
                            onChange={(e) => setLine(c.key, { qty: e.target.value === "" ? undefined : num(e.target.value) })}
                            disabled={readOnly} className="h-8"
                          />
                        </div>
                      )}
                      <p className="col-span-2 text-[11px] text-muted-foreground sm:col-span-1 sm:self-end">{c.note}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Timeline & notes</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Estimated weeks (override)</Label>
              <Input type="number" min={1} value={weeks} onChange={(e) => setWeeks(e.target.value)} placeholder={`Auto: ${result.estimatedWeeks}`} disabled={readOnly} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (for the owner)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Scope notes, exclusions…" disabled={readOnly} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">CapEx Estimate</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1 text-sm">
              {result.lines.map((l) => (
                <div key={l.key} className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate">{l.label}</span>
                  <span className="tabular-nums font-medium">{inr(l.amount)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{inr(result.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Contingency ({result.contingencyPct}%)</span><span className="tabular-nums">{inr(result.contingencyAmount)}</span></div>
              <div className="flex justify-between text-base font-bold pt-1"><span>Total CapEx</span><span className="tabular-nums">{inr(result.total)}</span></div>
              <div className="flex justify-between pt-1 text-sm"><span className="text-muted-foreground">Est. timeline</span><span className="font-medium">{result.estimatedWeeks} weeks</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Gantt-style build timeline */}
        {result.lines.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Build timeline</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {result.lines.map((l) => {
                const maxDur = Math.max(1, ...result.lines.map((x) => x.durationWeeks));
                return (
                  <div key={l.key} className="text-xs">
                    <div className="flex justify-between gap-2"><span className="truncate text-muted-foreground">{l.label}</span><span className="shrink-0 tabular-nums">{l.durationWeeks}w</span></div>
                    <div className="h-2 overflow-hidden rounded bg-muted"><div className="h-full rounded bg-[#C9A96E]" style={{ width: `${(l.durationWeeks / maxDur) * 100}%` }} /></div>
                  </div>
                );
              })}
              <p className="pt-1 text-[11px] text-muted-foreground">Target ~{result.estimatedWeeks} weeks once parallelised; civil/HVAC/lift are the critical path.</p>
            </CardContent>
          </Card>
        )}

        {/* Luxury-benchmark flags */}
        {result.lines.some((l) => l.belowLuxury) && (
          <div className="rounded-md border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-800">
            <strong>Below luxury benchmark:</strong>{" "}
            {result.lines.filter((l) => l.belowLuxury).map((l) => l.label).join(", ")} — these rates are under the premium-finish floor and may under-spec the venue. Raise the rate or confirm the spec.
          </div>
        )}

        {!readOnly && (
          <div className="flex flex-col gap-2">
            <Button onClick={() => save(true)} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Save & Submit for Approval
            </Button>
            <Button variant="outline" onClick={() => save(false)} disabled={saving}><Save className="h-4 w-4" /> Save Draft</Button>
          </div>
        )}
      </div>
    </div>
  );
}
