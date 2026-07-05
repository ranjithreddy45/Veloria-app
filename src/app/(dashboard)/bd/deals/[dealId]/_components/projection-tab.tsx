"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Mail,
  Plus,
  Send,
} from "lucide-react";

import {
  computeProjection,
  validateProjectionInputs,
  PROJECTION_CONST,
  type ProjectionInputs,
  type ProjectionModel,
  type ProjectionGrid,
  type ProjectionConfig,
  type YearRow,
} from "@/lib/acq/projection-calc";
import {
  getAcqProjections,
  getAcqProjectionConfig,
  createAcqProjection,
  updateAcqProjection,
  submitAcqProjection,
  approveAcqProjection,
  rejectAcqProjection,
  sendAcqProjection,
  newAcqProjectionVersion,
} from "@/actions/acq-projection.actions";

import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ============================================================
// Types — serialized projection row (server returns JSON-safe)
// ============================================================
type ProjectionStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SENT"
  | "REJECTED";

interface ProjectionRow {
  id: string;
  version: number;
  modelType: ProjectionModel;
  status: ProjectionStatus;
  inputsJson: unknown;
  outputsJson: unknown | null;
  rejectedReason: string | null;
  sendMethod: string | null;
  sentChannel: string | null;
  sentTo: string | null;
  sentAt: string | null;
  createdAt: string;
  submittedBy?: { name: string | null } | null;
  approvedBy?: { name: string | null } | null;
  sentBy?: { name: string | null } | null;
}

// ============================================================
// Helpers
// ============================================================
const STATUS_HUE: Record<ProjectionStatus, Parameters<typeof StatusPill>[0]["hue"]> = {
  DRAFT: "slate",
  PENDING_APPROVAL: "amber",
  APPROVED: "emerald",
  SENT: "blue",
  REJECTED: "rose",
};

const STATUS_LABEL: Record<ProjectionStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  SENT: "Sent",
  REJECTED: "Rejected",
};

const HALL_CHARGE_DEFAULT = 6999;
const HOURS_PER_EVENT_DEFAULT = 4;
const BEST_CASE_UPLIFT_DEFAULT = 100;

function fmtMoney(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}
function fmtEvents(n: number): string {
  return n.toFixed(1);
}
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function canApprove(role?: string): boolean {
  return role === "BD_HEAD" || role === "ADMIN" || role === "SUPER_ADMIN";
}

// Coerce a serialized inputsJson blob into a usable ProjectionInputs.
function asInputs(raw: unknown): ProjectionInputs {
  const o = (raw ?? {}) as Record<string, unknown>;
  const n = (v: unknown): number => (typeof v === "number" ? v : Number(v));
  return {
    banquetSizeSft: n(o.banquetSizeSft),
    seatingCapacity: n(o.seatingCapacity),
    eventsBaseCase: n(o.eventsBaseCase),
    eventsBestCase: n(o.eventsBestCase),
    hourlyHallCharge: o.hourlyHallCharge != null ? n(o.hourlyHallCharge) : undefined,
    hoursPerEvent: o.hoursPerEvent != null ? n(o.hoursPerEvent) : undefined,
    perPlateCharge: o.perPlateCharge != null ? n(o.perPlateCharge) : undefined,
    bestCasePlateUplift: o.bestCasePlateUplift != null ? n(o.bestCasePlateUplift) : undefined,
  };
}

// Resolve a grid for read-only views: prefer the frozen snapshot, else compute
// (using the DB-resolved config so a non-snapshot preview matches the server).
function resolveGrid(row: ProjectionRow, cfg: ProjectionConfig = PROJECTION_CONST): ProjectionGrid {
  if (row.outputsJson) {
    return row.outputsJson as ProjectionGrid;
  }
  return computeProjection(row.modelType, asInputs(row.inputsJson), cfg);
}

function y1NetReturn(row: ProjectionRow, cfg: ProjectionConfig = PROJECTION_CONST): number | null {
  try {
    const grid = resolveGrid(row, cfg);
    return grid.base[0]?.netOwnerReturn ?? null;
  } catch {
    return null;
  }
}

function pdfUrl(id: string): string {
  return `/api/bd/projections/${id}/pdf`;
}

// ============================================================
// Grid table
// ============================================================
interface GridRowDef {
  label: string;
  emphasize?: boolean;
  value: (r: YearRow) => string;
}

function GridTable({
  title,
  rows,
  withFood,
}: {
  title: string;
  rows: YearRow[];
  withFood: boolean;
}) {
  const defs: GridRowDef[] = [
    { label: "No. of Events / Month", value: (r) => fmtEvents(r.events) },
    ...(withFood
      ? [
          {
            label: "Per Plate Charges",
            value: (r: YearRow) => (r.perPlate != null ? fmtMoney(r.perPlate) : "—"),
          },
        ]
      : []),
    { label: "Revenue Per Event", value: (r) => fmtMoney(r.revPerEvent) },
    { label: "Total Revenue", value: (r) => fmtMoney(r.totalRevenue) },
    { label: "Total Operating Expense", value: (r) => fmtMoney(r.opex) },
    { label: "GOP", value: (r) => fmtMoney(r.gop) },
    { label: "Base Fee (5%)", value: (r) => fmtMoney(r.baseFee) },
    { label: "Incentive Fee (20%)", value: (r) => fmtMoney(r.incentiveFee) },
    { label: "Total Management Fee", value: (r) => fmtMoney(r.mgmtFee) },
    {
      label: "Net Owner's Return",
      emphasize: true,
      value: (r) => fmtMoney(r.netOwnerReturn),
    },
    {
      label: "Owner's Return %",
      emphasize: true,
      value: (r) => fmtPct(r.ownerReturnPct),
    },
  ];

  return (
    <div className="space-y-2">
      <h4 className="text-[12.5px] font-medium text-foreground">{title}</h4>
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full min-w-[520px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Metric</th>
              {rows.map((r) => (
                <th
                  key={r.year}
                  className="px-3 py-2 text-right font-medium text-muted-foreground"
                >
                  Year {r.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {defs.map((d) => (
              <tr
                key={d.label}
                className={
                  d.emphasize
                    ? "border-b border-border/60 bg-emerald-50/40"
                    : "border-b border-border/40"
                }
              >
                <td
                  className={
                    d.emphasize
                      ? "px-3 py-1.5 font-semibold text-foreground"
                      : "px-3 py-1.5 text-muted-foreground"
                  }
                >
                  {d.label}
                </td>
                {rows.map((r) => (
                  <td
                    key={r.year}
                    className={
                      d.emphasize
                        ? "px-3 py-1.5 text-right font-semibold text-foreground"
                        : "px-3 py-1.5 text-right text-foreground"
                    }
                  >
                    {d.value(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectionGridView({ grid }: { grid: ProjectionGrid }) {
  const withFood = grid.modelType === "WITH_FOOD";
  return (
    <div className="space-y-5">
      <GridTable title="Base Case" rows={grid.base} withFood={withFood} />
      <GridTable title="Best Case" rows={grid.best} withFood={withFood} />
      <p className="rounded-md border border-border/60 bg-muted/30 p-2.5 text-[11.5px] text-muted-foreground">
        {withFood
          ? "Includes food revenue; owner supplies catering."
          : "Food, décor & marketing managed by Billion Events — not reflected in owner economics."}
      </p>
    </div>
  );
}

// ============================================================
// Main component
// ============================================================
type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "open"; row: ProjectionRow };

export function ProjectionTab({
  dealId,
  userRole,
}: {
  dealId: string;
  userRole?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProjectionRow[]>([]);
  const [view, setView] = useState<View>({ kind: "list" });
  // DB-tunable assumptions; defaults equal the oracle until loaded.
  const [cfg, setCfg] = useState<ProjectionConfig>(PROJECTION_CONST);

  useEffect(() => {
    let active = true;
    getAcqProjectionConfig()
      .then((c) => { if (active && c) setCfg(c); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const refresh = useCallback(async (): Promise<ProjectionRow[]> => {
    const res = await getAcqProjections(dealId);
    if (res.success) {
      const data = res.data as ProjectionRow[];
      setRows(data);
      return data;
    }
    toast.error(res.error);
    return [];
  }, [dealId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getAcqProjections(dealId)
      .then((res) => {
        if (!active) return;
        if (res.success) setRows(res.data as ProjectionRow[]);
        else toast.error(res.error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dealId]);

  // Re-fetch then re-sync the currently open row (so status badges update).
  const reloadAndStay = useCallback(
    async (openId?: string) => {
      const data = await refresh();
      if (openId) {
        const found = data.find((r) => r.id === openId);
        if (found) setView({ kind: "open", row: found });
        else setView({ kind: "list" });
      }
    },
    [refresh]
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading projections…
        </CardContent>
      </Card>
    );
  }

  if (view.kind === "create") {
    return (
      <Builder
        dealId={dealId}
        existing={null}
        cfg={cfg}
        onBack={() => setView({ kind: "list" })}
        onSaved={(id) => reloadAndStay(id)}
      />
    );
  }

  if (view.kind === "open") {
    return (
      <OpenProjection
        row={view.row}
        dealId={dealId}
        userRole={userRole}
        cfg={cfg}
        onBack={() => reloadAndStay()}
        onReload={(id) => reloadAndStay(id ?? view.row.id)}
      />
    );
  }

  // list / empty
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-[13px] tracking-[-0.01em]">Owner Projection</CardTitle>
            <CardDescription>3-year indicative revenue projection.</CardDescription>
          </div>
          {rows.length > 0 && (
            <Button size="sm" onClick={() => setView({ kind: "create" })}>
              <Plus className="size-3.5" /> Create Projection
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-[13px] text-muted-foreground">No projection yet.</p>
            <Button size="sm" onClick={() => setView({ kind: "create" })}>
              <Plus className="size-3.5" /> Create Projection
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const net = y1NetReturn(row, cfg);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setView({ kind: "open", row })}
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-[13px] font-medium text-foreground">
                        v{row.version}
                      </span>
                      <StatusPill
                        label={row.modelType === "WITH_FOOD" ? "With Food" : "Hall-Only"}
                        hue={row.modelType === "WITH_FOOD" ? "violet" : "cyan"}
                        size="xs"
                      />
                      <StatusPill
                        label={STATUS_LABEL[row.status]}
                        hue={STATUS_HUE[row.status]}
                        size="xs"
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-[11.5px] text-muted-foreground">
                      {net != null && (
                        <span className="text-foreground">
                          Y1 net {fmtMoney(net)}
                        </span>
                      )}
                      <span>
                        {row.sentAt
                          ? `Sent ${fmtDate(row.sentAt)}`
                          : `Created ${fmtDate(row.createdAt)}`}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Builder (create or edit DRAFT)
// ============================================================
interface FormState {
  seatingCapacity: string;
  banquetSizeSft: string;
  eventsBaseCase: string;
  eventsBestCase: string;
  hourlyHallCharge: string;
  hoursPerEvent: string;
  perPlateCharge: string;
  bestCasePlateUplift: string;
}

function emptyForm(model: ProjectionModel): FormState {
  return {
    seatingCapacity: "",
    banquetSizeSft: "",
    eventsBaseCase: "",
    eventsBestCase: "",
    hourlyHallCharge: model === "WITHOUT_FOOD" ? String(HALL_CHARGE_DEFAULT) : "",
    hoursPerEvent: model === "WITHOUT_FOOD" ? String(HOURS_PER_EVENT_DEFAULT) : "",
    perPlateCharge: "",
    bestCasePlateUplift: model === "WITH_FOOD" ? String(BEST_CASE_UPLIFT_DEFAULT) : "",
  };
}

function formFromInputs(raw: unknown): FormState {
  const i = asInputs(raw);
  const s = (v: number | undefined): string =>
    v == null || Number.isNaN(v) ? "" : String(v);
  return {
    seatingCapacity: s(i.seatingCapacity),
    banquetSizeSft: s(i.banquetSizeSft),
    eventsBaseCase: s(i.eventsBaseCase),
    eventsBestCase: s(i.eventsBestCase),
    hourlyHallCharge: s(i.hourlyHallCharge),
    hoursPerEvent: s(i.hoursPerEvent),
    perPlateCharge: s(i.perPlateCharge),
    bestCasePlateUplift: s(i.bestCasePlateUplift),
  };
}

function toInputs(model: ProjectionModel, f: FormState): ProjectionInputs {
  const n = (v: string): number => (v.trim() === "" ? NaN : Number(v));
  const base: ProjectionInputs = {
    seatingCapacity: n(f.seatingCapacity),
    banquetSizeSft: n(f.banquetSizeSft),
    eventsBaseCase: n(f.eventsBaseCase),
    eventsBestCase: n(f.eventsBestCase),
  };
  if (model === "WITHOUT_FOOD") {
    base.hourlyHallCharge = n(f.hourlyHallCharge);
    base.hoursPerEvent = n(f.hoursPerEvent);
  } else {
    base.perPlateCharge = n(f.perPlateCharge);
    if (f.bestCasePlateUplift.trim() !== "") {
      base.bestCasePlateUplift = n(f.bestCasePlateUplift);
    }
  }
  return base;
}

function Builder({
  dealId,
  existing,
  cfg = PROJECTION_CONST,
  onBack,
  onSaved,
}: {
  dealId: string;
  existing: ProjectionRow | null;
  cfg?: ProjectionConfig;
  onBack: () => void;
  onSaved: (id: string) => void;
}) {
  const [model, setModel] = useState<ProjectionModel>(
    existing?.modelType ?? "WITHOUT_FOOD"
  );
  const [form, setForm] = useState<FormState>(() =>
    existing ? formFromInputs(existing.inputsJson) : emptyForm("WITHOUT_FOOD")
  );
  const [dirty, setDirty] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(existing?.id ?? null);

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const onModelChange = (on: boolean) => {
    const next: ProjectionModel = on ? "WITH_FOOD" : "WITHOUT_FOOD";
    setModel(next);
    // Re-seed model-specific defaults while keeping shared values.
    setForm((f) => ({
      ...f,
      hourlyHallCharge:
        next === "WITHOUT_FOOD"
          ? f.hourlyHallCharge || String(HALL_CHARGE_DEFAULT)
          : f.hourlyHallCharge,
      hoursPerEvent:
        next === "WITHOUT_FOOD"
          ? f.hoursPerEvent || String(HOURS_PER_EVENT_DEFAULT)
          : f.hoursPerEvent,
      bestCasePlateUplift:
        next === "WITH_FOOD"
          ? f.bestCasePlateUplift || String(BEST_CASE_UPLIFT_DEFAULT)
          : f.bestCasePlateUplift,
    }));
    setDirty(true);
  };

  const inputs = useMemo(() => toInputs(model, form), [model, form]);
  const errors = useMemo(
    () => validateProjectionInputs(model, inputs),
    [model, inputs]
  );
  const valid = errors.length === 0;
  const grid = useMemo(
    () => (valid ? computeProjection(model, inputs, cfg) : null),
    [valid, model, inputs, cfg]
  );

  const busy = savingDraft || submitting;

  // Persist current form. Returns the row id (creates if new), or null on failure.
  async function persist(): Promise<string | null> {
    if (savedId) {
      const res = await updateAcqProjection(savedId, inputs);
      if (!res.success) {
        toast.error(res.error);
        return null;
      }
      return savedId;
    }
    const res = await createAcqProjection(dealId, model, inputs);
    if (!res.success) {
      toast.error(res.error);
      return null;
    }
    const id = res.data?.id ?? null;
    if (id) setSavedId(id);
    return id;
  }

  async function saveDraft() {
    if (!valid) return;
    setSavingDraft(true);
    const id = await persist();
    setSavingDraft(false);
    if (!id) return;
    setDirty(false);
    toast.success("Draft saved");
    onSaved(id);
  }

  async function submit() {
    if (!valid) return;
    setSubmitting(true);
    let id = savedId;
    if (!id || dirty) {
      id = await persist();
      if (!id) {
        setSubmitting(false);
        return;
      }
      setDirty(false);
    }
    const res = await submitAcqProjection(id);
    setSubmitting(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Submitted for approval");
    onSaved(id);
  }

  const isDraftEdit = existing != null;

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={onBack}
          className="mb-1 flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to versions
        </button>
        <CardTitle className="text-[13px] tracking-[-0.01em]">
          {isDraftEdit ? `Edit Projection v${existing?.version}` : "New Projection"}
        </CardTitle>
        <CardDescription>
          Live 3-year preview matches the approved PDF exactly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isDraftEdit && existing?.rejectedReason && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[12.5px] text-amber-800">
            Returned by BD Head: {existing.rejectedReason}
          </div>
        )}

        <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
          <div className="space-y-0.5">
            <Label className="text-[13px]">Owner has in-house restaurant?</Label>
            <p className="text-[11.5px] text-muted-foreground">
              On = With Food model · Off = Hall-Only
            </p>
          </div>
          <Switch checked={model === "WITH_FOOD"} onCheckedChange={onModelChange} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumField
            label="Seating capacity"
            value={form.seatingCapacity}
            onChange={(v) => set("seatingCapacity", v)}
          />
          <NumField
            label="Banquet size (sft)"
            value={form.banquetSizeSft}
            onChange={(v) => set("banquetSizeSft", v)}
          />
          <NumField
            label="Events / month (base case)"
            value={form.eventsBaseCase}
            onChange={(v) => set("eventsBaseCase", v)}
          />
          <NumField
            label="Events / month (best case)"
            value={form.eventsBestCase}
            onChange={(v) => set("eventsBestCase", v)}
          />
          {model === "WITHOUT_FOOD" ? (
            <>
              <NumField
                label="Hourly hall charge"
                value={form.hourlyHallCharge}
                onChange={(v) => set("hourlyHallCharge", v)}
              />
              <NumField
                label="Hours per event"
                value={form.hoursPerEvent}
                onChange={(v) => set("hoursPerEvent", v)}
              />
            </>
          ) : (
            <>
              <NumField
                label="Per-plate charge"
                value={form.perPlateCharge}
                onChange={(v) => set("perPlateCharge", v)}
              />
              <NumField
                label="Best-case plate uplift"
                value={form.bestCasePlateUplift}
                onChange={(v) => set("bestCasePlateUplift", v)}
              />
            </>
          )}
        </div>

        {!valid && (
          <ul className="space-y-1 rounded-md border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700">
            {errors.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        )}

        {grid && <ProjectionGridView grid={grid} />}

        <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-4">
          <Button variant="outline" size="sm" onClick={saveDraft} disabled={!valid || busy}>
            {savingDraft && <Loader2 className="size-3.5 animate-spin" />}
            Save Draft
          </Button>
          <Button size="sm" onClick={submit} disabled={!valid || busy}>
            {submitting && <Loader2 className="size-3.5 animate-spin" />}
            Submit for Approval
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ============================================================
// Open projection — routes by status
// ============================================================
function OpenProjection({
  row,
  dealId,
  userRole,
  cfg = PROJECTION_CONST,
  onBack,
  onReload,
}: {
  row: ProjectionRow;
  dealId: string;
  userRole?: string;
  cfg?: ProjectionConfig;
  onBack: () => void;
  onReload: (id?: string) => void;
}) {
  if (row.status === "DRAFT") {
    return (
      <Builder
        dealId={dealId}
        existing={row}
        cfg={cfg}
        onBack={onBack}
        onSaved={(id) => onReload(id)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={onBack}
          className="mb-1 flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to versions
        </button>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-[13px] tracking-[-0.01em]">Projection v{row.version}</CardTitle>
            <StatusPill
              label={row.modelType === "WITH_FOOD" ? "With Food" : "Hall-Only"}
              hue={row.modelType === "WITH_FOOD" ? "violet" : "cyan"}
              size="xs"
            />
            <StatusPill
              label={STATUS_LABEL[row.status]}
              hue={STATUS_HUE[row.status]}
              size="xs"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <ProjectionGridView grid={resolveGrid(row, cfg)} />

        {row.status === "PENDING_APPROVAL" && (
          <PendingActions row={row} userRole={userRole} onReload={onReload} />
        )}
        {row.status === "APPROVED" && (
          <ApprovedActions row={row} onReload={onReload} />
        )}
        {row.status === "SENT" && <SentActions row={row} onReload={onReload} />}
      </CardContent>
    </Card>
  );
}

// ---- PENDING_APPROVAL ----
function PendingActions({
  row,
  userRole,
  onReload,
}: {
  row: ProjectionRow;
  userRole?: string;
  onReload: (id?: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function approve() {
    setBusy(true);
    const res = await approveAcqProjection(row.id);
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Projection approved");
    onReload(row.id);
  }

  async function reject() {
    if (!reason.trim()) {
      toast.error("A rejection comment is required.");
      return;
    }
    setBusy(true);
    const res = await rejectAcqProjection(row.id, reason.trim());
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setRejectOpen(false);
    setReason("");
    toast.success("Returned to BD for changes");
    onReload(row.id);
  }

  if (!canApprove(userRole)) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[12.5px] text-amber-800">
        Awaiting BD Head approval.
      </p>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setRejectOpen(true)}
        disabled={busy}
      >
        Reject
      </Button>
      <Button size="sm" onClick={approve} disabled={busy}>
        {busy && <Loader2 className="size-3.5 animate-spin" />}
        Approve
      </Button>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject projection</DialogTitle>
            <DialogDescription>
              A comment is required so the BD knows what to change.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Comment</Label>
            <Input
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What needs to change?"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={reject}
              disabled={busy || !reason.trim()}
            >
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- APPROVED ----
function ApprovedActions({
  row,
  onReload,
}: {
  row: ProjectionRow;
  onReload: (id?: string) => void;
}) {
  const [sendOpen, setSendOpen] = useState(false);
  const [versioning, setVersioning] = useState(false);

  async function newVersion() {
    setVersioning(true);
    const res = await newAcqProjectionVersion(row.id);
    setVersioning(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("New draft version created");
    onReload(res.data?.id);
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open(pdfUrl(row.id), "_blank")}
      >
        <FileText className="size-3.5" /> View PDF
      </Button>
      <Button variant="outline" size="sm" onClick={newVersion} disabled={versioning}>
        {versioning && <Loader2 className="size-3.5 animate-spin" />}
        New Version
      </Button>
      <Button size="sm" onClick={() => setSendOpen(true)}>
        <Send className="size-3.5" /> Send to Owner
      </Button>

      <SendDialog
        row={row}
        open={sendOpen}
        onOpenChange={setSendOpen}
        onSent={() => onReload(row.id)}
      />
    </div>
  );
}

function SendDialog({
  row,
  open,
  onOpenChange,
  onSent,
}: {
  row: ProjectionRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent: () => void;
}) {
  const [mode, setMode] = useState<"EMAIL_APP" | "MANUAL_DOWNLOAD">("EMAIL_APP");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState("WhatsApp");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    if (mode === "MANUAL_DOWNLOAD") {
      window.open(pdfUrl(row.id), "_blank");
    }
    const res = await sendAcqProjection(
      row.id,
      mode === "EMAIL_APP"
        ? {
            method: "EMAIL_APP",
            to: to.trim() || undefined,
            subject: subject.trim() || undefined,
            body: body.trim() || undefined,
          }
        : { method: "MANUAL_DOWNLOAD", channel }
    );
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    onOpenChange(false);
    toast.success("Projection sent");
    onSent();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send projection to owner</DialogTitle>
          <DialogDescription>
            Email it from the app, or download &amp; mark as sent manually.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as "EMAIL_APP" | "MANUAL_DOWNLOAD")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMAIL_APP">Email from app</SelectItem>
                <SelectItem value="MANUAL_DOWNLOAD">Download &amp; mark sent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "EMAIL_APP" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="send-to">To</Label>
                <Input
                  id="send-to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="Owner email (defaults to lead email)"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="send-subject">Subject</Label>
                <Input
                  id="send-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="(optional — a default is used)"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="send-body">Body</Label>
                <Input
                  id="send-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="(optional — a default is used)"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="in-person">In-person</SelectItem>
                  <SelectItem value="email">Email (manual)</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <Download className="size-3.5" /> The PDF opens in a new tab when you confirm.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={send} disabled={busy}>
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : mode === "EMAIL_APP" ? (
              <Mail className="size-3.5" />
            ) : (
              <Download className="size-3.5" />
            )}
            {mode === "EMAIL_APP" ? "Send email" : "Mark sent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- SENT ----
function SentActions({
  row,
  onReload,
}: {
  row: ProjectionRow;
  onReload: (id?: string) => void;
}) {
  const [versioning, setVersioning] = useState(false);

  async function newVersion() {
    setVersioning(true);
    const res = await newAcqProjectionVersion(row.id);
    setVersioning(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("New draft version created");
    onReload(res.data?.id);
  }

  const sendBits = [
    row.sendMethod === "EMAIL_APP" ? "Emailed" : "Downloaded / manual",
    row.sentChannel,
    row.sentTo,
    fmtDate(row.sentAt),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <CheckCircle2 className="size-3.5 text-emerald-600" /> Sent: {sendBits}
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(pdfUrl(row.id), "_blank")}
        >
          <FileText className="size-3.5" /> View PDF
        </Button>
        <Button variant="outline" size="sm" onClick={newVersion} disabled={versioning}>
          {versioning && <Loader2 className="size-3.5 animate-spin" />}
          New Version
        </Button>
      </div>
    </div>
  );
}
