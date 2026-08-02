"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, Phone, GraduationCap, Building2, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  upsertEmergencyContact, deleteEmergencyContact,
  upsertEducation, deleteEducation,
  upsertWorkHistory, deleteWorkHistory,
  type EmergencyContactRow, type EducationRow, type WorkHistoryRow,
} from "@/actions/hr-profile-extras.actions";

type SaveResult = { success: true } | { success: false; error: string };

export function ProfileDetailsPanel({
  employeeId, emergencyContacts, education, workHistory, canWrite,
}: {
  employeeId: string;
  emergencyContacts: EmergencyContactRow[];
  education: EducationRow[];
  workHistory: WorkHistoryRow[];
  canWrite: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Emergency contacts */}
      <Section
        title="Emergency contacts"
        icon={<HeartPulse className="size-4 text-destructive" />}
        addLabel="Add contact"
        canWrite={canWrite}
        renderDialog={(props) => <EmergencyContactDialog employeeId={employeeId} {...props} />}
        empty="No emergency contacts on file."
        items={emergencyContacts}
        renderItem={(c, canWrite) => (
          <RowLine
            key={c.id}
            primary={c.name}
            secondary={[c.relation, c.phone].filter(Boolean).join(" · ") || null}
            secondaryIcon={c.phone ? <Phone className="size-3.5" /> : undefined}
            canWrite={canWrite}
            editDialog={(p) => (
              <EmergencyContactDialog employeeId={employeeId} record={c} {...p} />
            )}
            onDelete={() => deleteEmergencyContact({ employeeId, id: c.id })}
          />
        )}
      />

      {/* Education */}
      <Section
        title="Education"
        icon={<GraduationCap className="size-4 text-indigo-500" />}
        addLabel="Add education"
        canWrite={canWrite}
        renderDialog={(props) => <EducationDialog employeeId={employeeId} {...props} />}
        empty="No education records on file."
        items={education}
        renderItem={(e, canWrite) => (
          <RowLine
            key={e.id}
            primary={e.institution}
            secondary={[e.degree, e.year ? String(e.year) : null].filter(Boolean).join(" · ") || null}
            canWrite={canWrite}
            editDialog={(p) => <EducationDialog employeeId={employeeId} record={e} {...p} />}
            onDelete={() => deleteEducation({ employeeId, id: e.id })}
          />
        )}
      />

      {/* Work history */}
      <Section
        title="Work history"
        icon={<Building2 className="size-4 text-success" />}
        addLabel="Add experience"
        canWrite={canWrite}
        renderDialog={(props) => <WorkHistoryDialog employeeId={employeeId} {...props} />}
        empty="No prior work history on file."
        items={workHistory}
        renderItem={(w, canWrite) => (
          <RowLine
            key={w.id}
            primary={w.title ? `${w.title} · ${w.company}` : w.company}
            secondary={formatRange(w.fromDate, w.toDate)}
            canWrite={canWrite}
            editDialog={(p) => <WorkHistoryDialog employeeId={employeeId} record={w} {...p} />}
            onDelete={() => deleteWorkHistory({ employeeId, id: w.id })}
          />
        )}
      />
    </div>
  );
}

function formatRange(from: string | null, to: string | null): string | null {
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short" }) : null;
  const f = fmt(from);
  const t = fmt(to);
  if (!f && !t) return null;
  return `${f ?? "—"} – ${t ?? "Present"}`;
}

// ---------------------------------------------------------------------
// Generic section shell: heading + add button + list
// ---------------------------------------------------------------------
function Section<T>({
  title, icon, addLabel, canWrite, empty, items, renderItem, renderDialog,
}: {
  title: string;
  icon: React.ReactNode;
  addLabel: string;
  canWrite: boolean;
  empty: string;
  items: T[];
  renderItem: (item: T, canWrite: boolean) => React.ReactNode;
  renderDialog: (props: { open: boolean; onOpenChange: (o: boolean) => void }) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-meta font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h3>
        </div>
        {canWrite && (
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
              <Plus className="size-3.5" /> {addLabel}
            </Button>
            {renderDialog({ open, onOpenChange: setOpen })}
          </>
        )}
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-body text-muted-foreground">{empty}</p>
      ) : (
        <div className="divide-y">{items.map((it) => renderItem(it, canWrite))}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// A single list row with edit/delete affordances
// ---------------------------------------------------------------------
function RowLine({
  primary, secondary, secondaryIcon, canWrite, editDialog, onDelete,
}: {
  primary: string;
  secondary: string | null;
  secondaryIcon?: React.ReactNode;
  canWrite: boolean;
  editDialog: (props: { open: boolean; onOpenChange: (o: boolean) => void }) => React.ReactNode;
  onDelete: () => Promise<SaveResult>;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    if (!confirm("Delete this record?")) return;
    setDeleting(true);
    const res = await onDelete();
    setDeleting(false);
    if (res.success) router.refresh();
    else alert(res.error);
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-body font-medium">{primary}</p>
        {secondary && (
          <p className="mt-0.5 inline-flex items-center gap-1.5 truncate text-detail text-muted-foreground">
            {secondaryIcon}{secondary}
          </p>
        )}
      </div>
      {canWrite && (
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" />
          </Button>
          {editDialog({ open: editOpen, onOpenChange: setEditOpen })}
          <Button
            variant="ghost" size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={handleDelete} disabled={deleting}
          >
            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Field primitive
// ---------------------------------------------------------------------
function EF({
  label, value, onChange, placeholder, type, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-detail">
        {label}{required && <span className="text-destructive"> *</span>}
      </Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function DialogShell({
  open, onOpenChange, title, saving, error, onSave, children,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string;
  saving: boolean; error: string | null; onSave: () => void; children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">{children}</div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={onSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useDialogSave(onOpenChange: (o: boolean) => void) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function run(fn: () => Promise<SaveResult>) {
    setError(null);
    setSaving(true);
    const res = await fn();
    setSaving(false);
    if (!res.success) { setError(res.error); return false; }
    onOpenChange(false);
    router.refresh();
    return true;
  }
  return { saving, error, setError, run };
}

// ---------------------------------------------------------------------
// Emergency contact dialog
// ---------------------------------------------------------------------
function EmergencyContactDialog({
  employeeId, record, open, onOpenChange,
}: {
  employeeId: string; record?: EmergencyContactRow;
  open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [name, setName] = React.useState(record?.name ?? "");
  const [relation, setRelation] = React.useState(record?.relation ?? "");
  const [phone, setPhone] = React.useState(record?.phone ?? "");
  const { saving, error, run } = useDialogSave(onOpenChange);

  React.useEffect(() => {
    if (open) {
      setName(record?.name ?? "");
      setRelation(record?.relation ?? "");
      setPhone(record?.phone ?? "");
    }
  }, [open, record]);

  return (
    <DialogShell
      open={open} onOpenChange={onOpenChange}
      title={record ? "Edit contact" : "Add emergency contact"}
      saving={saving} error={error}
      onSave={() => run(() => upsertEmergencyContact({
        employeeId, id: record?.id, name, relation, phone,
      }))}
    >
      <EF label="Name" value={name} onChange={setName} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <EF label="Relationship" value={relation} onChange={setRelation} placeholder="Spouse, Parent…" />
        <EF label="Phone" value={phone} onChange={setPhone} placeholder="Mobile number" />
      </div>
    </DialogShell>
  );
}

// ---------------------------------------------------------------------
// Education dialog
// ---------------------------------------------------------------------
function EducationDialog({
  employeeId, record, open, onOpenChange,
}: {
  employeeId: string; record?: EducationRow;
  open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [institution, setInstitution] = React.useState(record?.institution ?? "");
  const [degree, setDegree] = React.useState(record?.degree ?? "");
  const [year, setYear] = React.useState(record?.year ? String(record.year) : "");
  const { saving, error, run } = useDialogSave(onOpenChange);

  React.useEffect(() => {
    if (open) {
      setInstitution(record?.institution ?? "");
      setDegree(record?.degree ?? "");
      setYear(record?.year ? String(record.year) : "");
    }
  }, [open, record]);

  return (
    <DialogShell
      open={open} onOpenChange={onOpenChange}
      title={record ? "Edit education" : "Add education"}
      saving={saving} error={error}
      onSave={() => run(() => upsertEducation({
        employeeId, id: record?.id, institution, degree, year,
      }))}
    >
      <EF label="Institution" value={institution} onChange={setInstitution} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <EF label="Degree" value={degree} onChange={setDegree} placeholder="B.Tech, MBA…" />
        <EF label="Year" value={year} onChange={setYear} type="number" placeholder="2020" />
      </div>
    </DialogShell>
  );
}

// ---------------------------------------------------------------------
// Work history dialog
// ---------------------------------------------------------------------
function toDateInput(iso: string | null | undefined): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

function WorkHistoryDialog({
  employeeId, record, open, onOpenChange,
}: {
  employeeId: string; record?: WorkHistoryRow;
  open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [company, setCompany] = React.useState(record?.company ?? "");
  const [title, setTitle] = React.useState(record?.title ?? "");
  const [fromDate, setFromDate] = React.useState(toDateInput(record?.fromDate));
  const [toDate, setToDate] = React.useState(toDateInput(record?.toDate));
  const { saving, error, run } = useDialogSave(onOpenChange);

  React.useEffect(() => {
    if (open) {
      setCompany(record?.company ?? "");
      setTitle(record?.title ?? "");
      setFromDate(toDateInput(record?.fromDate));
      setToDate(toDateInput(record?.toDate));
    }
  }, [open, record]);

  return (
    <DialogShell
      open={open} onOpenChange={onOpenChange}
      title={record ? "Edit experience" : "Add experience"}
      saving={saving} error={error}
      onSave={() => run(() => upsertWorkHistory({
        employeeId, id: record?.id, company, title, fromDate, toDate,
      }))}
    >
      <EF label="Company" value={company} onChange={setCompany} required />
      <EF label="Title / role" value={title} onChange={setTitle} placeholder="Senior Manager…" />
      <div className="grid gap-3 sm:grid-cols-2">
        <EF label="From" value={fromDate} onChange={setFromDate} type="date" />
        <EF label="To" value={toDate} onChange={setToDate} type="date" />
      </div>
    </DialogShell>
  );
}
