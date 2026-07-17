"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Pencil, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { updateEmployee, archiveEmployee } from "@/actions/hr-employee.actions";
import { EMPLOYMENT_TYPE_LABELS, EMPLOYEE_STATUS_LABELS, GENDER_OPTIONS } from "@/lib/hr/constants";
import { hasPermission } from "@/lib/permissions";

type Lookup = { id: string; name: string; shortCode?: string | null };
type ManagerLookup = { id: string; firstName: string; lastName: string; empCode: string };

interface Props {
  employee: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    gender?: string | null;
    dob?: Date | string | null;
    dateOfJoining?: Date | string | null;
    photoUrl?: string | null;
    workEmail: string | null;
    personalEmail: string | null;
    phone: string | null;
    workLocation: string | null;
    siteIds?: string[] | null;
    attendanceAllSites?: boolean | null;
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
  /** Active attendance sites — the employee's check-ins are geofenced to the selected ones. */
  sites?: Lookup[];
  /** Explicitly grant/deny archive; when omitted, falls back to the viewer's hr:admin permission. */
  canArchive?: boolean;
}

const NONE = "__none__";

function toDateInput(v: Date | string | null | undefined): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function EmployeeEditDialog({ employee, entities, verticals, departments, designations, managers, sites = [], canArchive }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const viewerRole = (session?.user as { role?: string } | undefined)?.role;
  const mayArchive = canArchive ?? (viewerRole ? hasPermission(viewerRole, "hr:admin") : false);

  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [archiving, setArchiving] = React.useState(false);
  const [archiveError, setArchiveError] = React.useState<string | null>(null);

  const [firstName, setFirstName] = React.useState(employee.firstName ?? "");
  const [lastName, setLastName] = React.useState(employee.lastName ?? "");
  const [gender, setGender] = React.useState(employee.gender ?? NONE);
  const [dob, setDob] = React.useState(toDateInput(employee.dob));
  const [dateOfJoining, setDateOfJoining] = React.useState(toDateInput(employee.dateOfJoining));
  const [photoUrl, setPhotoUrl] = React.useState(employee.photoUrl ?? "");
  const [workEmail, setWorkEmail] = React.useState(employee.workEmail ?? "");
  const [personalEmail, setPersonalEmail] = React.useState(employee.personalEmail ?? "");
  const [phone, setPhone] = React.useState(employee.phone ?? "");
  const [workLocation, setWorkLocation] = React.useState(employee.workLocation ?? "");
  const [siteIds, setSiteIds] = React.useState<string[]>(employee.siteIds ?? []);
  const [allSites, setAllSites] = React.useState(employee.attendanceAllSites ?? false);
  const [employmentType, setEmploymentType] = React.useState(employee.employmentType);
  const toggleSite = (id: string) =>
    setSiteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
      firstName, lastName,
      gender: gender === NONE ? "" : gender,
      dob, dateOfJoining, photoUrl,
      workEmail, personalEmail, phone, workLocation,
      siteIds: allSites ? [] : siteIds,
      attendanceAllSites: allSites,
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

  async function handleArchive() {
    setArchiveError(null);
    setArchiving(true);
    const res = await archiveEmployee(employee.id);
    setArchiving(false);
    if (!res.success) { setArchiveError(res.error); return; }
    setOpen(false);
    router.push("/people");
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
          <F label="First name"><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></F>
          <F label="Last name"><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></F>
          <F label="Gender">
            <P value={gender} onChange={setGender} allowNone
              options={GENDER_OPTIONS.map((g) => ({ value: g, label: g }))} />
          </F>
          <F label="Date of birth"><Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></F>
          <F label="Date of joining"><Input type="date" value={dateOfJoining} onChange={(e) => setDateOfJoining(e.target.value)} /></F>
          <F label="Photo URL"><Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" /></F>

          <F label="Work email"><Input value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} /></F>
          <F label="Personal email"><Input value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} /></F>
          <F label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></F>
          <F label="Work location"><Input value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} /></F>

          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label className="text-[12.5px]">Attendance sites (geofence)</Label>
              <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                Can mark from all locations
                <Switch checked={allSites} onCheckedChange={setAllSites} />
              </label>
            </div>
            {allSites ? (
              <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-[12.5px] text-muted-foreground">
                This employee may check in from <strong>any</strong> active site.
              </p>
            ) : sites.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">No attendance sites configured yet.</p>
            ) : (
              <div className="grid gap-1.5 rounded-md border p-2 sm:grid-cols-2">
                {sites.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-muted/50">
                    <Checkbox checked={siteIds.includes(s.id)} onCheckedChange={() => toggleSite(s.id)} />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
            <p className="text-[12.5px] text-muted-foreground">
              A check-in is accepted if it matches <strong>any</strong> selected site (radius / office IP / WFH).
            </p>
          </div>

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

        {mayArchive && (
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">Archive employee</p>
                <p className="text-[12.5px] text-red-600/80 dark:text-red-400/70">
                  Marks the record as exited and removes them from the directory. This can’t be undone here.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-1.5 shrink-0">
                    <Trash2 className="size-3.5" /> Archive
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Archive this employee?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This soft-deletes the employee, sets their status to Exited, and re-routes any pending
                      approvals assigned to them to the HR queue. They will no longer appear in the directory.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {archiveError && <p className="text-sm text-red-600">{archiveError}</p>}
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => { e.preventDefault(); handleArchive(); }}
                      disabled={archiving}
                      className="gap-1.5 bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
                    >
                      {archiving && <Loader2 className="size-4 animate-spin" />} Archive employee
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
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
