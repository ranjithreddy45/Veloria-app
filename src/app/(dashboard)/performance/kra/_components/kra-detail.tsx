"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  RefreshCw,
  Save,
  Send,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Check,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Donut } from "@/components/ui/donut";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import {
  KRA_ROLE_LABEL,
  type KraTemplate,
  type KraKpi,
  type KraRole,
} from "@/lib/kra/templates";
import {
  recomputeKraAuto,
  saveKraManualEntries,
  submitKraScorecard,
  acknowledgeKraScorecard,
} from "@/actions/kra.actions";
import { fmtUnit, fmtPeriod, gradeHue, statusHue, STATUS_LABEL } from "./kra-format";

type LineItem = {
  sectionRef: string;
  ref: string;
  name: string;
  source: "AUTO" | "MANUAL";
  maxPoints: number;
  value: string | number | null;
  points: number;
};

type GateReq = {
  key: string;
  label: string;
  unit: "INR" | "COUNT" | "PCT";
  threshold: number;
  value: number | null;
  met: boolean;
};

// The action's DTO types `lineItems`/`gateDetail` as `unknown` and `status` as
// `string`. We accept that loose shape and narrow to these richer types inside.
export type KraScorecardDTO = {
  id: string;
  employeeId: string;
  employeeName: string | null;
  role: string;
  period: string;
  rampMonth: number;
  status: string;
  autoMetrics: Record<string, number | null>;
  manualEntries: Record<string, string | number>;
  lineItems: unknown;
  gateDetail: unknown;
  totalScore: number;
  totalMax: number;
  gatePassed: boolean;
  band: string | null;
  basePct: number;
  multiplierFactor: number | null;
  finalPayoutPct: number;
  managerNote: string | null;
  submittedAt: string | null;
  acknowledgedAt: string | null;
  updatedAt: string;
};

export function KraDetail({
  scorecard,
  template,
  isManager,
  currentUserId,
}: {
  scorecard: KraScorecardDTO;
  template: KraTemplate;
  isManager: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const s = scorecard;
  const lineItems = s.lineItems as LineItem[];
  const gateDetail = s.gateDetail as {
    passed: boolean;
    description: string;
    requirements: GateReq[];
  };
  const editable = isManager && s.status === "DRAFT";

  // KPI lookup by ref (for score spec + notes).
  const kpiByRef = React.useMemo(() => {
    const m = new Map<string, KraKpi>();
    for (const sec of template.sections) for (const k of sec.kpis) m.set(k.ref, k);
    return m;
  }, [template]);

  // Edited manual entries (controlled). Seed from existing entries.
  const [entries, setEntries] = React.useState<Record<string, string | number>>(
    () => ({ ...s.manualEntries }),
  );
  const [note, setNote] = React.useState(s.managerNote ?? "");
  const [busy, setBusy] = React.useState<null | "recompute" | "save" | "submit" | "ack">(null);

  const lineByRef = React.useMemo(() => {
    const m = new Map<string, LineItem>();
    for (const li of lineItems) m.set(li.ref, li);
    return m;
  }, [lineItems]);

  function setEntry(ref: string, value: string | number) {
    setEntries((prev) => ({ ...prev, [ref]: value }));
  }

  async function run(
    kind: "recompute" | "save" | "submit" | "ack",
    fn: () => Promise<{ success: true; data: unknown } | { success: false; error: string }>,
    okMsg: string,
  ) {
    setBusy(kind);
    const res = await fn();
    setBusy(null);
    if (res.success) {
      toast.success(okMsg);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const finalPayoutPctDisplay = Math.round(s.finalPayoutPct * 1000) / 10;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Link
          href="/performance/kra"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All scorecards
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">{s.employeeName ?? "Employee"}</h1>
            <p className="text-sm text-muted-foreground">
              {KRA_ROLE_LABEL[s.role as KraRole] ?? s.role} · {fmtPeriod(s.period)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill label={STATUS_LABEL[s.status] ?? s.status} hue={statusHue(s.status)} />
            {s.rampMonth < 3 && (
              <StatusPill label={`Ramp · month ${s.rampMonth}`} hue="amber" size="sm" />
            )}
          </div>
        </div>
      </div>

      {/* Gate banner */}
      <GateBanner gate={gateDetail} passed={s.gatePassed} />

      {/* Score + band summary */}
      <ScoreSummary
        score={s.totalScore}
        max={s.totalMax}
        band={s.band}
        basePct={s.basePct}
        multiplierFactor={s.multiplierFactor}
        gatePassed={s.gatePassed}
        finalPayoutPctDisplay={finalPayoutPctDisplay}
      />

      {/* Per-section KPI breakdown */}
      <div className="flex flex-col gap-4">
        {template.sections.map((sec) => {
          const items = sec.kpis.map((k) => lineByRef.get(k.ref)).filter(Boolean) as LineItem[];
          const subtotal = items.reduce((a, li) => a + (li.points ?? 0), 0);
          return (
            <Card key={sec.ref}>
              <CardContent className="p-0">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold">
                      {sec.ref}. {sec.title}
                    </h2>
                    <p className="text-meta uppercase tracking-wide text-muted-foreground">
                      {sec.focus}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums text-sm font-medium">
                    {subtotal}/{sec.maxPoints}
                  </span>
                </div>
                <div className="divide-y">
                  {sec.kpis.map((kpi) => (
                    <KpiRow
                      key={kpi.ref}
                      kpi={kpi}
                      line={lineByRef.get(kpi.ref)}
                      autoValue={kpi.autoKey ? s.autoMetrics[kpi.autoKey] : undefined}
                      editable={editable}
                      entryValue={entries[kpi.ref]}
                      onChange={(v) => setEntry(kpi.ref, v)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Manager note + actions */}
      {isManager && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kra-note">Manager note</Label>
              <Textarea
                id="kra-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Context, coaching notes, justification for manual bands…"
                disabled={!editable}
                rows={3}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  run("recompute", () => recomputeKraAuto(s.id), "Auto-metrics recomputed")
                }
                disabled={busy !== null || s.status === "ACKNOWLEDGED"}
              >
                <RefreshCw className={cn("size-4", busy === "recompute" && "animate-spin")} />
                Recompute auto
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  run("save", () => saveKraManualEntries(s.id, entries, note), "Saved")
                }
                disabled={busy !== null || s.status === "ACKNOWLEDGED"}
              >
                <Save className="size-4" /> Save
              </Button>
              {s.status === "DRAFT" && (
                <Button
                  onClick={() =>
                    run("submit", () => submitKraScorecard(s.id), "Submitted to employee")
                  }
                  disabled={busy !== null}
                  className="ml-auto"
                >
                  <Send className="size-4" /> Submit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rep acknowledge */}
      {currentUserId === s.employeeId && s.status === "SUBMITTED" && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-muted-foreground">
              Review your scorecard and acknowledge that you&apos;ve seen it.
            </p>
            <Button
              onClick={() =>
                run("ack", () => acknowledgeKraScorecard(s.id), "Scorecard acknowledged")
              }
              disabled={busy !== null}
            >
              <CheckCircle2 className="size-4" /> Acknowledge
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Read-only manager note for reps */}
      {!isManager && s.managerNote && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Manager note</p>
            <p className="whitespace-pre-wrap text-sm">{s.managerNote}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
function GateBanner({
  gate,
  passed,
}: {
  gate: { passed: boolean; description: string; requirements: GateReq[] };
  passed: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        passed
          ? "border-success/20 bg-success/10"
          : "border-destructive/20 bg-destructive/10",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            passed
              ? "bg-success/15 text-success"
              : "bg-destructive/15 text-destructive",
          )}
        >
          {passed ? <ShieldCheck className="size-5" /> : <ShieldAlert className="size-5" />}
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "text-lg font-bold leading-none",
              passed ? "text-success" : "text-destructive",
            )}
          >
            Incentive gate {passed ? "PASSED" : "NOT MET"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{gate?.description}</p>
        </div>
      </div>
      {gate?.requirements?.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {gate.requirements.map((req) => (
            <li
              key={req.key}
              className="flex items-center justify-between gap-2 rounded-lg bg-background/60 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate text-muted-foreground">{req.label}</span>
              <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                <span className="font-medium">{fmtUnit(req.value, req.unit)}</span>
                <span className="text-muted-foreground">/ {fmtUnit(req.threshold, req.unit)}</span>
                {req.met ? (
                  <Check className="size-4 text-success" />
                ) : (
                  <X className="size-4 text-destructive" />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================
function ScoreSummary({
  score,
  max,
  band,
  basePct,
  multiplierFactor,
  gatePassed,
  finalPayoutPctDisplay,
}: {
  score: number;
  max: number;
  band: string | null;
  basePct: number;
  multiplierFactor: number | null;
  gatePassed: boolean;
  finalPayoutPctDisplay: number;
}) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return (
    <Card>
      <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
        {/* Score ring */}
        <div className="flex items-center gap-4">
          <Donut value={pct} size={72} thickness={7} colorClass="text-primary" label={`${score}`} />
          <div>
            <p className="text-xs text-muted-foreground">Total score</p>
            <p className="text-2xl font-semibold tabular-nums leading-none">
              {score}
              <span className="text-base text-muted-foreground">/{max}</span>
            </p>
          </div>
        </div>

        {/* Band */}
        <div className="flex flex-col justify-center gap-1 sm:border-l sm:pl-4">
          <p className="text-xs text-muted-foreground">Performance band</p>
          <div className="flex items-center gap-2">
            <StatusPill label={band ?? "—"} hue={gradeHue(band)} noDot />
            <span className="text-sm font-medium">{basePct}% base</span>
          </div>
          {typeof multiplierFactor === "number" && (
            <p className="text-xs text-muted-foreground">
              Quality multiplier ×{multiplierFactor.toFixed(2)}
            </p>
          )}
        </div>

        {/* Final payout */}
        <div className="flex flex-col justify-center gap-1 sm:border-l sm:pl-4">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Zap className="size-3.5" /> Final payout (of pool)
          </p>
          {gatePassed ? (
            <p className="text-2xl font-semibold tabular-nums leading-none text-success">
              {finalPayoutPctDisplay}%
            </p>
          ) : (
            <p className="text-sm font-medium text-destructive">0% — gate not met</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
function KpiRow({
  kpi,
  line,
  autoValue,
  editable,
  entryValue,
  onChange,
}: {
  kpi: KraKpi;
  line: LineItem | undefined;
  autoValue: number | null | undefined;
  editable: boolean;
  entryValue: string | number | undefined;
  onChange: (v: string | number) => void;
}) {
  const points = line?.points ?? 0;
  const isAuto = kpi.source === "AUTO";

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {kpi.ref}. {kpi.name}
          </span>
          {isAuto ? (
            <Badge variant="secondary" className="gap-1 text-meta">
              <Zap className="size-2.5" /> AUTO
            </Badge>
          ) : (
            <Badge variant="outline" className="text-meta">
              MANUAL
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{kpi.metric}</p>
        <p className="mt-0.5 text-meta text-muted-foreground">
          Target: <span className="font-medium">{kpi.target}</span>
        </p>
        {kpi.note && <p className="mt-0.5 text-meta italic text-muted-foreground">{kpi.note}</p>}

        {/* Value control / display */}
        <div className="mt-2">
          {isAuto ? (
            <AutoValue value={autoValue} unit={kpi.autoUnit} />
          ) : editable ? (
            <ManualControl kpi={kpi} value={entryValue} onChange={onChange} />
          ) : (
            <ReadonlyManual kpi={kpi} value={line?.value} />
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <span className="tabular-nums text-sm font-semibold">{points}</span>
        <span className="text-xs text-muted-foreground">/{kpi.maxPoints}</span>
      </div>
    </div>
  );
}

function AutoValue({
  value,
  unit,
}: {
  value: number | null | undefined;
  unit?: "INR" | "COUNT" | "PCT";
}) {
  if (value === undefined) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (value === null) {
    return <span className="text-xs text-warning">unavailable</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs">
      <span className="text-muted-foreground">Computed:</span>
      <span className="font-medium tabular-nums">{fmtUnit(value, unit ?? "COUNT")}</span>
    </span>
  );
}

function ManualControl({
  kpi,
  value,
  onChange,
}: {
  kpi: KraKpi;
  value: string | number | undefined;
  onChange: (v: string | number) => void;
}) {
  if (kpi.score.kind === "manualBands") {
    return (
      <Select value={value !== undefined ? String(value) : ""} onValueChange={(v) => onChange(v)}>
        <SelectTrigger className="h-9 w-full max-w-md">
          <SelectValue placeholder="Select band…" />
        </SelectTrigger>
        <SelectContent>
          {kpi.score.bands.map((b) => (
            <SelectItem key={b.value} value={b.value}>
              {b.label} ({b.points} pts)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  // numericTiers → number input
  return (
    <Input
      type="number"
      className="h-9 w-40"
      value={value !== undefined && value !== "" ? String(value) : ""}
      placeholder={kpi.score.unit === "PCT" ? "%" : kpi.score.unit === "INR" ? "₹" : "count"}
      onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
    />
  );
}

function ReadonlyManual({
  kpi,
  value,
}: {
  kpi: KraKpi;
  value: string | number | null | undefined;
}) {
  if (value === undefined || value === null || value === "") {
    return <span className="text-xs text-muted-foreground">Not entered</span>;
  }
  let display = String(value);
  if (kpi.score.kind === "manualBands") {
    const band = kpi.score.bands.find((b) => b.value === String(value));
    if (band) display = band.label;
  } else if (kpi.score.kind === "numericTiers") {
    display = fmtUnit(Number(value), kpi.score.unit);
  }
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium">
      {display}
    </span>
  );
}
