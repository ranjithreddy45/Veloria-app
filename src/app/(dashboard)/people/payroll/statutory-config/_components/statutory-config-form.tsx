"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Info, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getStatutoryConfig,
  upsertStatutoryConfig,
  replacePtSlabs,
  type StatutoryConfigInput,
  type PtSlabInput,
} from "@/actions/hr-statutory-config.actions";

type EntityRow = {
  id: string;
  name: string;
  shortCode: string | null;
  configured: boolean;
  updatedAt: Date | null;
};
type LoadedConfig = Awaited<ReturnType<typeof getStatutoryConfig>>;

// Numeric fields are held as string buffers so the inputs can be cleared while
// typing; they are coerced (empty -> 0) only at save time.
interface FormState {
  pfApplicable: boolean;
  esiApplicable: boolean;
  ptApplicable: boolean;
  tdsApplicable: boolean;
  lwfApplicable: boolean;
  pfOnFullBasic: boolean;
  epsApplicable: boolean;
  ptState: string;
  lwfState: string;
  lwfMonths: number[];
  pfRatePct: string;
  pfWageCeiling: string;
  employerPfRatePct: string;
  epsRatePct: string;
  epsWageCeiling: string;
  edliRatePct: string;
  edliWageCeiling: string;
  pfAdminRatePct: string;
  esiRatePct: string;
  employerEsiRatePct: string;
  esiGrossCeiling: string;
  esiMinDailyWage: string;
  ptAmount: string;
  ptGrossThreshold: string;
  lwfEmployee: string;
  lwfEmployer: string;
  gratuityDaysPerYear: string;
  gratuityMonthDivisor: string;
  gratuityMinYears: string;
}

interface SlabRow {
  fromSalary: string;
  toSalary: string; // "" = "and above"
  ptAmount: string;
  additionalAmount: string;
}

// Mirrors the engine's DEFAULT_STAT_CONFIG / schema defaults so a fresh entity
// starts from the same numbers payroll is already using.
const DEFAULT_FORM: FormState = {
  pfApplicable: true,
  esiApplicable: true,
  ptApplicable: true,
  tdsApplicable: true,
  lwfApplicable: false,
  pfOnFullBasic: false,
  epsApplicable: true,
  ptState: "",
  lwfState: "",
  lwfMonths: [],
  pfRatePct: "12",
  pfWageCeiling: "15000",
  employerPfRatePct: "12",
  epsRatePct: "8.33",
  epsWageCeiling: "15000",
  edliRatePct: "0.5",
  edliWageCeiling: "15000",
  pfAdminRatePct: "0.5",
  esiRatePct: "0.75",
  employerEsiRatePct: "3.25",
  esiGrossCeiling: "21000",
  esiMinDailyWage: "0",
  ptAmount: "200",
  ptGrossThreshold: "25000",
  lwfEmployee: "0",
  lwfEmployer: "0",
  gratuityDaysPerYear: "15",
  gratuityMonthDivisor: "26",
  gratuityMinYears: "5",
};

const s = (v: unknown) => String(Number(v ?? 0));

function configToForm(cfg: NonNullable<LoadedConfig>): FormState {
  return {
    pfApplicable: cfg.pfApplicable,
    esiApplicable: cfg.esiApplicable,
    ptApplicable: cfg.ptApplicable,
    tdsApplicable: cfg.tdsApplicable,
    lwfApplicable: cfg.lwfApplicable,
    pfOnFullBasic: cfg.pfOnFullBasic,
    epsApplicable: cfg.epsApplicable,
    ptState: cfg.ptState ?? "",
    lwfState: cfg.lwfState ?? "",
    lwfMonths: [...cfg.lwfMonths],
    pfRatePct: s(cfg.pfRatePct),
    pfWageCeiling: s(cfg.pfWageCeiling),
    employerPfRatePct: s(cfg.employerPfRatePct),
    epsRatePct: s(cfg.epsRatePct),
    epsWageCeiling: s(cfg.epsWageCeiling),
    edliRatePct: s(cfg.edliRatePct),
    edliWageCeiling: s(cfg.edliWageCeiling),
    pfAdminRatePct: s(cfg.pfAdminRatePct),
    esiRatePct: s(cfg.esiRatePct),
    employerEsiRatePct: s(cfg.employerEsiRatePct),
    esiGrossCeiling: s(cfg.esiGrossCeiling),
    esiMinDailyWage: s(cfg.esiMinDailyWage),
    ptAmount: s(cfg.ptAmount),
    ptGrossThreshold: s(cfg.ptGrossThreshold),
    lwfEmployee: s(cfg.lwfEmployee),
    lwfEmployer: s(cfg.lwfEmployer),
    gratuityDaysPerYear: s(cfg.gratuityDaysPerYear),
    gratuityMonthDivisor: s(cfg.gratuityMonthDivisor),
    gratuityMinYears: s(cfg.gratuityMinYears),
  };
}

function slabsToRows(cfg: NonNullable<LoadedConfig>): SlabRow[] {
  return cfg.ptSlabs.map((sl) => ({
    fromSalary: s(sl.fromSalary),
    toSalary: sl.toSalary == null ? "" : s(sl.toSalary),
    ptAmount: s(sl.ptAmount),
    additionalAmount: s(sl.additionalAmount),
  }));
}

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function StatutoryConfigForm({
  entities,
  canEdit,
}: {
  entities: EntityRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [entityId, setEntityId] = React.useState<string>("");
  const [loading, startLoad] = React.useTransition();
  const [saving, setSaving] = React.useState(false);
  const [hasConfig, setHasConfig] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(DEFAULT_FORM);
  const [slabs, setSlabs] = React.useState<SlabRow[]>([]);
  const [initialSlabsJson, setInitialSlabsJson] = React.useState<string>("[]");

  const disabled = !canEdit;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onPickEntity(id: string) {
    setEntityId(id);
    startLoad(async () => {
      const cfg = await getStatutoryConfig(id);
      if (cfg) {
        setForm(configToForm(cfg));
        const rows = slabsToRows(cfg);
        setSlabs(rows);
        setInitialSlabsJson(JSON.stringify(rows));
        setHasConfig(true);
      } else {
        setForm(DEFAULT_FORM);
        setSlabs([]);
        setInitialSlabsJson("[]");
        setHasConfig(false);
      }
    });
  }

  function toggleMonth(m: number) {
    setForm((f) => ({
      ...f,
      lwfMonths: f.lwfMonths.includes(m)
        ? f.lwfMonths.filter((x) => x !== m).sort((a, b) => a - b)
        : [...f.lwfMonths, m].sort((a, b) => a - b),
    }));
  }

  async function onSave() {
    if (!entityId) {
      toast.error("Pick a legal entity first.");
      return;
    }
    // Guard the EPS rule client-side too so the user gets an instant, specific error.
    if (form.epsApplicable && num(form.epsRatePct) > num(form.employerPfRatePct)) {
      toast.error("The pension (EPS) rate cannot exceed the employer PF rate.");
      return;
    }

    const input: StatutoryConfigInput = {
      legalEntityId: entityId,
      pfApplicable: form.pfApplicable,
      esiApplicable: form.esiApplicable,
      ptApplicable: form.ptApplicable,
      tdsApplicable: form.tdsApplicable,
      lwfApplicable: form.lwfApplicable,
      pfRatePct: num(form.pfRatePct),
      pfWageCeiling: num(form.pfWageCeiling),
      pfOnFullBasic: form.pfOnFullBasic,
      employerPfRatePct: num(form.employerPfRatePct),
      epsApplicable: form.epsApplicable,
      epsRatePct: num(form.epsRatePct),
      epsWageCeiling: num(form.epsWageCeiling),
      edliRatePct: num(form.edliRatePct),
      edliWageCeiling: num(form.edliWageCeiling),
      pfAdminRatePct: num(form.pfAdminRatePct),
      esiRatePct: num(form.esiRatePct),
      employerEsiRatePct: num(form.employerEsiRatePct),
      esiGrossCeiling: num(form.esiGrossCeiling),
      esiMinDailyWage: num(form.esiMinDailyWage),
      ptState: form.ptState.trim() || null,
      ptAmount: num(form.ptAmount),
      ptGrossThreshold: num(form.ptGrossThreshold),
      lwfState: form.lwfState.trim() || null,
      lwfEmployee: num(form.lwfEmployee),
      lwfEmployer: num(form.lwfEmployer),
      lwfMonths: form.lwfMonths,
      gratuityDaysPerYear: num(form.gratuityDaysPerYear),
      gratuityMonthDivisor: num(form.gratuityMonthDivisor),
      gratuityMinYears: num(form.gratuityMinYears),
    };

    setSaving(true);
    try {
      const res = await upsertStatutoryConfig(input);
      if (!res.success) {
        toast.error(res.error);
        return;
      }

      // Only touch the slab table when it actually changed. replacePtSlabs
      // requires the config row to exist, which the upsert above guarantees.
      const slabsChanged = JSON.stringify(slabs) !== initialSlabsJson;
      if (slabsChanged) {
        const payload: PtSlabInput[] = slabs.map((r) => ({
          fromSalary: num(r.fromSalary),
          toSalary: r.toSalary.trim() === "" ? null : num(r.toSalary),
          ptAmount: num(r.ptAmount),
          additionalAmount: num(r.additionalAmount),
        }));
        const slabRes = await replacePtSlabs(entityId, payload);
        if (!slabRes.success) {
          toast.error(`Config saved, but PT slabs failed: ${slabRes.error}`);
          setHasConfig(true);
          router.refresh();
          return;
        }
      }

      setHasConfig(true);
      setInitialSlabsJson(JSON.stringify(slabs));
      toast.success("Statutory configuration saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Prominent, always-on explainer. */}
      <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-[13px] leading-relaxed text-amber-800 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p>
          These values drive every payslip&apos;s statutory maths. Changing them affects the{" "}
          <span className="font-semibold">next</span> payroll run — already-finalised payslips are
          not recalculated.
        </p>
      </div>

      {/* Entity picker. */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-[12.5px]">Legal entity</Label>
          <Select value={entityId} onValueChange={onPickEntity} disabled={loading}>
            <SelectTrigger className="min-w-[16rem]">
              <SelectValue placeholder="Select an entity…" />
            </SelectTrigger>
            <SelectContent>
              {entities.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                  {e.shortCode ? ` (${e.shortCode})` : ""}
                  {e.configured ? "" : " · not configured"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {loading && (
          <span className="flex items-center gap-1.5 pb-2 text-[12.5px] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Loading…
          </span>
        )}
      </div>

      {!entityId && (
        <p className="text-[13px] text-muted-foreground">
          Pick a legal entity above to view or edit its statutory configuration.
        </p>
      )}

      {entityId && !loading && (
        <>
          {!hasConfig && (
            <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-4 text-[13px] leading-relaxed text-amber-800 dark:text-amber-200">
              <Info className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p>
                This entity has no saved statutory configuration — payroll is using the built-in
                statutory defaults. {canEdit ? "Review the values below and save to override them." : ""}
              </p>
            </div>
          )}

          {/* Applicability toggles. */}
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <ToggleTile label="PF" checked={form.pfApplicable} disabled={disabled} onChange={(v) => set("pfApplicable", v)} />
              <ToggleTile label="ESI" checked={form.esiApplicable} disabled={disabled} onChange={(v) => set("esiApplicable", v)} />
              <ToggleTile label="PT" checked={form.ptApplicable} disabled={disabled} onChange={(v) => set("ptApplicable", v)} />
              <ToggleTile label="TDS" checked={form.tdsApplicable} disabled={disabled} onChange={(v) => set("tdsApplicable", v)} />
              <ToggleTile label="LWF" checked={form.lwfApplicable} disabled={disabled} onChange={(v) => set("lwfApplicable", v)} />
            </div>
          </Card>

          <Tabs defaultValue="pf">
            <TabsList className="flex-wrap">
              <TabsTrigger value="pf">PF</TabsTrigger>
              <TabsTrigger value="esi">ESI</TabsTrigger>
              <TabsTrigger value="pt">PT</TabsTrigger>
              <TabsTrigger value="lwf">LWF</TabsTrigger>
              <TabsTrigger value="gratuity">Gratuity</TabsTrigger>
            </TabsList>

            {/* PF */}
            <TabsContent value="pf">
              <Card className="p-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <NumField label="Employee PF rate (%)" step="0.01" value={form.pfRatePct} disabled={disabled} onChange={(v) => set("pfRatePct", v)} />
                  <NumField label="PF wage ceiling (₹)" step="1" value={form.pfWageCeiling} disabled={disabled} onChange={(v) => set("pfWageCeiling", v)} />
                  <SwitchField label="PF on full basic (ignore ceiling)" checked={form.pfOnFullBasic} disabled={disabled} onChange={(v) => set("pfOnFullBasic", v)} />
                  <NumField label="Employer PF rate (%)" step="0.01" value={form.employerPfRatePct} disabled={disabled} onChange={(v) => set("employerPfRatePct", v)} />
                  <SwitchField label="EPS (pension) applicable" checked={form.epsApplicable} disabled={disabled} onChange={(v) => set("epsApplicable", v)} />
                  <NumField
                    label="EPS rate (%)"
                    step="0.01"
                    value={form.epsRatePct}
                    disabled={disabled || !form.epsApplicable}
                    onChange={(v) => set("epsRatePct", v)}
                    help="Carved out of the employer PF share — cannot exceed the employer PF rate."
                  />
                  <NumField label="EPS wage ceiling (₹)" step="1" value={form.epsWageCeiling} disabled={disabled || !form.epsApplicable} onChange={(v) => set("epsWageCeiling", v)} />
                  <NumField label="EDLI rate (%)" step="0.01" value={form.edliRatePct} disabled={disabled} onChange={(v) => set("edliRatePct", v)} />
                  <NumField label="EDLI wage ceiling (₹)" step="1" value={form.edliWageCeiling} disabled={disabled} onChange={(v) => set("edliWageCeiling", v)} />
                  <NumField label="PF admin rate (%)" step="0.01" value={form.pfAdminRatePct} disabled={disabled} onChange={(v) => set("pfAdminRatePct", v)} />
                </div>
              </Card>
            </TabsContent>

            {/* ESI */}
            <TabsContent value="esi">
              <Card className="p-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <NumField label="Employee ESI rate (%)" step="0.01" value={form.esiRatePct} disabled={disabled} onChange={(v) => set("esiRatePct", v)} />
                  <NumField label="Employer ESI rate (%)" step="0.01" value={form.employerEsiRatePct} disabled={disabled} onChange={(v) => set("employerEsiRatePct", v)} />
                  <NumField label="ESI gross ceiling (₹)" step="1" value={form.esiGrossCeiling} disabled={disabled} onChange={(v) => set("esiGrossCeiling", v)} />
                  <NumField label="ESI min daily wage (₹)" step="1" value={form.esiMinDailyWage} disabled={disabled} onChange={(v) => set("esiMinDailyWage", v)} help="Employees at or below this daily wage are exempt from the employee ESI leg." />
                </div>
              </Card>
            </TabsContent>

            {/* PT */}
            <TabsContent value="pt">
              <Card className="p-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <TextField label="PT state" value={form.ptState} disabled={disabled} onChange={(v) => set("ptState", v)} placeholder="e.g. KA" />
                  <NumField label="Flat PT amount (₹)" step="1" value={form.ptAmount} disabled={disabled} onChange={(v) => set("ptAmount", v)} help="Fallback used when no slab band matches the salary." />
                  <NumField label="PT gross threshold (₹)" step="1" value={form.ptGrossThreshold} disabled={disabled} onChange={(v) => set("ptGrossThreshold", v)} />
                </div>
                <PtSlabsEditor slabs={slabs} setSlabs={setSlabs} disabled={disabled} />
              </Card>
            </TabsContent>

            {/* LWF */}
            <TabsContent value="lwf">
              <Card className="p-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <TextField label="LWF state" value={form.lwfState} disabled={disabled} onChange={(v) => set("lwfState", v)} placeholder="e.g. MH" />
                  <NumField label="Employee LWF (₹)" step="1" value={form.lwfEmployee} disabled={disabled} onChange={(v) => set("lwfEmployee", v)} />
                  <NumField label="Employer LWF (₹)" step="1" value={form.lwfEmployer} disabled={disabled} onChange={(v) => set("lwfEmployer", v)} />
                </div>
                <div className="mt-5 space-y-2">
                  <Label className="text-[12.5px]">Deduction months</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {MONTHS.map((label, i) => {
                      const m = i + 1;
                      const on = form.lwfMonths.includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          disabled={disabled}
                          aria-pressed={on}
                          onClick={() => toggleMonth(m)}
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
                            on
                              ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                              : "border-border bg-card text-muted-foreground hover:text-foreground",
                            disabled && "cursor-not-allowed opacity-60"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    LWF is deducted only in the selected calendar months.
                  </p>
                </div>
              </Card>
            </TabsContent>

            {/* Gratuity */}
            <TabsContent value="gratuity">
              <Card className="p-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <NumField label="Gratuity days per year" step="1" value={form.gratuityDaysPerYear} disabled={disabled} onChange={(v) => set("gratuityDaysPerYear", v)} />
                  <NumField label="Month divisor (days)" step="1" value={form.gratuityMonthDivisor} disabled={disabled} onChange={(v) => set("gratuityMonthDivisor", v)} help="Monthly wage ÷ this = per-day wage (typically 26)." />
                  <NumField label="Minimum eligible years" step="1" value={form.gratuityMinYears} disabled={disabled} onChange={(v) => set("gratuityMinYears", v)} />
                </div>
              </Card>
            </TabsContent>
          </Tabs>

          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={onSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save configuration
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------ field helpers ------------------------------ */

function NumField({
  label,
  value,
  onChange,
  disabled,
  step = "0.01",
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  step?: string;
  help?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12.5px]">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {help && <p className="text-[11.5px] leading-snug text-muted-foreground">{help}</p>}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12.5px]">{label}</Label>
      <Input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SwitchField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-2.5">
      <Label className="text-[12.5px]">{label}</Label>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

function ToggleTile({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3.5 py-3">
      <span className="text-[13px] font-semibold">{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={`${label} applicable`} />
    </div>
  );
}

/* ------------------------------ PT slab editor ----------------------------- */

function PtSlabsEditor({
  slabs,
  setSlabs,
  disabled,
}: {
  slabs: SlabRow[];
  setSlabs: React.Dispatch<React.SetStateAction<SlabRow[]>>;
  disabled?: boolean;
}) {
  function update(i: number, key: keyof SlabRow, value: string) {
    setSlabs((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  function addRow() {
    setSlabs((rows) => [...rows, { fromSalary: "0", toSalary: "", ptAmount: "0", additionalAmount: "0" }]);
  }
  function removeRow(i: number) {
    setSlabs((rows) => rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-[13px] font-semibold">PT salary slabs</h4>
          <p className="text-[12px] text-muted-foreground">
            Optional per-band rates. Leave the last band&apos;s “To” blank for “and above”. Bands
            must not overlap.
          </p>
        </div>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addRow}>
            <Plus className="size-4" /> Add slab
          </Button>
        )}
      </div>

      {slabs.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-[12.5px] text-muted-foreground">
          No slabs — the flat PT amount above is used.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 px-1 text-[11.5px] font-medium text-muted-foreground sm:grid">
            <span>From (₹)</span>
            <span>To (₹, blank = and above)</span>
            <span>PT amount (₹)</span>
            <span>Additional (₹)</span>
            <span />
          </div>
          {slabs.map((r, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <Input type="number" min={0} step="1" value={r.fromSalary} disabled={disabled} placeholder="From" onChange={(e) => update(i, "fromSalary", e.target.value)} />
              <Input type="number" min={0} step="1" value={r.toSalary} disabled={disabled} placeholder="and above" onChange={(e) => update(i, "toSalary", e.target.value)} />
              <Input type="number" min={0} step="1" value={r.ptAmount} disabled={disabled} placeholder="PT" onChange={(e) => update(i, "ptAmount", e.target.value)} />
              <Input type="number" min={0} step="1" value={r.additionalAmount} disabled={disabled} placeholder="Additional" onChange={(e) => update(i, "additionalAmount", e.target.value)} />
              {!disabled && (
                <Button type="button" variant="ghost" size="icon" className="size-9 text-muted-foreground" onClick={() => removeRow(i)} aria-label="Remove slab">
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
