"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { updateEmployee } from "@/actions/hr-employee.actions";
import { EMPLOYMENT_TYPE_LABELS, EMPLOYEE_STATUS_LABELS } from "@/lib/hr/constants";

type Lookup = { id: string; name: string; shortCode?: string | null };
type ManagerLookup = { id: string; firstName: string; lastName: string; empCode: string };

interface Props {
  employee: {
    id: string;
    workEmail: string | null;
    personalEmail: string | null;
    phone: string | null;
    workLocation: string | null;
    employmentType: string;
    status: string;
    legalEntityId: string;
    businessVerticalId: string | null;
    departmentId: string | null;
    designationId: string | null;
    reportingManagerId: string | null;
  };
  entities: Lookup[];
  verticals: Lookup[];
  departments: Lookup[];
  designations: Lookup[];
  managers: ManagerLookup[];
}

const NONE = "__none__";

export function EmployeeEditDialog({ employee, entities, verticals, departments, designations, managers }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [workEmail, setWorkEmail] = React.useState(employee.workEmail ?? "");
  const [personalEmail, setPersonalEmail] = React.useState(employee.personalEmail ?? "");
  const [phone, setPhone] = React.useState(employee.phone ?? "");
  const [workLocation, setWorkLocation] = React.useState(employee.workLocation ?? "");
  const [employmentType, setEmploymentType] = React.useState(employee.employmentType);
  const [status, setStatus] = React.useState(employee.status);
  const [legalEntityId, setLegalEntityId] = React.useState(employee.legalEntityId);
  const [businessVerticalId, setBusinessVerticalId] = React.useState(employee.businessVerticalId ?? NONE);
  const [departmentId, setDepartmentId] = React.useState(employee.departmentId ?? NONE);
  const [designationId, setDesignationId] = React.useState(employee.designationId ?? NONE);
  const [reportingManagerId, setReportingManagerId] = React.useState(employee.reportingManagerId ?? NONE);

  async function handleSave() {
    setError(null);
    setSaving(true);
    const res = await updateEmployee(employee.id, {
      workEmail, personalEmail, phone, workLocation,
      employmentType, status, legalEntityId,
      businessVerticalId: businessVerticalId === NONE ? "" : businessVerticalId,
      departmentId: departmentId === NONE ? "" : departmentId,
      designationId: designationId === NONE ? "" : designationId,
      reportingManagerId: reportingManagerId === NONE ? "" : reportingManagerId,
    });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5"><Pencil className="size-3.5" /> Edit</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Edit employee</DialogTitle></DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <F label="Work email"><Input value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} /></F>
          <F label="Personal email"><Input value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} /></F>
          <F label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></F>
          <F label="Work location"><Input value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} /></F>

          <F label="Legal entity">
            <P value={legalEntityId} onChange={setLegalEntityId}
              options={entities.map((e) => ({ value: e.id, label: e.shortCode || e.name }))} />
          </F>
          <F label="Business vertical">
            <P value={businessVerticalId} onChange={setBusinessVerticalId} allowNone
              options={verticals.map((v) => ({ value: v.id, label: v.name }))} />
          </F>
          <F label="Department">
            <P value={departmentId} onChange={setDepartmentId} allowNone
              options={departments.map((d) => ({ value: d.id, label: d.name }))} />
          </F>
          <F label="Designation">
            <P value={designationId} onChange={setDesignationId} allowNone
              options={designations.map((d) => ({ value: d.id, label: d.name }))} />
          </F>
          <F label="Reporting manager">
            <P value={reportingManagerId} onChange={setReportingManagerId} allowNone
              options={managers.filter((m) => m.id !== employee.id).map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName} · ${m.empCode}` }))} />
          </F>
          <F label="Employment type">
            <P value={employmentType} onChange={setEmploymentType}
              options={Object.entries(EMPLOYMENT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
          </F>
          <F label="Status">
            <P value={status} onChange={setStatus}
              options={Object.entries(EMPLOYEE_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
          </F>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-[12.5px]">{label}</Label>{children}</div>;
}

function P({
  value, onChange, options, allowNone,
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; allowNone?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="__none__">— None —</SelectItem>}
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
