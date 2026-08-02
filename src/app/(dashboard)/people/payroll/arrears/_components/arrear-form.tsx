"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { ArrearEmployeeOption } from "@/actions/hr-arrear.actions";

export const MONTHS = [
  { v: 1, label: "January" }, { v: 2, label: "February" }, { v: 3, label: "March" },
  { v: 4, label: "April" }, { v: 5, label: "May" }, { v: 6, label: "June" },
  { v: 7, label: "July" }, { v: 8, label: "August" }, { v: 9, label: "September" },
  { v: 10, label: "October" }, { v: 11, label: "November" }, { v: 12, label: "December" },
];

/** Indian FYs around now (FY starts April), newest first. */
export function fyOptions(): string[] {
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

export function defaultFy(): string {
  const now = new Date();
  return now.getMonth() + 1 >= 4
    ? `${now.getFullYear()}-${String((now.getFullYear() + 1) % 100).padStart(2, "0")}`
    : `${now.getFullYear() - 1}-${String(now.getFullYear() % 100).padStart(2, "0")}`;
}

export interface ArrearFormState {
  employeeId: string;
  name: string;
  amount: string;
  forFy: string; // "" = none
  forMonth: string; // "" = none
  payFy: string;
  payMonth: string;
  taxable: boolean;
  pfApplicable: boolean;
  esiApplicable: boolean;
  ptApplicable: boolean;
  reason: string;
}

export function emptyArrearForm(): ArrearFormState {
  const now = new Date();
  return {
    employeeId: "",
    name: "",
    amount: "",
    forFy: "",
    forMonth: "",
    payFy: defaultFy(),
    payMonth: String(now.getMonth() + 1),
    taxable: true,
    pfApplicable: true,
    esiApplicable: true,
    ptApplicable: false,
    reason: "",
  };
}

const NONE = "__none__";

export function ArrearFormFields({
  state,
  set,
  employees,
  lockEmployee = false,
}: {
  state: ArrearFormState;
  set: <K extends keyof ArrearFormState>(key: K, value: ArrearFormState[K]) => void;
  employees: ArrearEmployeeOption[];
  lockEmployee?: boolean;
}) {
  const fys = React.useMemo(fyOptions, []);

  return (
    <div className="space-y-3 py-2">
      <div className="space-y-1.5">
        <Label className="text-detail">Employee</Label>
        <Select value={state.employeeId} onValueChange={(v) => set("employeeId", v)} disabled={lockEmployee}>
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
          <Label className="text-detail">Arrear name</Label>
          <Input
            value={state.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. April hike arrears"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-detail">Amount (₹)</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={state.amount}
            onChange={(e) => set("amount", e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-detail">For period — FY (optional)</Label>
          <Select
            value={state.forFy || NONE}
            onValueChange={(v) => set("forFy", v === NONE ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {fys.map((f) => (
                <SelectItem key={f} value={f}>
                  FY {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-detail">For period — month (optional)</Label>
          <Select
            value={state.forMonth || NONE}
            onValueChange={(v) => set("forMonth", v === NONE ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue />
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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-detail">Pay in — FY</Label>
          <Select value={state.payFy} onValueChange={(v) => set("payFy", v)}>
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
          <Label className="text-detail">Pay in — month</Label>
          <Select value={state.payMonth} onValueChange={(v) => set("payMonth", v)}>
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

      <div className="rounded-lg border p-3">
        <div className="mb-2 text-meta uppercase tracking-wide text-muted-foreground">
          Statutory treatment
        </div>
        <div className="space-y-2.5">
          <ToggleRow
            label="Taxable"
            checked={state.taxable}
            onChange={(v) => set("taxable", v)}
          />
          <ToggleRow
            label="PF applicable"
            checked={state.pfApplicable}
            onChange={(v) => set("pfApplicable", v)}
          />
          <ToggleRow
            label="ESI applicable"
            checked={state.esiApplicable}
            onChange={(v) => set("esiApplicable", v)}
          />
          <ToggleRow
            label="PT applicable"
            checked={state.ptApplicable}
            onChange={(v) => set("ptApplicable", v)}
          />
        </div>
        <p className="mt-2.5 text-meta text-muted-foreground">
          These decide whether the arrear attracts PF / ESI / PT when the payroll run pays it.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-detail">Reason (optional)</Label>
        <Textarea
          value={state.reason}
          onChange={(e) => set("reason", e.target.value)}
          rows={2}
          placeholder="e.g. revised CTC effective April, paid now"
        />
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-body font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
