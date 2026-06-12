"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  Mail,
  Pencil,
  UserCog,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/shared/status-pill";
import { acqCan } from "@/lib/acq/rbac";
import {
  ACQ_PROPERTY_TYPE,
  ACQ_PROPERTY_TYPE_LABEL,
  ACQ_LEAD_SOURCE,
  ACQ_OWNER_TYPE,
  ACQ_DISQUALIFY_REASON,
  ACQ_SEATING_RANGE,
  ACQ_SEATING_RANGE_LABEL,
  ACQ_PROPERTY_STAGE,
  ACQ_PROPERTY_STAGE_LABEL,
  ACQ_LEAD_STATUS_LABEL,
} from "@/lib/acq/constants";
import {
  updateAcqLead,
  qualifyAcqLead,
  disqualifyAcqLead,
  editAcqLead,
  reassignAcqLead,
  deleteAcqLead,
} from "@/actions/acq-lead.actions";

// ============================================================
// Types
// ============================================================
type Status = "NEW" | "CONTACTED" | "QUALIFIED" | "DISQUALIFIED";

export interface BdUser {
  id: string;
  name: string | null;
  role: string;
}

export interface AcqLeadFull {
  id: string;
  ownerName: string;
  mobilePrimary: string;
  mobileAlternate?: string | null;
  email?: string | null;
  propertyName: string;
  propertyType: string;
  city: string;
  locality: string;
  seatingTheatre?: number | null;
  seatingFloating?: number | null;
  seatingRange?: string | null;
  propertyStage?: string | null;
  notes?: string | null;
  leadSource: string;
  ownerType: string;
  status: Status;
  contactAttempts: number;
  nextFollowupAt?: string | null;
  firstContactDue: string;
  convertedDealId?: string | null;
  createdAt: string;
  bdExecutive?: { id: string; name: string | null } | null;
  deal?: { id: string; stage: string } | null;
  qualSeating100?: boolean | null;
  qualOwnerInterested?: boolean | null;
  qualAgreeRenovate?: boolean | null;
  qualPhotosReady?: boolean | null;
  timeline?: Array<{
    id: string;
    fromState: string | null;
    toState: string;
    reason: string | null;
    createdAt: string;
    actor?: { name: string | null } | null;
  }>;
}

const STATUS_HUE: Record<Status, "slate" | "blue" | "emerald" | "rose"> = {
  NEW: "slate",
  CONTACTED: "blue",
  QUALIFIED: "emerald",
  DISQUALIFIED: "rose",
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function label(map: Record<string, string>, v?: string | null): string {
  if (!v) return "—";
  return map[v] ?? v.replaceAll("_", " ");
}
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function seatingIs100Plus(l: AcqLeadFull): boolean {
  const cap = Math.max(num(l.seatingTheatre), num(l.seatingFloating));
  if (cap >= 100) return true;
  return !!l.seatingRange && l.seatingRange !== "R_50_100";
}
/** Digits only, for wa.me / tel links. */
function dial(raw: string): string {
  return (raw || "").replace(/[^\d]/g, "");
}

// ============================================================
// Component
// ============================================================
export function LeadDetail({
  lead,
  bdUsers,
  userRole,
}: {
  lead: AcqLeadFull;
  bdUsers: BdUser[];
  userRole?: string;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [reassignOpen, setReassignOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [qualifyOpen, setQualifyOpen] = React.useState(false);
  const [contactOpen, setContactOpen] = React.useState(false);
  const [disqualifyOpen, setDisqualifyOpen] = React.useState(false);

  const canReassign = acqCan(userRole, "lead:reassign");
  const canDelete = acqCan(userRole, "lead:delete");
  const canWrite = acqCan(userRole, "lead:write");
  const isTerminal = lead.status === "QUALIFIED" || lead.status === "DISQUALIFIED";
  const phone = dial(lead.mobilePrimary);

  return (
    <div className="flex flex-col gap-5">
      {/* Back + header */}
      <div>
        <Link
          href="/bd/leads"
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to Leads
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-semibold tracking-tight text-foreground">
                {lead.propertyName}
              </h1>
              <StatusPill
                label={ACQ_LEAD_STATUS_LABEL[lead.status]}
                hue={STATUS_HUE[lead.status]}
                size="xs"
              />
            </div>
            <p className="text-[13px] text-muted-foreground">
              {lead.ownerName} · {label(ACQ_PROPERTY_TYPE_LABEL, lead.propertyType)} ·{" "}
              {lead.city} · {lead.locality}
            </p>
          </div>
          {/* Manage */}
          <div className="flex flex-wrap items-center gap-2">
            {canWrite && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="size-3.5" /> Edit
              </Button>
            )}
            {canReassign && (
              <Button variant="outline" size="sm" onClick={() => setReassignOpen(true)}>
                <UserCog className="size-3.5" /> Reassign
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-3.5" /> Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Quick contact actions */}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="gap-1.5">
          <a href={`tel:+${phone}`}>
            <Phone className="size-3.5" /> Call
          </a>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-3.5" /> WhatsApp
          </a>
        </Button>
        {lead.email && (
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <a href={`mailto:${lead.email}`}>
              <Mail className="size-3.5" /> Email
            </a>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-[15px]">Lead details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Field label="Owner" value={lead.ownerName} />
              <Field label="Owner type" value={label({}, lead.ownerType)} />
              <Field label="Primary mobile" value={lead.mobilePrimary} />
              <Field label="Alternate" value={lead.mobileAlternate || "—"} />
              <Field label="Email" value={lead.email || "—"} />
              <Field label="Lead source" value={label({}, lead.leadSource)} />
              <Field label="Property" value={lead.propertyName} />
              <Field label="Property type" value={label(ACQ_PROPERTY_TYPE_LABEL, lead.propertyType)} />
              <Field label="Property status" value={label(ACQ_PROPERTY_STAGE_LABEL, lead.propertyStage)} />
              <Field label="City" value={lead.city} />
              <Field label="Locality" value={lead.locality} />
              <Field
                label="Seating range"
                value={label(ACQ_SEATING_RANGE_LABEL, lead.seatingRange)}
              />
              <Field
                label="Seating (theatre / floating)"
                value={`${lead.seatingTheatre ?? "—"} / ${lead.seatingFloating ?? "—"}`}
              />
              <Field label="BD owner" value={lead.bdExecutive?.name ?? "—"} />
              <Field label="Contact attempts" value={String(lead.contactAttempts)} />
              <Field label="Created" value={fmtDate(lead.createdAt)} />
              <Field label="Next follow-up" value={fmtDate(lead.nextFollowupAt)} />
            </dl>
            {lead.notes && (
              <div className="mt-4 rounded-md border border-border/60 bg-muted/30 p-3 text-[13px]">
                <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Notes
                </div>
                {lead.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status + workflow */}
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-[15px]">Status & actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-[13px]">
                {lead.status === "QUALIFIED" ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <BadgeCheck className="size-4" /> Qualified — deal created
                  </span>
                ) : lead.status === "DISQUALIFIED" ? (
                  <span className="inline-flex items-center gap-1.5 text-rose-600">
                    <XCircle className="size-4" /> Dropped
                  </span>
                ) : lead.status === "CONTACTED" ? (
                  <span className="inline-flex items-center gap-1.5 text-blue-700">
                    <CheckCircle2 className="size-4" /> Contacted — follow-up{" "}
                    {fmtDate(lead.nextFollowupAt)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="size-4" /> New — not contacted yet
                  </span>
                )}
              </div>

              {lead.status === "QUALIFIED" && lead.convertedDealId && (
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/bd/deals/${lead.convertedDealId}`}>Open deal</Link>
                </Button>
              )}

              {!isTerminal && canWrite && (
                <div className="grid gap-2">
                  <Button size="sm" onClick={() => setContactOpen(true)} variant="outline">
                    <Phone className="size-3.5" /> Log contact
                  </Button>
                  <Button size="sm" onClick={() => setQualifyOpen(true)}>
                    Qualify lead
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setDisqualifyOpen(true)}
                  >
                    Drop lead
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Qualification checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[15px]">Qualification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              <CriterionRow ok={lead.qualSeating100 ?? seatingIs100Plus(lead)} text="Seating 100+" />
              <CriterionRow ok={lead.qualOwnerInterested} text="Interested in management model" />
              <CriterionRow ok={lead.qualAgreeRenovate} text="Agrees to renovate if required" />
              <CriterionRow ok={lead.qualPhotosReady} text="Photos available" />
              {lead.status !== "QUALIFIED" && (
                <p className="pt-1 text-[11.5px] text-muted-foreground">
                  Confirm all four when qualifying.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activity timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[15px]">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {lead.timeline && lead.timeline.length > 0 ? (
            <ol className="space-y-3">
              {lead.timeline.map((t) => (
                <li key={t.id} className="flex items-start gap-3 text-[13px]">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground/40" />
                  <div>
                    <div className="text-foreground">
                      {t.fromState ? `${t.fromState} → ` : ""}
                      {t.toState}
                      {t.reason ? ` · ${t.reason}` : ""}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      {fmtDate(t.createdAt)} · {t.actor?.name ?? "system"}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-muted-foreground">No activity yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <EditLeadDialog lead={lead} open={editOpen} onOpenChange={setEditOpen} />
      <ReassignDialog
        lead={lead}
        bdUsers={bdUsers}
        open={reassignOpen}
        onOpenChange={setReassignOpen}
      />
      <DeleteDialog lead={lead} open={deleteOpen} onOpenChange={setDeleteOpen} />
      <QualifyDialog lead={lead} open={qualifyOpen} onOpenChange={setQualifyOpen} />
      <LogContactDialog lead={lead} open={contactOpen} onOpenChange={setContactOpen} />
      <DisqualifyDialog lead={lead} open={disqualifyOpen} onOpenChange={setDisqualifyOpen} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">{label}</dt>
      <dd className="text-[13px] text-foreground">{value || "—"}</dd>
    </div>
  );
}

function CriterionRow({ ok, text }: { ok?: boolean | null; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="size-4 text-emerald-600" />
      ) : (
        <XCircle className="size-4 text-muted-foreground/40" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{text}</span>
    </div>
  );
}

// ------------------------------------------------------------
// Edit dialog
// ------------------------------------------------------------
function EditLeadDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: AcqLeadFull;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [f, setF] = React.useState(() => toForm(lead));
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) setF(toForm(lead));
  }, [open, lead]);

  function set<K extends keyof ReturnType<typeof toForm>>(k: K, v: string) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function save() {
    setBusy(true);
    try {
      const res = await editAcqLead(lead.id, {
        ownerName: f.ownerName.trim(),
        mobilePrimary: f.mobilePrimary.trim(),
        mobileAlternate: f.mobileAlternate.trim(),
        email: f.email.trim(),
        propertyName: f.propertyName.trim(),
        propertyType: f.propertyType as (typeof ACQ_PROPERTY_TYPE)[number],
        city: f.city.trim(),
        locality: f.locality.trim(),
        seatingTheatre: f.seatingTheatre ? Number(f.seatingTheatre) : null,
        seatingFloating: f.seatingFloating ? Number(f.seatingFloating) : null,
        seatingRange: f.seatingRange ? (f.seatingRange as (typeof ACQ_SEATING_RANGE)[number]) : null,
        propertyStage: f.propertyStage ? (f.propertyStage as (typeof ACQ_PROPERTY_STAGE)[number]) : null,
        leadSource: f.leadSource as (typeof ACQ_LEAD_SOURCE)[number],
        ownerType: f.ownerType as (typeof ACQ_OWNER_TYPE)[number],
        notes: f.notes.trim(),
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Lead updated");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Couldn't save — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit lead</DialogTitle>
          <DialogDescription>{lead.propertyName}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
          <L label="Owner name"><Input value={f.ownerName} onChange={(e) => set("ownerName", e.target.value)} /></L>
          <L label="Primary mobile"><Input value={f.mobilePrimary} onChange={(e) => set("mobilePrimary", e.target.value)} /></L>
          <L label="Alternate mobile"><Input value={f.mobileAlternate} onChange={(e) => set("mobileAlternate", e.target.value)} /></L>
          <L label="Email"><Input value={f.email} onChange={(e) => set("email", e.target.value)} /></L>
          <L label="Property name"><Input value={f.propertyName} onChange={(e) => set("propertyName", e.target.value)} /></L>
          <L label="Property type"><Picker value={f.propertyType} onChange={(v) => set("propertyType", v)} options={ACQ_PROPERTY_TYPE} labels={ACQ_PROPERTY_TYPE_LABEL} /></L>
          <L label="City"><Input value={f.city} onChange={(e) => set("city", e.target.value)} /></L>
          <L label="Locality"><Input value={f.locality} onChange={(e) => set("locality", e.target.value)} /></L>
          <L label="Property status"><Picker value={f.propertyStage} onChange={(v) => set("propertyStage", v)} options={ACQ_PROPERTY_STAGE} labels={ACQ_PROPERTY_STAGE_LABEL} placeholder="Select…" /></L>
          <L label="Seating range"><Picker value={f.seatingRange} onChange={(v) => set("seatingRange", v)} options={ACQ_SEATING_RANGE} labels={ACQ_SEATING_RANGE_LABEL} placeholder="Select…" /></L>
          <L label="Seating — theatre"><Input value={f.seatingTheatre} inputMode="numeric" onChange={(e) => set("seatingTheatre", e.target.value)} /></L>
          <L label="Seating — floating"><Input value={f.seatingFloating} inputMode="numeric" onChange={(e) => set("seatingFloating", e.target.value)} /></L>
          <L label="Lead source"><Picker value={f.leadSource} onChange={(v) => set("leadSource", v)} options={ACQ_LEAD_SOURCE} /></L>
          <L label="Owner type"><Picker value={f.ownerType} onChange={(v) => set("ownerType", v)} options={ACQ_OWNER_TYPE} /></L>
          <div className="sm:col-span-2">
            <L label="Notes"><Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={3} /></L>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toForm(l: AcqLeadFull) {
  return {
    ownerName: l.ownerName ?? "",
    mobilePrimary: l.mobilePrimary ?? "",
    mobileAlternate: l.mobileAlternate ?? "",
    email: l.email ?? "",
    propertyName: l.propertyName ?? "",
    propertyType: l.propertyType ?? ACQ_PROPERTY_TYPE[0],
    city: l.city ?? "",
    locality: l.locality ?? "",
    propertyStage: l.propertyStage ?? "",
    seatingRange: l.seatingRange ?? "",
    seatingTheatre: l.seatingTheatre != null ? String(l.seatingTheatre) : "",
    seatingFloating: l.seatingFloating != null ? String(l.seatingFloating) : "",
    leadSource: l.leadSource ?? ACQ_LEAD_SOURCE[0],
    ownerType: l.ownerType ?? ACQ_OWNER_TYPE[0],
    notes: l.notes ?? "",
  };
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px]">{label}</Label>
      {children}
    </div>
  );
}

function Picker({
  value,
  onChange,
  options,
  labels,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  labels?: Record<string, string>;
  placeholder?: string;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder ?? "Select…"} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {labels?.[o] ?? o.replaceAll("_", " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ------------------------------------------------------------
// Reassign dialog
// ------------------------------------------------------------
function ReassignDialog({
  lead,
  bdUsers,
  open,
  onOpenChange,
}: {
  lead: AcqLeadFull;
  bdUsers: BdUser[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [target, setTarget] = React.useState(lead.bdExecutive?.id ?? "");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) setTarget(lead.bdExecutive?.id ?? "");
  }, [open, lead]);
  // Only BD execs/heads can OWN a lead.
  const owners = bdUsers.filter((u) => u.role === "BD_EXECUTIVE" || u.role === "BD_HEAD");

  async function save() {
    if (!target) return;
    setBusy(true);
    try {
      const res = await reassignAcqLead(lead.id, target);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Lead reassigned");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Couldn't reassign — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign lead owner</DialogTitle>
          <DialogDescription>Change who owns {lead.propertyName}.</DialogDescription>
        </DialogHeader>
        <Select value={target || undefined} onValueChange={setTarget}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Select BD owner…" /></SelectTrigger>
          <SelectContent>
            {owners.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name ?? "Unnamed"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || !target}>{busy ? "Saving…" : "Reassign"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------
// Delete dialog
// ------------------------------------------------------------
function DeleteDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: AcqLeadFull;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function confirmDelete() {
    setBusy(true);
    try {
      const res = await deleteAcqLead(lead.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Lead deleted");
      router.push("/bd/leads");
    } catch {
      toast.error("Couldn't delete — please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this lead?</DialogTitle>
          <DialogDescription>
            {lead.propertyName} will be removed. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button
            onClick={confirmDelete}
            disabled={busy}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {busy ? "Deleting…" : "Delete lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------
// Qualify dialog (4 criteria)
// ------------------------------------------------------------
const QUAL_FIELDS = [
  { key: "seating_100_plus", label: "Seating capacity is 100+" },
  { key: "owner_interested_in_management_model", label: "Owner is interested in the Veloria management model" },
  { key: "agrees_to_renovate_if_required", label: "Agrees to renovate the venue if required" },
  { key: "required_photos_available", label: "Photos available (interiors, exterior, washrooms, dressing rooms)" },
] as const;
type QualKey = (typeof QUAL_FIELDS)[number]["key"];

function QualifyDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: AcqLeadFull;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [checks, setChecks] = React.useState<Record<QualKey, boolean>>({
    seating_100_plus: false,
    owner_interested_in_management_model: false,
    agrees_to_renovate_if_required: false,
    required_photos_available: false,
  });
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setChecks({
        seating_100_plus: seatingIs100Plus(lead),
        owner_interested_in_management_model: false,
        agrees_to_renovate_if_required: false,
        required_photos_available: false,
      });
    }
  }, [open, lead]);
  const allChecked = QUAL_FIELDS.every((f) => checks[f.key]);

  async function qualify() {
    if (!allChecked) return;
    setBusy(true);
    try {
      const res = await qualifyAcqLead(lead.id, checks);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Lead qualified — deal created");
      onOpenChange(false);
      router.push(`/bd/deals/${res.data.dealId}`);
    } catch {
      toast.error("Couldn't qualify — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Qualify lead</DialogTitle>
          <DialogDescription>All four must be confirmed to qualify.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2.5 text-[13px]">
          {QUAL_FIELDS.map((f) => (
            <label
              key={f.key}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/40"
            >
              <Checkbox
                checked={checks[f.key]}
                onCheckedChange={(v) => setChecks((p) => ({ ...p, [f.key]: !!v }))}
              />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={qualify} disabled={busy || !allChecked}>
            {busy ? "Qualifying…" : "Qualify & create deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------
// Log contact dialog
// ------------------------------------------------------------
function LogContactDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: AcqLeadFull;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [followup, setFollowup] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) setFollowup("");
  }, [open]);

  async function save() {
    if (!followup) {
      toast.error("Pick a follow-up date.");
      return;
    }
    setBusy(true);
    try {
      const res = await updateAcqLead(lead.id, {
        status: "CONTACTED",
        nextFollowupAt: new Date(followup).toISOString(),
        incrementContactAttempt: true,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Contact logged");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Couldn't save — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log contact</DialogTitle>
          <DialogDescription>Marks the lead Contacted and schedules a follow-up.</DialogDescription>
        </DialogHeader>
        <L label="Next follow-up">
          <Input
            type="datetime-local"
            value={followup}
            min={new Date().toISOString().slice(0, 16)}
            onChange={(e) => setFollowup(e.target.value)}
          />
        </L>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Log contact"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------
// Disqualify (drop) dialog
// ------------------------------------------------------------
function DisqualifyDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: AcqLeadFull;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) setReason("");
  }, [open]);

  async function drop() {
    if (!reason) {
      toast.error("Select a reason.");
      return;
    }
    setBusy(true);
    try {
      const res = await disqualifyAcqLead(
        lead.id,
        reason as (typeof ACQ_DISQUALIFY_REASON)[number]
      );
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Lead dropped");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Couldn't drop — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Drop lead</DialogTitle>
          <DialogDescription>Why is this lead being dropped?</DialogDescription>
        </DialogHeader>
        <Select value={reason || undefined} onValueChange={setReason}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Select reason…" /></SelectTrigger>
          <SelectContent>
            {ACQ_DISQUALIFY_REASON.map((r) => (
              <SelectItem key={r} value={r}>{r.replaceAll("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={drop} disabled={busy} className="bg-red-600 text-white hover:bg-red-700">
            {busy ? "Dropping…" : "Drop lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
