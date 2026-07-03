"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createEmployee } from "@/actions/hr-employee.actions";
import { EMPLOYMENT_TYPE_LABELS, EMPLOYEE_STATUS_LABELS, GENDER_OPTIONS } from "@/lib/hr/constants";

type Lookup = { id: string; name: string };
type ManagerLookup = { id: string; firstName: string; lastName: string; empCode: string };

interface Props {
  entities: (Lookup & { shortCode?: string | null })[];
  verticals: Lookup[];
  departments: Lookup[];
  designations: Lookup[];
  managers: ManagerLookup[];
}

export function EmployeeFormDialog({ entities, verticals, departments, designations, managers }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // controlled fields
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [workEmail, setWorkEmail] = React.useState("");
  const [personalEmail, setPersonalEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [dob, setDob] = React.useState("");
  const [legalEntityId, setLegalEntityId] = React.useState("");
  const [businessVerticalId, setBusinessVerticalId] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState("");
  const [designationId, setDesignationId] = React.useState("");
  const [employmentType, setEmploymentType] = React.useState("FULL_TIME");
  const [dateOfJoining, setDateOfJoining] = React.useState("");
  const [workLocation, setWorkLocation] = React.useState("");
  const [reportingManagerId, setReportingManagerId] = React.useState("");
  const [status, setStatus] = React.useState("ONBOARDING");

  function reset() {
    setFirstName(""); setLastName(""); setWorkEmail(""); setPersonalEmail(""); setPhone(""); setGender(""); setDob("");
    setLegalEntityId(""); setBusinessVerticalId(""); setDepartmentId(""); setDesignationId("");
    setEmploymentType("FULL_TIME"); setDateOfJoining(""); setWorkLocation(""); setReportingManagerId("");
    setStatus("ONBOARDING"); setError(null);
  }

  async function handleSubmit() {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) { setError("First and last name are required."); return; }
    if (!legalEntityId) { setError("Please select a legal entity."); return; }
    setSaving(true);
    const res = await createEmployee({
      firstName, lastName,
      workEmail: workEmail || undefined,
      personalEmail: personalEmail || undefined,
      phone: phone || undefined,
      gender: gender || undefined,
      dob: dob || undefined,
      legalEntityId,
      businessVerticalId: businessVerticalId || undefined,
      departmentId: departmentId || undefined,
      designationId: designationId || undefined,
      employmentType,
      dateOfJoining: dateOfJoining || undefined,
      workLocation: workLocation || undefined,
      reportingManagerId: reportingManagerId || undefined,
      status,
    });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    reset();
    setOpen(false);
    router.push(`/people/${res.data.id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <UserPlus className="size-4" /> Add employee
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>
            Create the master record. An employee code is generated automatically. Statutory &amp; bank details are
            captured separately (encrypted).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <Field label="First name" required>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Varshitha" />
          </Field>
          <Field label="Last name" required>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Reddy" />
          </Field>
          <Field label="Work email">
            <Input type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} placeholder="name@propertyplush.in" />
          </Field>
          <Field label="Personal email">
            <Input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} placeholder="name@gmail.com" />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 ..." />
          </Field>

          <Field label="Legal entity" required>
            <Picker value={legalEntityId} onChange={setLegalEntityId} placeholder="Select entity"
              options={entities.map((e) => ({ value: e.id, label: e.shortCode || e.name }))} />
          </Field>
          <Field label="Business vertical">
            <Picker value={businessVerticalId} onChange={setBusinessVerticalId} placeholder="Select vertical"
              options={verticals.map((v) => ({ value: v.id, label: v.name }))} />
          </Field>

          <Field label="Department">
            <Picker value={departmentId} onChange={setDepartmentId} placeholder="Select department"
              options={departments.map((d) => ({ value: d.id, label: d.name }))} />
          </Field>
          <Field label="Designation">
            <Picker value={designationId} onChange={setDesignationId} placeholder="Select designation"
              options={designations.map((d) => ({ value: d.id, label: d.name }))} />
          </Field>

          <Field label="Employment type">
            <Picker value={employmentType} onChange={setEmploymentType}
              options={Object.entries(EMPLOYMENT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
          </Field>
          <Field label="Reporting manager">
            <Picker value={reportingManagerId} onChange={setReportingManagerId} placeholder="Select manager"
              options={managers.map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName} · ${m.empCode}` }))} />
          </Field>

          <Field label="Date of joining">
            <Input type="date" value={dateOfJoining} onChange={(e) => setDateOfJoining(e.target.value)} />
          </Field>
          <Field label="Work location">
            <Input value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} placeholder="Bengaluru HQ" />
          </Field>

          <Field label="Gender">
            <Picker value={gender} onChange={setGender} placeholder="Select"
              options={GENDER_OPTIONS.map((g) => ({ value: g, label: g }))} />
          </Field>
          <Field label="Date of birth">
            <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </Field>

          <Field label="Status">
            <Picker value={status} onChange={setStatus}
              options={Object.entries(EMPLOYEE_STATUS_LABELS)
                .filter(([v]) => v !== "EXITED")
                .map(([v, l]) => ({ value: v, label: l }))} />
          </Field>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />}
            Create employee
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12.5px]">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}

function Picker({
  value, onChange, options, placeholder,
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder || "Select"} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
