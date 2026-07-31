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
  Camera,
  Handshake,
  Loader2,
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
import { LeadVisits } from "./lead-visits";
import { LeadContacts, type AcqLeadContactRow } from "./lead-contacts";
// Shared notes-on-visits/meetings/calls panel (owned by another agent).
import { AcqSchedulePanel } from "@/app/(dashboard)/bd/_components/acq-schedule-panel";
import { LeadImagesField } from "@/app/(dashboard)/leads/_components/lead-images-field";
import { acqCan } from "@/lib/acq/rbac";
import {
  ACQ_PROPERTY_TYPE,
  ACQ_PROPERTY_TYPE_LABEL,
  ACQ_LEAD_SOURCE,
  ACQ_LEAD_SOURCE_LABEL,
  ACQ_OWNER_TYPE,
  ACQ_DISQUALIFY_REASON,
  ACQ_PROPERTY_STAGE,
  ACQ_PROPERTY_STAGE_LABEL,
  ACQ_LEAD_STATUS_LABEL,
  ACQ_LEAD_STATUS_HUE,
  ACQ_LEAD_STATUS_TRANSITIONS,
  type AcqLeadStatus,
} from "@/lib/acq/constants";
import {
  logAcqLeadContact,
  qualifyAcqLead,
  disqualifyAcqLead,
  editAcqLead,
  reassignAcqLead,
  deleteAcqLead,
  setAcqLeadStatus,
  updateAcqLeadImages,
} from "@/actions/acq-lead.actions";

// ============================================================
// Types
// ============================================================
type Status = AcqLeadStatus;

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
  propertyStage?: string | null;
  notes?: string | null;
  /** Property photos (AcqLead.images) — base64 data-URLs. */
  images?: string[] | null;
  /** Everyone worked on this property, with their role (AcqLeadContact). */
  contacts?: AcqLeadContactRow[];
  parkingAvailable?: boolean | null;
  referrerName?: string | null;
  referrerPhone?: string | null;
  referrerEmail?: string | null;
  brokerageDemand?: string | null;
  leadSource: string;
  ownerType: string;
  status: Status;
  contactAttempts: number;
  nextFollowupAt?: string | null;
  firstContactDue: string;
  firstContactAt?: string | null;
  convertedDealId?: string | null;
  createdAt: string;
  activities?: Array<{
    id: string;
    channel: string;
    outcome: string | null;
    note: string | null;
    actorName: string | null;
    createdAt: string;
  }>;
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

// Hues live in constants so the inbox and this page can never disagree.
const STATUS_HUE = ACQ_LEAD_STATUS_HUE;

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
// Reads the EXACT seating numbers only. The bucketed seatingRange used to be a
// second, contradictory source for this gate; it was retired (item 9).
function seatingIs100Plus(l: AcqLeadFull): boolean {
  return Math.max(num(l.seatingTheatre), num(l.seatingFloating)) >= 100;
}
/** Digits only, for wa.me / tel links. */
function dial(raw: string): string {
  return (raw || "").replace(/[^\d]/g, "");
}
/**
 * `min`/`value` for <input type="datetime-local"> in LOCAL time.
 * `new Date().toISOString()` is UTC — in IST that made `min` 5h30m in the PAST,
 * so the browser happily accepted a follow-up the server then rejected.
 */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
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
  // Qualified / converted / dropped leads are out of the working funnel.
  const isTerminal =
    lead.status === "QUALIFIED" ||
    lead.status === "DEAL_CREATED" ||
    lead.status === "DISQUALIFIED";
  const phone = dial(lead.mobilePrimary);
  const refresh = React.useCallback(() => router.refresh(), [router]);

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
              <Field label="Lead source" value={label(ACQ_LEAD_SOURCE_LABEL, lead.leadSource)} />
              <Field label="Property" value={lead.propertyName} />
              <Field label="Property type" value={label(ACQ_PROPERTY_TYPE_LABEL, lead.propertyType)} />
              <Field label="Property status" value={label(ACQ_PROPERTY_STAGE_LABEL, lead.propertyStage)} />
              <Field label="City" value={lead.city} />
              <Field label="Locality" value={lead.locality} />
              <Field
                label="Seating (theatre / floating)"
                value={`${lead.seatingTheatre ?? "—"} / ${lead.seatingFloating ?? "—"}`}
              />
              <Field
                label="Parking"
                value={lead.parkingAvailable == null ? "—" : lead.parkingAvailable ? "Available" : "Not available"}
              />
              <Field label="BD owner" value={lead.bdExecutive?.name ?? "—"} />
              <Field label="Contact attempts" value={String(lead.contactAttempts)} />
              <Field label="Created" value={fmtDate(lead.createdAt)} />
              <Field label="Next follow-up" value={fmtDate(lead.nextFollowupAt)} />
            </dl>

            {(lead.referrerName || lead.referrerPhone || lead.referrerEmail || lead.brokerageDemand) && (
              <div className="mt-4 rounded-md border border-border/60 bg-muted/30 p-3">
                <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Referral / broker
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  <Field label="Name" value={lead.referrerName || "—"} />
                  <Field label="Phone" value={lead.referrerPhone || "—"} />
                  <Field label="Email" value={lead.referrerEmail || "—"} />
                  <Field label="Brokerage demand" value={lead.brokerageDemand || "—"} />
                </dl>
              </div>
            )}
            {lead.notes && (
              <div className="mt-4 rounded-md border border-border/60 bg-muted/30 p-3 text-[13px]">
                <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Notes
                </div>
                {lead.notes}
              </div>
            )}

            <div className="mt-4">
              <LeadImagesSection lead={lead} canWrite={canWrite} onSaved={refresh} />
            </div>
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
                {lead.status === "DEAL_CREATED" ? (
                  <span className="inline-flex items-center gap-1.5 text-primary">
                    <Handshake className="size-4" /> Deal created
                  </span>
                ) : lead.status === "QUALIFIED" ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <BadgeCheck className="size-4" /> Qualified — no deal yet
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

              {lead.convertedDealId && (
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/bd/deals/${lead.convertedDealId}`}>Open deal</Link>
                </Button>
              )}

              {/* Item 6 — change status. Only the moves the server's state machine
                  allows are offered; qualify/drop stay behind their own gates. */}
              {canWrite && <StatusChanger lead={lead} onDone={refresh} />}

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

      {/* People we work this property through, each with their role */}
      <LeadContacts leadId={lead.id} contacts={lead.contacts ?? []} canWrite={canWrite} />

      {/* Notes + site visits / meetings */}
      <LeadVisits leadId={lead.id} canWrite={canWrite} />

      {/* Notes against site visits / meetings / calls (shared BD panel) */}
      <AcqSchedulePanel scope="lead" id={lead.id} userRole={userRole} onMutate={refresh} />

      {/* Activity timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[15px]">Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lead.activities && lead.activities.length > 0 && (
            <ol className="space-y-3">
              {lead.activities.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-[13px]">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-500" />
                  <div>
                    <div className="text-foreground">
                      {CONTACT_CHANNEL_LABEL[a.channel] ?? a.channel}
                      {a.outcome ? ` · ${CONTACT_OUTCOME_LABEL[a.outcome] ?? a.outcome}` : ""}
                    </div>
                    {a.note && <div className="text-muted-foreground">{a.note}</div>}
                    <div className="text-[11.5px] text-muted-foreground">
                      {fmtDate(a.createdAt)} · {a.actorName ?? "—"}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
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
            !lead.activities?.length && <p className="text-[13px] text-muted-foreground">No activity yet.</p>
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
      {/* Emails and long owner names have no break opportunity, and this dl runs
        * two columns (~165px) on a phone — without break-words they push the
        * card past the viewport edge. */}
      <dd className="text-[13px] break-words text-foreground">{value || "—"}</dd>
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
// Status changer (item 6)
//
// Offers only the transitions the server allows for the current status
// (ACQ_LEAD_STATUS_TRANSITIONS). Qualify → DEAL_CREATED and drop → DISQUALIFIED
// are deliberately absent: they run the qualification checklist / require a drop
// reason, and live on the buttons below. Moving to Contacted collects the
// follow-up date the server insists on, instead of round-tripping an error.
// ------------------------------------------------------------
function StatusChanger({ lead, onDone }: { lead: AcqLeadFull; onDone: () => void }) {
  const allowed = ACQ_LEAD_STATUS_TRANSITIONS[lead.status] ?? [];
  const [target, setTarget] = React.useState<Status | null>(null);
  const [followup, setFollowup] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  if (allowed.length === 0) {
    return (
      <p className="text-[11.5px] text-muted-foreground">
        {lead.status === "DEAL_CREATED" || lead.status === "QUALIFIED"
          ? "Status is set by the deal from here on."
          : "No status change available."}
      </p>
    );
  }

  function pick(next: string) {
    const s = next as Status;
    setTarget(s);
    if (s === "CONTACTED") {
      // Default to tomorrow, same time — local time, never UTC.
      const t = new Date();
      t.setDate(t.getDate() + 1);
      setFollowup(toLocalInputValue(t));
    } else {
      setFollowup("");
    }
  }

  async function save() {
    if (!target) return;
    setBusy(true);
    try {
      const res = await setAcqLeadStatus(lead.id, target, {
        nextFollowupAt: followup ? new Date(followup).toISOString() : undefined,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Status changed to ${ACQ_LEAD_STATUS_LABEL[target]}`);
      setTarget(null);
      onDone();
    } catch {
      toast.error("Couldn't change status — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border/60 p-3">
      <Label className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        Change status
      </Label>
      <Select value={target ?? undefined} onValueChange={pick}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`Currently ${ACQ_LEAD_STATUS_LABEL[lead.status]}…`} />
        </SelectTrigger>
        <SelectContent>
          {allowed.map((s) => (
            <SelectItem key={s} value={s}>
              {ACQ_LEAD_STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {target === "CONTACTED" && (
        <div className="space-y-1.5">
          <Label className="text-[12px]">Next follow-up</Label>
          <Input
            type="datetime-local"
            value={followup}
            min={toLocalInputValue(new Date())}
            onChange={(e) => setFollowup(e.target.value)}
          />
        </div>
      )}
      {target && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setTarget(null)} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={busy || (target === "CONTACTED" && !followup)}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            Save status
          </Button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Property photos on the lead (AcqLead.images) — mirrors the deal-detail panel.
// Persists via updateAcqLeadImages, which ERRORS rather than silently storing []
// when nothing validates.
// ------------------------------------------------------------
function LeadImagesSection({
  lead,
  canWrite,
  onSaved,
}: {
  lead: AcqLeadFull;
  canWrite: boolean;
  onSaved: () => void;
}) {
  const saved = lead.images ?? [];
  const [images, setImages] = React.useState<string[]>(saved);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setImages(lead.images ?? []);
  }, [lead.images]);

  const dirty =
    images.length !== saved.length || images.some((v, i) => v !== saved[i]);

  async function save() {
    setBusy(true);
    try {
      const res = await updateAcqLeadImages(lead.id, images);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Property photos saved");
      onSaved();
    } catch {
      toast.error("Couldn't save — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-border/60 p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          <Camera className="size-3.5" /> Property photos
        </div>
        {canWrite && dirty && (
          <Button size="sm" onClick={save} disabled={busy}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            Save photos
          </Button>
        )}
      </div>
      {canWrite ? (
        <div className="grid gap-4">
          <LeadImagesField value={images} onChange={setImages} />
        </div>
      ) : images.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((src, idx) => (
            <div key={idx} className="aspect-square overflow-hidden rounded-md border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Property photo ${idx + 1}`} className="size-full object-cover" />
            </div>
          ))}
        </div>
      )}
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
          {/* Seating is captured as exact numbers only — the bucketed range was retired. */}
          <L label="Seating — theatre"><Input value={f.seatingTheatre} inputMode="numeric" onChange={(e) => set("seatingTheatre", e.target.value)} /></L>
          <L label="Seating — floating"><Input value={f.seatingFloating} inputMode="numeric" onChange={(e) => set("seatingFloating", e.target.value)} /></L>
          <L label="Lead source"><Picker value={f.leadSource} onChange={(v) => set("leadSource", v)} options={ACQ_LEAD_SOURCE} labels={ACQ_LEAD_SOURCE_LABEL} /></L>
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
    seatingTheatre: l.seatingTheatre != null ? String(l.seatingTheatre) : "",
    seatingFloating: l.seatingFloating != null ? String(l.seatingFloating) : "",
    // A not-yet-migrated WALK_IN row maps onto its replacement so the picker
    // shows a value instead of appearing empty (item 7).
    leadSource: l.leadSource === "WALK_IN" ? "INCOMING_LEAD" : l.leadSource ?? ACQ_LEAD_SOURCE[0],
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
  // bdUsers is already the BD-capable set (exec/head/admin/ops) from the server.
  // Show all of them so the dropdown is never empty; fall back to a clear note
  // if there genuinely are no assignable users.
  const owners = bdUsers;

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
            {owners.length === 0 ? (
              <div className="px-2 py-1.5 text-[12.5px] text-muted-foreground">
                No assignable team members found.
              </div>
            ) : (
              owners.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name ?? "Unnamed"}
                  {u.role ? ` · ${u.role.replaceAll("_", " ")}` : ""}
                </SelectItem>
              ))
            )}
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
const CONTACT_CHANNELS = ["CALL", "WHATSAPP", "EMAIL", "VISIT", "NOTE"] as const;
const CONTACT_CHANNEL_LABEL: Record<string, string> = { CALL: "Call", WHATSAPP: "WhatsApp", EMAIL: "Email", VISIT: "Site visit", NOTE: "Note" };
const CONTACT_OUTCOMES = ["CONNECTED", "NO_ANSWER", "INTERESTED", "NOT_INTERESTED", "CALLBACK", "OTHER"] as const;
const CONTACT_OUTCOME_LABEL: Record<string, string> = { CONNECTED: "Connected", NO_ANSWER: "No answer", INTERESTED: "Interested", NOT_INTERESTED: "Not interested", CALLBACK: "Callback requested", OTHER: "Other" };

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
  const [channel, setChannel] = React.useState("CALL");
  const [outcome, setOutcome] = React.useState("");
  const [note, setNote] = React.useState("");
  const [followup, setFollowup] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) { setChannel("CALL"); setOutcome(""); setNote(""); setFollowup(""); }
  }, [open]);

  async function save() {
    if (!channel) { toast.error("Pick how you contacted them."); return; }
    setBusy(true);
    try {
      const res = await logAcqLeadContact(lead.id, {
        channel,
        outcome: outcome || undefined,
        note: note || undefined,
        nextFollowupAt: followup ? new Date(followup).toISOString() : undefined,
      });
      if (!res.success) { toast.error(res.error); return; }
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
          <DialogDescription>Record the touch — it appears on the timeline, counts as a contact attempt, and clears the first-contact SLA.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <L label="Channel">
            <Picker value={channel} onChange={setChannel} options={[...CONTACT_CHANNELS]} labels={CONTACT_CHANNEL_LABEL} />
          </L>
          <L label="Outcome">
            <Picker value={outcome} onChange={setOutcome} options={[...CONTACT_OUTCOMES]} labels={CONTACT_OUTCOME_LABEL} placeholder="Optional…" />
          </L>
          <L label="Notes">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What was discussed?" />
          </L>
          <L label="Next follow-up (optional)">
            <Input
              type="datetime-local"
              value={followup}
              // LOCAL time: a datetime-local `min` is interpreted in the browser's
              // timezone, so the old toISOString() (UTC) let IST users pick a time
              // 5h30m in the past that the server then rejected.
              min={toLocalInputValue(new Date())}
              onChange={(e) => setFollowup(e.target.value)}
            />
          </L>
        </div>
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
