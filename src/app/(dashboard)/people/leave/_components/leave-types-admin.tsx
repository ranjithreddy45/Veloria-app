"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createLeaveType, updateLeaveType, setLeaveTypeActive, type LeaveTypeInput,
} from "@/actions/hr-leave.actions";

export interface LeaveTypeRow {
  id: string;
  name: string;
  code: string;
  paid: boolean;
  accrualPerYear: number;
  carryForwardMax: number;
  allowHalfDay: boolean;
  allowNegative: boolean;
  requiresApproval: boolean;
  color: string;
  isActive: boolean;
  order: number;
}

// StatusPill hues available as leave-type colours (client-only constant).
const COLOR_OPTIONS = [
  "blue", "indigo", "violet", "emerald", "teal", "cyan",
  "amber", "orange", "rose", "pink", "slate",
] as const;

const SWATCH: Record<string, string> = {
  blue: "bg-blue-500", indigo: "bg-indigo-500", violet: "bg-violet-500",
  emerald: "bg-emerald-500", teal: "bg-teal-500", cyan: "bg-cyan-500",
  amber: "bg-amber-500", orange: "bg-orange-500", rose: "bg-rose-500",
  pink: "bg-pink-500", slate: "bg-slate-500",
};

export function LeaveTypesAdmin({ types }: { types: LeaveTypeRow[] }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-copy font-semibold">Leave catalogue</h3>
          <p className="text-detail text-muted-foreground">
            {types.length} type{types.length === 1 ? "" : "s"} configured. Deactivated types stay on historic records but can&rsquo;t be applied for.
          </p>
        </div>
        <LeaveTypeDialog nextOrder={types.length ? Math.max(...types.map((t) => t.order)) + 1 : 1} />
      </div>

      {types.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No leave types yet. Add your first type to let employees apply.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b text-left text-detail text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Code</th>
                <th className="py-2 pr-3 text-right font-medium">Per year</th>
                <th className="py-2 pr-3 text-right font-medium">Carry fwd</th>
                <th className="py-2 pr-3 font-medium">Rules</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {types.map((t) => (
                <tr key={t.id} className={cn(!t.isActive && "opacity-55")}>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2 font-medium">
                      <span className={cn("size-2.5 shrink-0 rounded-full", SWATCH[t.color] ?? SWATCH.slate)} />
                      {t.name}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <StatusPill label={t.code} hue={t.color as never} size="xs" />
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{t.accrualPerYear}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{t.carryForwardMax}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap gap-1">
                      <Tag on={t.paid}>{t.paid ? "Paid" : "Unpaid"}</Tag>
                      {t.allowHalfDay && <Tag on>½ day</Tag>}
                      {t.requiresApproval ? <Tag on>Approval</Tag> : <Tag>Auto</Tag>}
                      {t.allowNegative && <Tag>Negative</Tag>}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <StatusPill label={t.isActive ? "Active" : "Inactive"} hue={t.isActive ? "emerald" : "slate"} size="xs" />
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <LeaveTypeDialog existing={t} nextOrder={t.order} />
                      <ToggleActiveButton id={t.id} isActive={t.isActive} name={t.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Tag({ children, on }: { children: React.ReactNode; on?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded px-1.5 py-0.5 text-meta font-medium",
      on
        ? "bg-muted text-foreground"
        : "border border-dashed text-muted-foreground",
    )}>
      {children}
    </span>
  );
}

function ToggleActiveButton({ id, isActive, name }: { id: string; isActive: boolean; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="ghost" size="icon"
      className={cn("size-8 text-muted-foreground", isActive ? "hover:text-destructive" : "hover:text-success")}
      title={isActive ? `Deactivate ${name}` : `Activate ${name}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await setLeaveTypeActive(id, !isActive);
        setBusy(false);
        router.refresh();
      }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
    </Button>
  );
}

function LeaveTypeDialog({ existing, nextOrder }: { existing?: LeaveTypeRow; nextOrder: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState(existing?.name ?? "");
  const [code, setCode] = React.useState(existing?.code ?? "");
  const [paid, setPaid] = React.useState(existing?.paid ?? true);
  const [accrual, setAccrual] = React.useState(String(existing?.accrualPerYear ?? 0));
  const [carry, setCarry] = React.useState(String(existing?.carryForwardMax ?? 0));
  const [allowHalfDay, setAllowHalfDay] = React.useState(existing?.allowHalfDay ?? true);
  const [allowNegative, setAllowNegative] = React.useState(existing?.allowNegative ?? false);
  const [requiresApproval, setRequiresApproval] = React.useState(existing?.requiresApproval ?? true);
  const [color, setColor] = React.useState(existing?.color ?? "blue");
  const [order, setOrder] = React.useState(String(existing?.order ?? nextOrder));

  React.useEffect(() => {
    if (open) {
      setName(existing?.name ?? "");
      setCode(existing?.code ?? "");
      setPaid(existing?.paid ?? true);
      setAccrual(String(existing?.accrualPerYear ?? 0));
      setCarry(String(existing?.carryForwardMax ?? 0));
      setAllowHalfDay(existing?.allowHalfDay ?? true);
      setAllowNegative(existing?.allowNegative ?? false);
      setRequiresApproval(existing?.requiresApproval ?? true);
      setColor(existing?.color ?? "blue");
      setOrder(String(existing?.order ?? nextOrder));
      setError(null);
    }
  }, [open, existing, nextOrder]);

  async function save() {
    setError(null);
    const payload: LeaveTypeInput = {
      name,
      code,
      paid,
      accrualPerYear: Number(accrual),
      carryForwardMax: Number(carry),
      allowHalfDay,
      allowNegative,
      requiresApproval,
      color,
      order: Number(order),
    };
    setSaving(true);
    const res = existing
      ? await updateLeaveType(existing.id, payload)
      : await createLeaveType(payload);
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing
          ? <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><Pencil className="size-4" /></Button>
          : <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add type</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit leave type" : "New leave type"}</DialogTitle>
          <DialogDescription>These settings apply to new applications and balances going forward.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-detail">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Casual Leave" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-detail">Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CL"
                maxLength={12}
                className="uppercase"
              />
            </div>
          </div>

          {/* Three number fields across a 375px dialog leaves ~95px each, where
            * "Carry-forward cap" wraps to two lines over a box too narrow to
            * read the value in. Two-up on a phone, three-up from sm:. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-detail">Days / year</Label>
              <Input type="number" min={0} step="0.5" value={accrual} onChange={(e) => setAccrual(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-detail">Carry-forward cap</Label>
              <Input type="number" min={0} step="0.5" value={carry} onChange={(e) => setCarry(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-detail">Order</Label>
              <Input type="number" min={0} step="1" value={order} onChange={(e) => setOrder(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-detail">Colour</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLOR_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    <span className="flex items-center gap-2">
                      <span className={cn("size-2.5 rounded-full", SWATCH[c])} />
                      <span className="capitalize">{c}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2.5 rounded-lg border p-3 sm:grid-cols-2">
            <ToggleRow label="Paid leave" hint="Counts as paid time off" checked={paid} onChange={setPaid} />
            <ToggleRow label="Allow half-day" hint="First/second half applications" checked={allowHalfDay} onChange={setAllowHalfDay} />
            <ToggleRow label="Requires approval" hint="Otherwise auto-approved" checked={requiresApproval} onChange={setRequiresApproval} />
            <ToggleRow label="Allow negative" hint="Balance can go below zero (LOP)" checked={allowNegative} onChange={setAllowNegative} />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({
  label, hint, checked, onChange,
}: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span>
        <span className="block text-body font-medium">{label}</span>
        <span className="block text-meta text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
