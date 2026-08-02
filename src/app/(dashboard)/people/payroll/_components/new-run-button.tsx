"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createPayrollRun } from "@/actions/hr-payroll-run.actions";

const MONTHS = [
  { v: 1, label: "January" }, { v: 2, label: "February" }, { v: 3, label: "March" },
  { v: 4, label: "April" }, { v: 5, label: "May" }, { v: 6, label: "June" },
  { v: 7, label: "July" }, { v: 8, label: "August" }, { v: 9, label: "September" },
  { v: 10, label: "October" }, { v: 11, label: "November" }, { v: 12, label: "December" },
];

/** Indian FY containing a given calendar year+month (FY starts April). */
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

export function NewRunButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const fys = React.useMemo(fyOptions, []);
  const now = new Date();
  const defaultFy = now.getMonth() + 1 >= 4
    ? `${now.getFullYear()}-${String((now.getFullYear() + 1) % 100).padStart(2, "0")}`
    : `${now.getFullYear() - 1}-${String(now.getFullYear() % 100).padStart(2, "0")}`;

  const [fy, setFy] = React.useState(defaultFy);
  const [month, setMonth] = React.useState(String(now.getMonth() + 1));

  async function submit() {
    setSaving(true);
    const res = await createPayrollRun({ fy, month: Number(month) });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Payroll run created.");
    setOpen(false);
    router.push(`/people/payroll/${res.data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="size-4" /> New run</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New payroll run</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-detail">Financial year</Label>
            <Select value={fy} onValueChange={setFy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {fys.map((f) => <SelectItem key={f} value={f}>FY {f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-detail">Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => <SelectItem key={m.v} value={String(m.v)}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-detail text-muted-foreground">
          Creates an empty draft run. You’ll compute payslips on the next screen.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Create run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
