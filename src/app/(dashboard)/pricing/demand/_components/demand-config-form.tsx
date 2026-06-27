"use client";

import * as React from "react";
import { toast } from "sonner";

import type { DemandConfig } from "@/lib/pricing/date-demand";
import { updateDemandConfig } from "@/actions/peak-dates.actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Props {
  config: DemandConfig;
  defaults: DemandConfig;
  canManage: boolean;
}

const NUMERIC_FIELDS: {
  key: keyof Omit<DemandConfig, "enabled">;
  label: string;
  hint: string;
}[] = [
  { key: "muhurthamPct", label: "Muhurtham premium", hint: "Auspicious wedding dates" },
  { key: "festivalPct", label: "Festival premium", hint: "Festival / peak dates" },
  { key: "saturdayPct", label: "Saturday premium", hint: "Weekend uplift (Sat)" },
  { key: "sundayPct", label: "Sunday premium", hint: "Weekend uplift (Sun)" },
  {
    key: "scarcityStepPct",
    label: "Scarcity step",
    hint: "+% per slot already booked on the date",
  },
  { key: "scarcityCapPct", label: "Scarcity cap", hint: "Max scarcity bump" },
];

export function DemandConfigForm({ config, defaults, canManage }: Props) {
  const [enabled, setEnabled] = React.useState(config.enabled);
  const [values, setValues] = React.useState<Record<string, number>>(() => ({
    muhurthamPct: config.muhurthamPct,
    festivalPct: config.festivalPct,
    saturdayPct: config.saturdayPct,
    sundayPct: config.sundayPct,
    scarcityStepPct: config.scarcityStepPct,
    scarcityCapPct: config.scarcityCapPct,
  }));
  const [saving, setSaving] = React.useState(false);

  function setNum(key: string, raw: string) {
    const n = raw === "" ? 0 : Math.max(0, Math.round(Number(raw)));
    if (Number.isNaN(n)) return;
    setValues((v) => ({ ...v, [key]: n }));
  }

  function resetToDefaults() {
    setEnabled(defaults.enabled);
    setValues({
      muhurthamPct: defaults.muhurthamPct,
      festivalPct: defaults.festivalPct,
      saturdayPct: defaults.saturdayPct,
      sundayPct: defaults.sundayPct,
      scarcityStepPct: defaults.scarcityStepPct,
      scarcityCapPct: defaults.scarcityCapPct,
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await updateDemandConfig({
        enabled,
        muhurthamPct: values.muhurthamPct,
        festivalPct: values.festivalPct,
        saturdayPct: values.saturdayPct,
        sundayPct: values.sundayPct,
        scarcityStepPct: values.scarcityStepPct,
        scarcityCapPct: values.scarcityCapPct,
      });
      if (res.success) toast.success("Demand pricing config saved");
      else toast.error(res.error);
    } catch {
      toast.error("Failed to save config");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demand pricing engine</CardTitle>
        <CardDescription>
          The advisory premiums Sales sees on the quote builder. Premiums are a %
          uplift on the whole quote — they warn loudly, they don&apos;t silently
          change the maths. Conservative defaults shown in muted text.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Date-demand pricing enabled</p>
            <p className="text-xs text-muted-foreground">
              When off, every date is priced as a standard date (no premiums).
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={!canManage}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NUMERIC_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key} className="text-sm">
                {f.label}
              </Label>
              <div className="relative">
                <Input
                  id={f.key}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={values[f.key]}
                  onChange={(e) => setNum(f.key, e.target.value)}
                  disabled={!canManage || !enabled}
                  className="pr-7"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {f.hint} · default{" "}
                <span className="font-medium">{defaults[f.key]}%</span>
              </p>
            </div>
          ))}
        </div>
      </CardContent>
      {canManage && (
        <CardFooter className="justify-end gap-2">
          <Button variant="ghost" onClick={resetToDefaults} disabled={saving}>
            Reset to defaults
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save config"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
