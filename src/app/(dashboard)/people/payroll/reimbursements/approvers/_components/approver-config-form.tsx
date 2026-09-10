"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setReimbursementApprover, type getReimbursementApproverConfig } from "@/actions/hr-reimbursement.actions";

type Config = Extract<Awaited<ReturnType<typeof getReimbursementApproverConfig>>, { success: true }>["data"];

const NONE = "__none";

function UserPicker({
  value,
  candidates,
  onChange,
  busy,
  placeholder,
}: {
  value: string | null;
  candidates: Config["candidates"];
  onChange: (userId: string | null) => void;
  busy: boolean;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={busy}>
        <SelectTrigger className="w-full sm:w-80">
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
            Once both approvals are in, the claim appears under Accounting → Reimbursements for users with the Finance role, who schedule it on a pay run or record a direct payment. Finance is notified at that point — never earlier.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
