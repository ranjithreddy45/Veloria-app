"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Link2Off, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getLinkableUsers, linkEmployeeUser, unlinkEmployeeUser, type LinkableUser,
} from "@/actions/hr-employee.actions";

// ============================================================
// Login ↔ employee link panel.
// Employee.userId is what every self-service surface resolves on — attendance,
// leave, payslips, help desk. Until it's set the employee is told "your account
// isn't linked to an employee record yet". Only hr:admin may change it.
// ============================================================

interface Props {
  employeeId: string;
  employeeName: string;
  linkedUser: { id: string; email: string; role: string; isActive: boolean } | null;
  canAdmin: boolean;
}

export function EmployeeUserLink({ employeeId, employeeName, linkedUser, canAdmin }: Props) {
  const router = useRouter();
  const [users, setUsers] = React.useState<LinkableUser[] | null>(null);
  const [picked, setPicked] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (canAdmin && !linkedUser && users === null) {
      getLinkableUsers(employeeId).then(setUsers).catch(() => setUsers([]));
    }
  }, [canAdmin, linkedUser, users, employeeId]);

  async function doLink() {
    if (!picked) { toast.error("Pick a login to link."); return; }
    setBusy(true);
    try {
      const res = await linkEmployeeUser(employeeId, picked);
      if (!res.success) { toast.error(res.error); return; }
      toast.success(`Login linked — ${employeeName} can now use self-service.`);
      router.refresh();
    } finally { setBusy(false); }
  }

  async function doUnlink() {
    setBusy(true);
    try {
      const res = await unlinkEmployeeUser(employeeId);
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Login unlinked. Self-service access removed.");
      setUsers(null);
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <Card className="gap-0 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/12 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300">
          <ShieldCheck className="size-4" />
        </span>
        <div>
          <p className="text-[13px] font-semibold">Login account</p>
          <p className="text-[11.5px] text-muted-foreground">
            Required for attendance, leave, payslips and the help desk.
          </p>
        </div>
      </div>

      {linkedUser ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{linkedUser.email}</p>
            <p className="text-[11.5px] text-muted-foreground">
              {linkedUser.role}
              {!linkedUser.isActive && " · deactivated"}
            </p>
          </div>
          {canAdmin && (
            <Button variant="outline" size="sm" onClick={doUnlink} disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Link2Off className="size-3.5" />} Unlink
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-[12px] text-warning">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>No login linked — this employee can&rsquo;t check in, apply for leave, or see payslips.</span>
          </div>

          {canAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={picked} onValueChange={setPicked}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder={users === null ? "Loading logins…" : "Select a login account"} />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.email}
                      {u.name ? ` — ${u.name}` : ""}
                    </SelectItem>
                  ))}
                  {users !== null && users.length === 0 && (
                    <div className="px-2 py-1.5 text-[12px] text-muted-foreground">
                      No unlinked active logins available.
                    </div>
                  )}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={doLink} disabled={busy || !picked} className="gap-1.5">
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />} Link login
              </Button>
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground">Ask an HR admin to link this employee&rsquo;s login.</p>
          )}
        </div>
      )}
    </Card>
  );
}
