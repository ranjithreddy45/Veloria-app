"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createRecurring, type RecurringEmployeeOption,
} from "@/actions/hr-recurring.actions";

// Shared constant kept INLINE — a "use server" module may only export async
// functions, so the KIND list lives in this client component.
const KINDS = [
  { v: "EARNING", label: "Earning" },
  { v: "DEDUCTION", label: "Deduction" },
] as const;

const MONTHS = [
  { v: 1, label: "January" }, { v: 2, label: "February" }, { v: 3, label: "March" },
  { v: 4, label: "April" }, { v: 5, label: "May" }, { v: 6, label: "June" },
  { v: 7, label: "July" }, { v: 8, label: "August" }, { v: 9, label: "September" },
  { v: 10, label: "October" }, { v: 11, label: "November" }, { v: 12, label: "December" },
];

const NONE = "__none__";

/** Indian FYs around now (FY starts April), newest first. */
function fyOptions(): string[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const currentFyStart = m >= 4 ? y : y - 1;
  const out: string[] = [];
  for (let s = currentFyStart + 2; s >= currentFyStart - 2; s--) {
    out.push(`${s}-${String((s + 1) % 100).padStart(2, "0")}`);
  }
  return out;
}

export function NewRecurringButton({ employees }: { employees: RecurringEmployeeOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const fys = React.useMemo(fyOptions, []);
  const now = new Date();
  const defaultFy = "2026-27";
  const defaultMonth = String(now.getMonth() + 1);

  const [employeeId, setEmployeeId] = React.useState("");
  const [kind, setKind] = React.useState<"EARNING" | "DEDUCTION">("EARNING");
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [taxable, setTaxable] = React.useState(true);
  const [pf, setPf] = React.useState(false);
  const [esi, setEsi] = React.useState(false);
  const [pt, setPt] = React.useState(false);
  const [startFy, setStartFy] = React.useState(defaultFy);
  const [startMonth, setStartMonth] = React.useState(defaultMonth);
  const [endFy, setEndFy] = React.useState(NONE);
  const [endMonth, setEndMonth] = React.useState(NONE);
  const [note, setNote] = React.useState("");

  const isEarning = kind === "EARNING";

  function reset() {
    setEmployeeId("");
    setKind("EARNING");
    setCode("");
    setName("");
    setAmount("");
    setTaxable(true);
    setPf(false);
    setEsi(false);
    setPt(false);
    setStartFy(defaultFy);
    setStartMonth(defaultMonth);
    setEndFy(NONE);
    setEndMonth(NONE);
    setNote("");
  }

  async function submit() {
    if (!employeeId) {
      toast.error("Select an employee.");
      return;
    }
    const hasEndFy = endFy !== NONE;
    const hasEndMonth = endMonth !== NONE;
    if (hasEndFy !== hasEndMonth) {
      toast.error("Provide both an end FY and an end month, or leave both empty.");
      return;
    }
    setSaving(true);
    const res = await createRecurring({
      employeeId,
      kind,
      code: code.trim(),
      name: name.trim(),
      amount: Number(amount),
      taxable,
      pfApplicable: isEarning && pf,
      esiApplicable: isEarning && esi,
      ptApplicable: isEarning && pt,
      startFy,
      startMonth: Number(startMonth),
      endFy: hasEndFy ? endFy : undefined,
      endMonth: hasEndMonth ? Number(endMonth) : undefined,
      note: note.trim() || undefined,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Recurring component added.");
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
          <Plus className="size-4" /> New recurring
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New recurring pay</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto py-2 pr-1">
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
              <Label className="text-detail">Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as "EARNING" | "DEDUCTION")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.v} value={k.v}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-detail">Amount (₹)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-detail">Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. HRA"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-detail">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. House rent allowance"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <label className="flex items-center gap-2 text-body">
              <Checkbox checked={taxable} onCheckedChange={(c) => setTaxable(c === true)} />
              Taxable
            </label>
            {isEarning && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <label className="flex items-center gap-2 text-body">
                  <Checkbox checked={pf} onCheckedChange={(c) => setPf(c === true)} /> PF
                </label>
                <label className="flex items-center gap-2 text-body">
                  <Checkbox checked={esi} onCheckedChange={(c) => setEsi(c === true)} /> ESI
                </label>
                <label className="flex items-center gap-2 text-body">
                  <Checkbox checked={pt} onCheckedChange={(c) => setPt(c === true)} /> PT
                </label>
              </div>
            )}
            {!isEarning && (
              <p className="text-detail text-muted-foreground">
                PF / ESI / PT applicability applies to earnings only.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-detail">Starts — FY</Label>
              <Select value={startFy} onValueChange={setStartFy}>
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
              <Select value={startMonth} onValueChange={setStartMonth}>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-detail">Ends — FY (optional)</Label>
              <Select value={endFy} onValueChange={setEndFy}>
                <SelectTrigger>
                  <SelectValue placeholder="Open-ended" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Open-ended</SelectItem>
                  {fys.map((f) => (
                    <SelectItem key={f} value={f}>
                      FY {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-detail">End month (optional)</Label>
              <Select value={endMonth} onValueChange={setEndMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
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
            <Label className="text-detail">Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. per appraisal letter dated 01-Apr-2026"
            />
          </div>
        </div>
        <p className="text-detail text-muted-foreground">
          Applies automatically every payroll run from the start month while active. Leave the end
          blank for an open-ended component.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Add component
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
