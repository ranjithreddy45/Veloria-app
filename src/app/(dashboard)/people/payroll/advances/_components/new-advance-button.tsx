"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createAdvance, type AdvanceEmployeeOption } from "@/actions/hr-advance.actions";

const MONTHS = [
  { v: 1, label: "January" }, { v: 2, label: "February" }, { v: 3, label: "March" },
  { v: 4, label: "April" }, { v: 5, label: "May" }, { v: 6, label: "June" },
  { v: 7, label: "July" }, { v: 8, label: "August" }, { v: 9, label: "September" },
  { v: 10, label: "October" }, { v: 11, label: "November" }, { v: 12, label: "December" },
];

/** Indian FYs around now (FY starts April), newest first. */
function fyOptions(): string[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const currentFyStart = m >= 4 ? y : y - 1;
  const out: string[] = [];
  for (let s = currentFyStart + 1; s >= currentFyStart - 2; s--) {
    out.push(`${s}-${String((s + 1) % 100).padStart(2, "0")}`);
  }
  return out;
}

export function NewAdvanceButton({ employees }: { employees: AdvanceEmployeeOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const fys = React.useMemo(fyOptions, []);
  const now = new Date();
  const defaultFy =
    now.getMonth() + 1 >= 4
      ? `${now.getFullYear()}-${String((now.getFullYear() + 1) % 100).padStart(2, "0")}`
      : `${now.getFullYear() - 1}-${String(now.getFullYear() % 100).padStart(2, "0")}`;

  const [employeeId, setEmployeeId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [installment, setInstallment] = React.useState("");
  const [fy, setFy] = React.useState(defaultFy);
  const [month, setMonth] = React.useState(String(now.getMonth() + 1));
  const [reason, setReason] = React.useState("");

  function reset() {
    setEmployeeId("");
    setAmount("");
    setInstallment("");
    setFy(defaultFy);
    setMonth(String(now.getMonth() + 1));
    setReason("");
  }

  async function submit() {
    if (!employeeId) {
      toast.error("Select an employee.");
      return;
    }
    setSaving(true);
    const res = await createAdvance({
      employeeId,
      amount: Number(amount),
      monthlyInstallment: Number(installment),
      startFy: fy,
      startMonth: Number(month),
      reason: reason.trim() || undefined,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Advance recorded.");
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" /> New advance
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New salary advance</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-detail">Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {e.empCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-detail">Advance amount (₹)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-detail">Monthly instalment (₹)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={installment}
                onChange={(e) => setInstallment(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-detail">Recovery starts — FY</Label>
              <Select value={fy} onValueChange={setFy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fys.map((f) => (
                    <SelectItem key={f} value={f}>
                      FY {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-detail">Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.v} value={String(m.v)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-detail">Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. medical emergency"
            />
          </div>
        </div>
        <p className="text-detail text-muted-foreground">
          Instalments are deducted automatically when payroll is processed. An employee may hold
          only one active advance at a time.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Record advance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
