"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { createArrear, type ArrearEmployeeOption } from "@/actions/hr-arrear.actions";
import {
  ArrearFormFields, emptyArrearForm, type ArrearFormState,
} from "./arrear-form";

export function NewArrearButton({ employees }: { employees: ArrearEmployeeOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<ArrearFormState>(emptyArrearForm);

  function set<K extends keyof ArrearFormState>(key: K, value: ArrearFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function reset() {
    setForm(emptyArrearForm());
  }

  async function submit() {
    if (!form.employeeId) {
      toast.error("Select an employee.");
      return;
    }
    setSaving(true);
    const res = await createArrear({
      employeeId: form.employeeId,
      name: form.name.trim(),
      amount: Number(form.amount),
      forFy: form.forFy || undefined,
      forMonth: form.forMonth ? Number(form.forMonth) : undefined,
      payFy: form.payFy,
      payMonth: Number(form.payMonth),
      taxable: form.taxable,
      pfApplicable: form.pfApplicable,
      esiApplicable: form.esiApplicable,
      ptApplicable: form.ptApplicable,
      reason: form.reason.trim() || undefined,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Arrear recorded.");
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
          <Plus className="size-4" /> New arrear
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New salary arrear</DialogTitle>
        </DialogHeader>
        <ArrearFormFields state={form} set={set} employees={employees} />
        <p className="text-detail text-muted-foreground">
          A pending arrear is paid — with its statutory deductions — the next time you process
          payroll for its pay month. Once paid it is locked.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Record arrear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
