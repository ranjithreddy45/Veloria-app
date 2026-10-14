"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, TriangleAlert, Plus, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  deleteReimbursementRoute,
  setEmployeeFuelCap,
  setReimbursementApprover,
  setReimbursementRoute,
  type getReimbursementApproverConfig,
} from "@/actions/hr-reimbursement.actions";
import { MAX_STAGES, stageLabel, type RouteStage } from "@/lib/hr/claim-chain";
import { FUEL_CAP_STANDARD } from "@/lib/hr/reimbursement";

type Config = Extract<Awaited<ReturnType<typeof getReimbursementApproverConfig>>, { success: true }>["data"];

const NONE = "__none";

function UserPicker({
  value,
  candidates,
  onChange,
  busy,
  placeholder,
  triggerClassName = "w-full sm:w-80",
}: {
  value: string | null;
  candidates: Config["candidates"];
  onChange: (userId: string | null) => void;
  busy: boolean;
  placeholder: string;
  triggerClassName?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={busy}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{placeholder}</SelectItem>
          {candidates.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name ?? c.email} <span className="text-muted-foreground">· {c.role.replaceAll("_", " ")}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

export function ApproverConfigForm({ config }: { config: Config }) {
  const router = useRouter();
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  async function save(level: 1 | 2, scope: string, userId: string | null) {
    const key = `${level}:${scope}`;
    setBusyKey(key);
    const res = await setReimbursementApprover({ level, scope, userId });
    setBusyKey(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Approver saved.");
    router.refresh();
  }

  const unmapped = config.departments.filter((d) => !config.level2ByDepartment[d.id]);

  return (
    <div className="space-y-5">
      <RoutesCard config={config} kind="EMPLOYEE" />
      <RoutesCard config={config} kind="TEAM" />

      <div className="pt-2">
        <h2 className="text-body font-semibold">Default route</h2>
        <p className="text-detail text-muted-foreground">For everyone without a named-person or team route above.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-body">1st approval</CardTitle>
          <CardDescription>Every claim on the default route comes here first for validation.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label className="text-detail">First-level approver</Label>
            <UserPicker
              value={config.level1UserId}
              candidates={config.candidates}
              busy={busyKey === "1:ALL"}
              placeholder="Not set — Super Admins approve"
              onChange={(v) => save(1, "ALL", v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-body">2nd approval, by department</CardTitle>
          <CardDescription>
            Resolved from the employee&apos;s department. A department without its own approver uses the fallback below; with neither set, the claim goes to Finance after first-level approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.departments.length === 0 ? (
            <p className="text-detail text-muted-foreground">No departments yet — add them under People → Settings first.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {config.departments.map((d) => (
                <div key={d.id} className="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-body font-medium">{d.name}</div>
                  <UserPicker
                    value={config.level2ByDepartment[d.id] ?? null}
                    candidates={config.candidates}
                    busy={busyKey === `2:${d.id}`}
                    placeholder="Use fallback"
                    onChange={(v) => save(2, d.id, v)}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-detail">Fallback second-level approver (all other departments)</Label>
            <UserPicker
              value={config.level2Default}
              candidates={config.candidates}
              busy={busyKey === "2:ALL"}
              placeholder="None — skip second level"
              onChange={(v) => save(2, "ALL", v)}
            />
          </div>
          {unmapped.length > 0 && !config.level2Default && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-detail text-warning">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>
                No second-level approver for: {unmapped.map((d) => d.name).join(", ")}. Claims from these departments will reach Finance after first-level approval only.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-body">Final approval · Finance</CardTitle>
          <CardDescription>
            After the earlier approvals the claim waits for Finance&apos;s final approval ({config.financeName}), then appears under Accounting → Reimbursements to be scheduled on a pay run or paid directly and marked Paid.
          </CardDescription>
        </CardHeader>
      </Card>

      <FuelCaps config={config} />
    </div>
  );
}

// ============================================================
// Routes — the fixed approval chains
// ------------------------------------------------------------
// A named-person route is one employee's own claims; a team route is the
// claims of everyone who reports to that person. Order of precedence when a
// claim is submitted: named person → their manager's team → default route.
// Each stage is the claimant's reporting manager, a named login, or Finance.
// ============================================================
type Route = Config["routes"][number];

const MANAGER_KEY = "MANAGER";
const FINANCE_KEY = "FINANCE";
const stageKey = (s: RouteStage) => (s.type === "USER" ? `USER:${s.userId}` : s.type);
function stageFromKey(k: string): RouteStage | null {
  if (k === MANAGER_KEY) return { type: "MANAGER" };
  if (k === FINANCE_KEY) return { type: "FINANCE" };
  if (k.startsWith("USER:") && k.length > 5) return { type: "USER", userId: k.slice(5) };
  return null;
}

function RoutesCard({ config, kind }: { config: Config; kind: "EMPLOYEE" | "TEAM" }) {
  const [adding, setAdding] = React.useState<string[]>([]);
  const routes = config.routes.filter((r) => r.kind === kind);
  const empById = new Map(config.employees.map((e) => [e.id, e]));
  const taken = new Set([...routes.map((r) => r.subjectEmployeeId), ...adding]);
  const addable = config.employees.filter((e) => !taken.has(e.id) && (kind === "EMPLOYEE" || e.reportCount > 0));
  const starter: RouteStage[] = kind === "TEAM" ? [{ type: "MANAGER" }, { type: "FINANCE" }] : [{ type: "FINANCE" }];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-body">{kind === "EMPLOYEE" ? "Named-person routes" : "Team routes"}</CardTitle>
        <CardDescription>
          {kind === "EMPLOYEE"
            ? "A fixed chain for one person's own claims. It wins over every other rule."
            : "A fixed chain for the claims of everyone who reports to a manager (as set on their employee profile). Use “Reporting manager” as the first stage to have the manager approve first."}{" "}
          Changes apply to new and resubmitted claims; claims already in flight keep their route.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {routes.length === 0 && adding.length === 0 ? (
          <p className="text-detail text-muted-foreground">None yet.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {routes.map((r) => (
              <RouteRow key={r.id} config={config} kind={kind} subject={empById.get(r.subjectEmployeeId)} subjectId={r.subjectEmployeeId} route={r} />
            ))}
            {adding.map((id) => (
              <RouteRow
                key={`new-${id}`}
                config={config}
                kind={kind}
                subject={empById.get(id)}
                subjectId={id}
                route={null}
                initial={starter}
                onDiscard={() => setAdding((ids) => ids.filter((x) => x !== id))}
                onSaved={() => setAdding((ids) => ids.filter((x) => x !== id))}
              />
            ))}
          </div>
        )}
        {addable.length > 0 && (
          <Select value="" onValueChange={(id) => id && setAdding((ids) => [...ids, id])}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder={kind === "EMPLOYEE" ? "Add a route for a person…" : "Add a route for a manager's team…"} />
            </SelectTrigger>
            <SelectContent>
              {addable.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} <span className="text-muted-foreground">· {e.empCode}{kind === "TEAM" ? ` · ${e.reportCount} reporting` : ""}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardContent>
    </Card>
  );
}

function RouteRow({
  config, kind, subject, subjectId, route, initial, onDiscard, onSaved,
}: {
  config: Config;
  kind: "EMPLOYEE" | "TEAM";
  subject: Config["employees"][number] | undefined;
  subjectId: string;
  route: Route | null;
  initial?: RouteStage[];
  onDiscard?: () => void;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const saved = route?.stages ?? [];
  const [stages, setStages] = React.useState<(RouteStage | null)[]>(route ? saved : initial ?? []);
  const [busy, setBusy] = React.useState<"save" | "remove" | null>(null);
  React.useEffect(() => { if (route) setStages(route.stages); }, [route]);

  const dirty = !route || JSON.stringify(stages) !== JSON.stringify(saved);
  const complete = stages.length > 0 && stages.every(Boolean);
  const userName = (id: string) => {
    const c = config.candidates.find((x) => x.id === id);
    return c ? c.name ?? c.email : "Unknown login";
  };
  const say = (s: RouteStage | null) =>
    !s ? "—" : s.type === "MANAGER" ? "Reporting manager" : s.type === "FINANCE" ? `Finance (${config.financeName})` : userName(s.userId);

  async function save() {
    if (!complete) { toast.error("Pick an approver for every stage."); return; }
    setBusy("save");
    const res = await setReimbursementRoute({ kind, subjectEmployeeId: subjectId, stages: stages as RouteStage[] });
    setBusy(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Route saved.");
    onSaved?.();
    router.refresh();
  }
  async function remove() {
    if (!route) { onDiscard?.(); return; }
    setBusy("remove");
    const res = await deleteReimbursementRoute(route.id);
    setBusy(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Route removed.");
    router.refresh();
  }

  return (
    <div className="space-y-3 px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-body font-medium">
            {kind === "TEAM" ? `${subject?.name ?? "Unknown"}'s team` : subject?.name ?? "Unknown employee"}
          </div>
          <div className="text-meta text-muted-foreground">
            {subject ? `${subject.empCode}${subject.department ? ` · ${subject.department}` : ""}` : "No longer active"}
            {kind === "TEAM" && subject ? ` · ${subject.reportCount} ${subject.reportCount === 1 ? "person reports" : "people report"} to them` : ""}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 gap-1 text-muted-foreground" disabled={busy !== null} onClick={remove}>
          {busy === "remove" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
          {route ? "Remove" : "Discard"}
        </Button>
      </div>

      <ol className="space-y-2">
        {stages.map((st, i) => (
          <li key={i} className="flex min-w-0 items-center gap-2">
            <span className="w-28 shrink-0 text-detail text-muted-foreground">{stageLabel(i, stages.length)}</span>
            <Select
              value={st ? stageKey(st) : ""}
              onValueChange={(k) => setStages((cur) => cur.map((x, j) => (j === i ? stageFromKey(k) : x)))}
              disabled={busy !== null}
            >
              <SelectTrigger className="w-full min-w-0 sm:w-72">
                <SelectValue placeholder="Pick an approver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MANAGER_KEY}>Reporting manager <span className="text-muted-foreground">· of the person claiming</span></SelectItem>
                <SelectItem value={FINANCE_KEY}>Finance <span className="text-muted-foreground">· {config.financeName}</span></SelectItem>
                {config.candidates.map((c) => (
                  <SelectItem key={c.id} value={`USER:${c.id}`}>
                    {c.name ?? c.email} <span className="text-muted-foreground">· {c.role.replaceAll("_", " ")}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button" variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0 text-muted-foreground"
              aria-label={`Remove ${stageLabel(i, stages.length)}`}
              disabled={busy !== null || stages.length === 1}
              onClick={() => setStages((cur) => cur.filter((_, j) => j !== i))}
            >
              <X className="size-3.5" />
            </Button>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        {stages.length < MAX_STAGES && (
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1" disabled={busy !== null}
            onClick={() => setStages((cur) => [...cur.slice(0, -1), null, ...cur.slice(-1)])}>
            <Plus className="size-3.5" /> Add a stage before the last
          </Button>
        )}
        {dirty && (
          <Button type="button" size="sm" className="h-8" disabled={busy !== null || !complete} onClick={save}>
            {busy === "save" ? <Loader2 className="size-3.5 animate-spin" /> : "Save route"}
          </Button>
        )}
      </div>

      {complete && (
        <p className="flex flex-wrap items-center gap-1 text-meta text-muted-foreground">
          {(stages as RouteStage[]).map((st, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ArrowRight className="size-3" />}
              <span>{say(st)}</span>
            </React.Fragment>
          ))}
          <ArrowRight className="size-3" /> <span>Payment</span>
        </p>
      )}
    </div>
  );
}

// ============================================================
// Fuel caps — a person's monthly limit for fuel claims (blank = no cap).
// ============================================================
function FuelCaps({ config }: { config: Config }) {
  const [added, setAdded] = React.useState<string[]>([]);
  const rows = config.employees.filter((e) => e.fuelMonthlyCap != null || added.includes(e.id));
  const addable = config.employees.filter((e) => !rows.some((r) => r.id === e.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-body">Monthly fuel caps</CardTitle>
        <CardDescription>A fuel claim that would take someone over their monthly cap is refused when they submit it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-detail text-muted-foreground">No caps set.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {rows.map((e) => (
              <div key={e.id} className="grid gap-2 px-3.5 py-3 sm:grid-cols-2 sm:items-end">
                <div className="min-w-0">
                  <div className="text-body font-medium">{e.name}</div>
                  <div className="text-meta text-muted-foreground">{e.empCode}{e.department ? ` · ${e.department}` : ""}</div>
                </div>
                <FuelCapField employeeId={e.id} cap={e.fuelMonthlyCap} />
              </div>
            ))}
          </div>
        )}
        {addable.length > 0 && (
          <Select value="" onValueChange={(id) => id && setAdded((ids) => [...ids, id])}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder="Add a cap for an employee…" />
            </SelectTrigger>
            <SelectContent>
              {addable.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} <span className="text-muted-foreground">· {e.empCode}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardContent>
    </Card>
  );
}

function FuelCapField({ employeeId, cap }: { employeeId: string; cap: number | null }) {
  const router = useRouter();
  const [value, setValue] = React.useState(cap != null ? String(cap) : "");
  const [busy, setBusy] = React.useState(false);
  const dirty = (value.trim() === "" ? null : Number(value)) !== cap;

  async function saveCap(next: number | null) {
    setBusy(true);
    const res = await setEmployeeFuelCap({ employeeId, cap: next });
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(next == null ? "Fuel cap removed." : "Fuel cap saved.");
    router.refresh();
  }

  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={`fuel-${employeeId}`} className="text-detail">Monthly fuel cap (₹)</Label>
      <div className="flex items-center gap-2">
        <Input
          id={`fuel-${employeeId}`}
          type="number"
          inputMode="decimal"
          min={1}
          step="1"
          placeholder="No cap"
          value={value}
          onChange={(ev) => setValue(ev.target.value)}
          className="h-9"
        />
        {cap == null && value.trim() === "" ? (
          <Button type="button" variant="outline" size="sm" disabled={busy}
            onClick={() => { setValue(String(FUEL_CAP_STANDARD)); void saveCap(FUEL_CAP_STANDARD); }}>
            ₹5,500
          </Button>
        ) : (
          <Button type="button" size="sm" disabled={busy || !dirty}
            onClick={() => saveCap(value.trim() === "" ? null : Number(value))}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
          </Button>
        )}
      </div>
    </div>
  );
}
