"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, TriangleAlert, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  clearEmployeeRoute,
  setEmployeeFuelCap,
  setReimbursementApprover,
  type getReimbursementApproverConfig,
} from "@/actions/hr-reimbursement.actions";
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

  async function save(level: 1 | 2 | 3, scope: string, userId: string | null) {
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
      <Card>
        <CardHeader>
          <CardTitle className="text-body">Step 2 · First-level approval</CardTitle>
          <CardDescription>Every claim, from every team, comes here first for validation.</CardDescription>
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
          <CardTitle className="text-body">Step 3 · Second-level approval, by department</CardTitle>
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
          <CardTitle className="text-body">Step 4 · Finance</CardTitle>
          <CardDescription>
            After the first two approvals the claim waits for Finance&apos;s final approval ({config.financeName}), then appears under Accounting → Reimbursements to be scheduled on a pay run or paid directly and marked Paid. Finance is notified at that point — never earlier.
          </CardDescription>
        </CardHeader>
      </Card>

      <EmployeeRoutes config={config} busyKey={busyKey} save={save} />
    </div>
  );
}

// ============================================================
// Per-employee routes and fuel caps
// ------------------------------------------------------------
// A route fixes one person's approval chain regardless of department; any
// level left on "Default" follows the rules above. The fuel cap is that
// person's monthly limit for fuel claims (blank = no cap).
// ============================================================
function EmployeeRoutes({
  config,
  busyKey,
  save,
}: {
  config: Config;
  busyKey: string | null;
  save: (level: 1 | 2 | 3, scope: string, userId: string | null) => Promise<void>;
}) {
  const router = useRouter();
  const [added, setAdded] = React.useState<string[]>([]);
  const [removing, setRemoving] = React.useState<string | null>(null);
  const routeById = new Map(config.employeeRoutes.map((r) => [r.employeeId, r]));
  const rows = config.employees.filter(
    (e) => routeById.has(e.id) || e.fuelMonthlyCap != null || added.includes(e.id),
  );
  const addable = config.employees.filter((e) => !rows.some((r) => r.id === e.id));

  async function remove(employeeId: string) {
    setRemoving(employeeId);
    const [a, b] = await Promise.all([
      clearEmployeeRoute(employeeId),
      setEmployeeFuelCap({ employeeId, cap: null }),
    ]);
    setRemoving(null);
    if (!a.success) { toast.error(a.error); return; }
    if (!b.success) { toast.error(b.error); return; }
    setAdded((ids) => ids.filter((id) => id !== employeeId));
    toast.success("Back on the default rules.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-body">Per-employee routes &amp; fuel caps</CardTitle>
        <CardDescription>
          For named people whose claims follow a fixed chain, and who have a monthly fuel limit. A level left on
          &ldquo;Default&rdquo; uses the rules above.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-detail text-muted-foreground">No per-employee rules yet.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {rows.map((e) => {
              const route = routeById.get(e.id);
              const scope = `EMP:${e.id}`;
              return (
                <div key={e.id} className="space-y-3 px-3.5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-body font-medium">{e.name}</div>
                      <div className="text-meta text-muted-foreground">
                        {e.empCode}{e.department ? ` · ${e.department}` : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 gap-1 text-muted-foreground"
                      disabled={removing === e.id}
                      onClick={() => remove(e.id)}
                    >
                      {removing === e.id ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                      Remove
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0 space-y-1.5">
                      <Label className="text-detail">1st approval</Label>
                      <UserPicker
                        value={route?.level1UserId ?? null}
                        candidates={config.candidates}
                        busy={busyKey === `1:${scope}`}
                        placeholder="Default"
                        triggerClassName="w-full"
                        onChange={(v) => save(1, scope, v)}
                      />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <Label className="text-detail">2nd approval</Label>
                      <UserPicker
                        value={route?.level2UserId ?? null}
                        candidates={config.candidates}
                        busy={busyKey === `2:${scope}`}
                        placeholder="Default"
                        triggerClassName="w-full"
                        onChange={(v) => save(2, scope, v)}
                      />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <Label className="text-detail">Final approval</Label>
                      <UserPicker
                        value={route?.level3UserId ?? null}
                        candidates={config.candidates}
                        busy={busyKey === `3:${scope}`}
                        placeholder={`Default — Finance (${config.financeName})`}
                        triggerClassName="w-full"
                        onChange={(v) => save(3, scope, v)}
                      />
                    </div>
                    <FuelCapField employeeId={e.id} cap={e.fuelMonthlyCap} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {addable.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value="" onValueChange={(id) => id && setAdded((ids) => [...ids, id])}>
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder="Add an employee…" />
              </SelectTrigger>
              <SelectContent>
                {addable.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} <span className="text-muted-foreground">· {e.empCode}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="inline-flex items-center gap-1 text-meta text-muted-foreground">
              <Plus className="size-3" /> then pick their approvers or set a fuel cap
            </span>
          </div>
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
