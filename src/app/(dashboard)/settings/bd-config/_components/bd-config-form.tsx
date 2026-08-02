"use client";

// ============================================================
// BD / Acquisition CRM config form (admin-only save).
// Editable keys are the known ACQ_CONFIG_DEFAULTS keys, grouped into
// sensible sections with labels + helper text. Large-deal sign-off
// threshold is shown formatted in lakhs alongside its raw rupee input.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { setAcqConfigValues } from "@/actions/acq-config.actions";
import type { AcqConfigKey } from "@/lib/acq/constants";

type Values = Record<AcqConfigKey, number>;

interface FieldDef {
  key: AcqConfigKey;
  label: string;
  help: string;
  unit?: string; // shown as a suffix hint
  step?: number;
  isRupees?: boolean; // render a lakh preview
}

interface Group {
  title: string;
  description: string;
  fields: FieldDef[];
}

const GROUPS: Group[] = [
  {
    title: "Commercial floors",
    description: "Minimum economics the deal engine will accept on a Won deal.",
    fields: [
      {
        key: "MANAGEMENT_BASE_FEE_FLOOR_PCT",
        label: "Management base fee floor %",
        help: "Lowest acceptable base management fee, as a percentage.",
        unit: "%",
        step: 0.5,
      },
      {
        key: "MANAGEMENT_INCENTIVE_FLOOR_PCT",
        label: "Management incentive floor %",
        help: "Lowest acceptable performance-incentive share, as a percentage.",
        unit: "%",
        step: 0.5,
      },
      {
        key: "FRANCHISE_ROYALTY_FLOOR_PCT",
        label: "Franchise royalty floor %",
        help: "Lowest acceptable franchise royalty, as a percentage.",
        unit: "%",
        step: 0.5,
      },
      {
        key: "MIN_LOCKIN_YEARS",
        label: "Minimum lock-in (years)",
        help: "Shortest contract lock-in period a deal may carry.",
        unit: "yrs",
        step: 1,
      },
    ],
  },
  {
    title: "Lead SLAs & qualification",
    description: "Response-time and disqualification guardrails on new leads.",
    fields: [
      {
        key: "LEAD_FIRST_CONTACT_SLA_HOURS",
        label: "First-contact SLA (hours)",
        help: "Time allowed to make first contact with a new lead before it breaches SLA.",
        unit: "hrs",
        step: 1,
      },
      {
        key: "LEAD_MIN_ATTEMPTS_BEFORE_DISQUALIFY",
        label: "Min attempts before disqualify",
        help: "How many contact attempts are required before a lead can be disqualified for no-response.",
        unit: "attempts",
        step: 1,
      },
      {
        key: "LEAD_DISQUALIFY_WINDOW_DAYS",
        label: "Disqualify window (days)",
        help: "Days of no response after which a lead may be disqualified.",
        unit: "days",
        step: 1,
      },
      {
        key: "EVALUATION_PASS_THRESHOLD",
        label: "Evaluation pass threshold",
        help: "Minimum evaluation score (out of 100) required to pass the evaluation stage.",
        unit: "/ 100",
        step: 1,
      },
    ],
  },
  {
    title: "Onboarding & re-engagement",
    description: "Post-win onboarding pace and re-engagement timing.",
    fields: [
      {
        key: "ONBOARDING_SLA_DAYS",
        label: "Onboarding SLA (days)",
        help: "Target days to complete property onboarding after a deal is Won.",
        unit: "days",
        step: 1,
      },
      {
        key: "REENGAGE_DAYS",
        label: "Re-engage after (days)",
        help: "Days before a lost lead (eligible reasons) is re-surfaced for re-engagement.",
        unit: "days",
        step: 1,
      },
    ],
  },
  {
    title: "Governance",
    description: "Sign-off thresholds for high-value deals.",
    fields: [
      {
        key: "LARGE_DEAL_SIGNOFF_VALUE",
        label: "Large deal sign-off threshold (₹)",
        help: "A Won deal at or above this projected fee value requires BD Head sign-off.",
        isRupees: true,
        step: 50000,
      },
    ],
  },
];

function formatLakhs(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  const lakhs = value / 100000;
  // Show up to 2 decimals, trim trailing zeros.
  const str = lakhs.toFixed(2).replace(/\.?0+$/, "");
  return `₹${str} ${lakhs === 1 ? "lakh" : "lakhs"}`;
}

export function BdConfigForm({ initialValues }: { initialValues: Values }) {
  const router = useRouter();
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initialValues).map(([k, v]) => [k, String(v)])),
  );
  const [isPending, startTransition] = React.useTransition();

  const dirty = React.useMemo(
    () =>
      Object.entries(values).some(
        ([k, v]) => Number(v) !== initialValues[k as AcqConfigKey],
      ),
    [values, initialValues],
  );

  function setField(key: string, raw: string) {
    setValues((prev) => ({ ...prev, [key]: raw }));
  }

  function handleSave() {
    // Validate client-side before the round-trip (server re-validates).
    const payload: Record<string, number> = {};
    for (const group of GROUPS) {
      for (const f of group.fields) {
        const n = Number(values[f.key]);
        if (!Number.isFinite(n) || n < 0) {
          toast.error(`${f.label} must be a non-negative number.`);
          return;
        }
        payload[f.key] = n;
      }
    }

    startTransition(async () => {
      const res = await setAcqConfigValues(payload);
      if (res.success) {
        toast.success("BD CRM config saved.");
        setValues(
          Object.fromEntries(Object.entries(res.data).map(([k, v]) => [k, String(v)])),
        );
        router.refresh();
      } else {
        toast.error(res.error || "Failed to save config.");
      }
    });
  }

  function handleReset() {
    setValues(
      Object.fromEntries(Object.entries(initialValues).map(([k, v]) => [k, String(v)])),
    );
  }

  return (
    <div className="space-y-6">
      {GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="text-base">{group.title}</CardTitle>
            <CardDescription>{group.description}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            {group.fields.map((f) => {
              const raw = values[f.key] ?? "";
              return (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={f.key} className="text-body font-medium">
                    {f.label}
                  </Label>
                  <div className="relative">
                    <Input
                      id={f.key}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={f.step ?? 1}
                      value={raw}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className={f.unit ? "pr-16" : undefined}
                    />
                    {f.unit && (
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-detail text-muted-foreground">
                        {f.unit}
                      </span>
                    )}
                  </div>
                  <p className="text-meta leading-snug text-muted-foreground">
                    {f.help}
                    {f.isRupees && (
                      <span className="ml-1 font-medium text-foreground">
                        ({formatLakhs(Number(raw))})
                      </span>
                    )}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={isPending || !dirty}
        >
          Reset
        </Button>
        <Button type="button" onClick={handleSave} disabled={isPending || !dirty}>
          {isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          Save changes
        </Button>
      </div>
    </div>
  );
}
