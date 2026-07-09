"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, CalendarOff, CalendarCheck2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDate } from "@/lib/utils";
import { grantCompOff, redeemCompOff } from "@/actions/hr-compoff.actions";

type CompOffStatus = "AVAILABLE" | "USED" | "EXPIRED";

interface MyItem {
  id: string; workedDate: string; days: number; reason: string | null;
  expiryDate: string | null; status: CompOffStatus; createdAt: string; redeemable: boolean;
}
interface MyData {
  linked: boolean; employeeId?: string;
  items?: MyItem[];
  counts?: { available: number; used: number; expired: number };
}
interface EmpLite { id: string; empCode: string; firstName: string; lastName: string }
interface AdminRow {
  id: string; employee: { id: string; name: string; empCode: string };
  workedDate: string; days: number; reason: string | null; expiryDate: string | null; status: CompOffStatus;
}
interface AdminData { canManage: boolean; employees: EmpLite[]; rows: AdminRow[] }

const STATUS_HUE: Record<CompOffStatus, "emerald" | "slate" | "red"> = {
  AVAILABLE: "emerald",
  USED: "slate",
  EXPIRED: "red",
};
const STATUS_LABEL: Record<CompOffStatus, string> = {
  AVAILABLE: "Available",
  USED: "Used",
  EXPIRED: "Expired",
};

export function CompOffHome({
  mine, admin, canManage,
}: {
  mine: MyData | null; admin: AdminData | null; canManage: boolean;
}) {
  const counts = mine?.counts ?? { available: 0, used: 0, expired: 0 };

  return (
    <div className="space-y-5">
      {/* Summary + grant */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
          <span className="text-muted-foreground">Available <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{counts.available}</span></span>
          <span className="h-3 w-px bg-border" />
          <span className="text-muted-foreground">Used <span className="font-semibold tabular-nums text-foreground">{counts.used}</span></span>
          <span className="h-3 w-px bg-border" />
          <span className="text-muted-foreground">Expired <span className="font-semibold tabular-nums text-foreground">{counts.expired}</span></span>
        </div>
        {canManage && admin && <GrantDialog employees={admin.employees} />}
      </div>

      {/* Balance tiles */}
      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        <BalanceTile label="Available" value={counts.available} hue="emerald" />
        <BalanceTile label="Used" value={counts.used} hue="slate" />
        <BalanceTile label="Expired" value={counts.expired} hue="red" />
      </div>

      {/* My comp-offs */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3 text-[13px] font-semibold">
          <CalendarCheck2 className="size-4 text-[#C9A96E]" /> My comp-offs
        </div>
        {mine && mine.linked === false ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Your account isn’t linked to an employee record yet, so there’s no comp-off balance to show.
          </div>
        ) : !mine || !mine.items || mine.items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <CalendarOff className="mx-auto size-7 text-muted-foreground/40" />
            <p className="mt-2">No comp-offs yet. HR grants one when you work a holiday or weekend.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worked date</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mine.items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-[13px] font-medium">{formatDate(r.workedDate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.days}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{r.reason || "—"}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{r.expiryDate ? formatDate(r.expiryDate) : "—"}</TableCell>
                  <TableCell><StatusPill label={STATUS_LABEL[r.status]} hue={STATUS_HUE[r.status]} size="xs" /></TableCell>
                  <TableCell>{r.redeemable && <RedeemButton id={r.id} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* HR grant history */}
      {canManage && admin && (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3 text-[13px] font-semibold">
            <Gift className="size-4 text-[#C9A96E]" /> Grant history (all employees)
          </div>
          {admin.rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No comp-offs granted yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Worked date</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admin.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-[13px]">
                      <div className="font-medium">{r.employee.name}</div>
                      <div className="text-[12px] text-muted-foreground">{r.employee.empCode}</div>
                    </TableCell>
                    <TableCell className="text-[13px]">{formatDate(r.workedDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.days}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">{r.reason || "—"}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">{r.expiryDate ? formatDate(r.expiryDate) : "—"}</TableCell>
                    <TableCell><StatusPill label={STATUS_LABEL[r.status]} hue={STATUS_HUE[r.status]} size="xs" /></TableCell>
                    <TableCell>{r.status === "AVAILABLE" && <RedeemButton id={r.id} label="Mark used" />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}

function BalanceTile({ label, value, hue }: { label: string; value: number; hue: "emerald" | "slate" | "red" }) {
  const tone =
    hue === "emerald" ? "text-emerald-600 dark:text-emerald-400"
    : hue === "red" ? "text-red-600 dark:text-red-400"
    : "text-foreground";
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card">
      <div className={`text-2xl font-semibold leading-none tabular-nums ${tone}`}>{value}</div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function RedeemButton({ id, label = "Use" }: { id: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline" size="sm" className="h-7 gap-1"
        disabled={busy}
        onClick={async () => {
          setBusy(true); setError(null);
          const res = await redeemCompOff(id);
          setBusy(false);
          if (!res.success) { setError(res.error); return; }
          router.refresh();
        }}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarCheck2 className="size-3.5" />} {label}
      </Button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}

function GrantDialog({ employees }: { employees: EmpLite[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [employeeId, setEmployeeId] = React.useState("");
  const [workedDate, setWorkedDate] = React.useState("");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [reason, setReason] = React.useState("");

  async function submit() {
    setError(null);
    if (!employeeId) { setError("Pick an employee."); return; }
    if (!workedDate) { setError("Pick the worked date."); return; }
    setSaving(true);
    const res = await grantCompOff({
      employeeId, workedDate,
      expiryDate: expiryDate || undefined,
      reason: reason || undefined,
    });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false);
    setEmployeeId(""); setWorkedDate(""); setExpiryDate(""); setReason("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="size-4" /> Grant comp-off</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grant comp-off</DialogTitle>
          <DialogDescription>Bank a comp-off day for an employee who worked a holiday or weekend. Defaults to a 90-day validity.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} · {e.empCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Worked date</Label>
              <Input type="date" value={workedDate} onChange={(e) => setWorkedDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Expires (optional)</Label>
              <Input type="date" value={expiryDate} min={workedDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Diwali event coverage, weekend go-live…" />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Grant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
