"use client";

// ============================================================
// AcqSchedulePanel — the ONE scheduling surface shared by the BD lead detail
// page and the BD deal detail page (owner items 8 + 13).
//
// It books calls / site visits / meetings against either a lead or a deal,
// lists them newest-first, lets the owner move the status, and keeps an
// appendable, timestamped note thread per entry so several touches are recorded
// rather than one field being overwritten. The single `outcomeNotes` summary
// field is preserved alongside the thread.
//
// The props contract is imported by two other pages — do not rename or change it.
// ============================================================

import * as React from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  MapPin,
  MessageSquarePlus,
  Phone,
  Plus,
  Trash2,
  Users,
  Pencil,
  Loader2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import { acqCan } from "@/lib/acq/rbac";
import {
  addAcqVisitNote,
  deleteAcqVisit,
  deleteAcqVisitNote,
  getAcqSchedule,
  scheduleAcqVisit,
  updateAcqVisit,
  updateAcqVisitNote,
  type AcqScheduleEntryDTO,
} from "@/actions/acq-visit.actions";
import { getBdUsers } from "@/actions/acq-lead.actions";

// ============================================================
// DATE / TIME CONVERSIONS — all three directions live here so the zone rules
// stay in one readable place. Getting any of these wrong shifts every
// appointment by the viewer's UTC offset (5½ hours in IST).
// ============================================================

/**
 * `<input type="datetime-local">` yields a BARE local wall-clock string
 * ("2026-08-15T14:30") with no zone at all. `new Date()` on the CLIENT parses a
 * bare string as LOCAL time, so `.toISOString()` here produces the true instant.
 * WHY it must happen client-side: if the bare string were sent as-is, the server
 * (Node on Vercel runs in UTC) would parse it as UTC and store an appointment
 * 5½ hours off for an IST user.
 */
function localInputToISO(value: string): string | null {
  if (!value) return null;
  const d = new Date(value); // interpreted in the BROWSER's zone — that's the point
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Build a `datetime-local` string (for `min`/`value`) from LOCAL calendar parts.
 * WHY never `toISOString().slice(0,16)`: that string is UTC but the input reads
 * it as local, so an IST user would see a `min` 5½ hours in the past and a
 * pre-filled time 5½ hours off.
 */
function toLocalInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * A stored instant (ISO with zone) back into a `datetime-local` value. Goes
 * through local wall-clock parts — never a sliced UTC ISO string.
 */
function isoToLocalInputValue(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : toLocalInputValue(d);
}

/** Render a stored instant in the viewer's own zone. */
function fmtInstant(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

// ============================================================
// Vocabulary
// ============================================================

const TYPES = [
  { value: "CALL", label: "Call", icon: Phone },
  { value: "SITE_VISIT", label: "Site visit", icon: MapPin },
  { value: "MEETING", label: "Meeting", icon: Users },
] as const;
type VisitType = (typeof TYPES)[number]["value"];

const STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"] as const;
type VisitStatus = (typeof STATUSES)[number];

const STATUS_HUE: Record<string, Hue> = {
  SCHEDULED: "blue",
  COMPLETED: "emerald",
  CANCELLED: "slate",
  NO_SHOW: "rose",
  RESCHEDULED: "amber",
};

function typeMeta(type: string) {
  return TYPES.find((t) => t.value === type) ?? TYPES[1];
}

function label(v: string): string {
  return v.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

// ============================================================
// AcqSchedulePanel
// ============================================================

export function AcqSchedulePanel({
  scope,
  id,
  userRole,
  onMutate,
}: {
  scope: "lead" | "deal";
  id: string; // leadId when scope === "lead", dealId when scope === "deal"
  userRole?: string;
  onMutate?: () => void;
}): React.ReactElement {
  const canWrite = acqCan(userRole, "lead:write");

  const [entries, setEntries] = React.useState<AcqScheduleEntryDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [users, setUsers] = React.useState<{ id: string; name: string | null }[]>([]);

  // Create form
  const [type, setType] = React.useState<VisitType>("CALL");
  const [when, setWhen] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [agenda, setAgenda] = React.useState("");
  const [assignee, setAssignee] = React.useState<string>("");

  const reload = React.useCallback(async () => {
    const res = await getAcqSchedule(scope, id);
    if (res.success) setEntries(res.data);
    else toast.error(res.error);
    setLoading(false);
  }, [scope, id]);

  React.useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  React.useEffect(() => {
    if (!canWrite) return;
    void getBdUsers()
      .then((u) => setUsers(u.map((x) => ({ id: x.id, name: x.name }))))
      .catch(() => setUsers([]));
  }, [canWrite]);

  // `min` must be built from LOCAL parts (see toLocalInputValue) — a UTC-derived
  // min would let an IST user pick a time the browser considers already past.
  const minWhen = React.useMemo(() => toLocalInputValue(new Date()), []);

  function afterMutate() {
    void reload();
    onMutate?.();
  }

  async function schedule() {
    // Client-side conversion: bare local wall-clock → true instant, so the
    // server never has to guess a zone.
    const iso = localInputToISO(when);
    if (!iso) {
      toast.error("Pick a date & time");
      return;
    }
    setBusy(true);
    try {
      const res = await scheduleAcqVisit({
        ...(scope === "lead" ? { leadId: id } : { dealId: id }),
        type,
        scheduledAt: iso,
        location: location.trim() || undefined,
        agenda: agenda.trim() || undefined,
        assignedToId: assignee || undefined,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setWhen("");
      setLocation("");
      setAgenda("");
      toast.success(`${typeMeta(type).label} scheduled`);
      afterMutate();
    } finally {
      setBusy(false);
    }
  }

  const upcoming = entries.filter((e) => e.status === "SCHEDULED" || e.status === "RESCHEDULED").length;

  return (
    <Card>
      {/* "Calls, site visits & meetings" plus the open/total counter is wider
        * than a phone card, so the header wraps instead of overflowing. */}
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1 space-y-0">
        <CardTitle className="flex items-center gap-2 text-body tracking-[-0.01em]">
          <CalendarClock className="size-4 text-primary" />
          Calls, site visits &amp; meetings
        </CardTitle>
        <span className="text-meta text-muted-foreground">
          <span className="numeric font-medium text-foreground">{upcoming}</span> open ·{" "}
          <span className="numeric">{entries.length}</span> total
        </span>
      </CardHeader>

      <CardContent className="space-y-4">
        {canWrite && (
          <div className="grid gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-meta">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as VisitType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-meta">Date &amp; time</Label>
              <Input
                type="datetime-local"
                value={when}
                min={minWhen}
                onChange={(e) => setWhen(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-meta">
                {type === "CALL" ? "Phone / channel (optional)" : "Location (optional)"}
              </Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={type === "CALL" ? "Owner's mobile / Google Meet" : "Property / address"}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-meta">Assigned to</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Me" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name ?? "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-meta">Agenda (optional)</Label>
              <Input value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="What to cover" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
              <p className="text-meta text-muted-foreground">
                It appears on the assignee&apos;s calendar and can be logged with notes afterwards.
              </p>
              <Button size="sm" onClick={schedule} disabled={busy || !when}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Schedule
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="py-6 text-center text-detail text-muted-foreground">Loading schedule…</p>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-detail text-muted-foreground">
            Nothing scheduled yet. Book a call, site visit or meeting above.
          </p>
        ) : (
          <ul className="space-y-3">
            {entries.map((e) => (
              <ScheduleRow key={e.id} entry={e} canWrite={canWrite} onMutate={afterMutate} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// One schedule entry: header, reschedule, status, summary, note thread
// ============================================================

function ScheduleRow({
  entry,
  canWrite,
  onMutate,
}: {
  entry: AcqScheduleEntryDTO;
  canWrite: boolean;
  onMutate: () => void;
}) {
  const meta = typeMeta(entry.type);
  const Icon = meta.icon;
  const [busy, setBusy] = React.useState(false);
  const [rescheduling, setRescheduling] = React.useState(false);
  // Pre-fill from the STORED INSTANT converted to local wall-clock parts, not a
  // sliced UTC ISO string (which the input would misread as local time).
  const [newWhen, setNewWhen] = React.useState(() => isoToLocalInputValue(entry.scheduledAt));

  const isOpen = entry.status === "SCHEDULED" || entry.status === "RESCHEDULED";
  const overdue = isOpen && new Date(entry.scheduledAt).getTime() < Date.now();

  async function setStatus(status: VisitStatus) {
    setBusy(true);
    try {
      const res = await updateAcqVisit(entry.id, { status });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Marked ${label(status).toLowerCase()}`);
      onMutate();
    } finally {
      setBusy(false);
    }
  }

  async function saveReschedule() {
    // Same client-side wall-clock → instant conversion as the create form.
    const iso = localInputToISO(newWhen);
    if (!iso) {
      toast.error("Pick a valid date & time");
      return;
    }
    setBusy(true);
    try {
      const res = await updateAcqVisit(entry.id, { scheduledAt: iso, status: "RESCHEDULED" });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setRescheduling(false);
      toast.success("Rescheduled");
      onMutate();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this schedule entry and its notes?")) return;
    setBusy(true);
    try {
      const res = await deleteAcqVisit(entry.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Deleted");
      onMutate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-border/60 bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-meta font-medium text-foreground">
            <Icon className="size-3" />
            {meta.label}
          </span>
          <span className={cn("numeric text-body font-medium", overdue ? "text-destructive" : "text-foreground")}>
            {fmtInstant(entry.scheduledAt)}
          </span>
          <StatusPill label={label(entry.status)} hue={STATUS_HUE[entry.status] ?? "neutral"} size="xs" />
          {overdue && <StatusPill label="Overdue" hue="rose" size="xs" />}
        </div>

        {canWrite && (
          <div className="flex items-center gap-1.5">
            <Select value={entry.status} onValueChange={(s) => setStatus(s as VisitStatus)} disabled={busy}>
              <SelectTrigger className="h-8 w-[140px] text-detail">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {label(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="icon-sm"
              variant="ghost"
              title="Reschedule"
              disabled={busy}
              onClick={() => setRescheduling((v) => !v)}
            >
              <CalendarClock className="size-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              title="Delete"
              disabled={busy}
              onClick={remove}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {rescheduling && canWrite && (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-muted/20 p-2">
          {/* Full-width on a phone: a datetime-local renders its own
            * "dd/mm/yyyy, --:-- --" text, which at the 16px minimum iOS forces
            * on inputs no longer fits a fixed 220px box. */}
          <div className="w-full space-y-1 sm:w-auto">
            <Label className="text-meta">New date &amp; time</Label>
            <Input
              type="datetime-local"
              className="h-8 w-full text-detail sm:w-[220px]"
              value={newWhen}
              onChange={(ev) => setNewWhen(ev.target.value)}
            />
          </div>
          <Button size="sm" onClick={saveReschedule} disabled={busy}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRescheduling(false)}>
            Cancel
          </Button>
        </div>
      )}

      {(entry.location || entry.agenda || entry.assignedToName) && (
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-detail text-muted-foreground">
          {entry.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {entry.location}
            </span>
          )}
          {entry.agenda && <span>Agenda: {entry.agenda}</span>}
          {entry.assignedToName && <span>Assigned: {entry.assignedToName}</span>}
        </div>
      )}

      {/* The single running summary field — kept alongside the note thread. */}
      <OutcomeSummary
        visitId={entry.id}
        initial={entry.outcomeNotes ?? ""}
        disabled={!canWrite}
        onSaved={onMutate}
      />

      {/* Appendable note thread (owner item 8) */}
      <NoteThread visitId={entry.id} notes={entry.notes} canWrite={canWrite} onMutate={onMutate} />
    </li>
  );
}

function OutcomeSummary({
  visitId,
  initial,
  disabled,
  onSaved,
}: {
  visitId: string;
  initial: string;
  disabled: boolean;
  onSaved: () => void;
}) {
  const [text, setText] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const dirty = text !== initial;

  async function save() {
    setBusy(true);
    try {
      const res = await updateAcqVisit(visitId, { outcomeNotes: text });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Summary saved");
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-1">
      <Label className="text-meta uppercase tracking-[0.06em] text-muted-foreground">Outcome summary</Label>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="One-line outcome / next step…"
        rows={2}
        disabled={disabled}
        className="text-detail"
      />
      {dirty && !disabled && (
        <div className="flex justify-end">
          <Button size="xs" variant="outline" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save summary"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Note thread — several timestamped touches per entry, each editable/deletable.
// This is the point of item 8: a running record, not one overwritten field.
// ============================================================

function NoteThread({
  visitId,
  notes,
  canWrite,
  onMutate,
}: {
  visitId: string;
  notes: AcqScheduleEntryDTO["notes"];
  canWrite: boolean;
  onMutate: () => void;
}) {
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState("");

  async function add() {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await addAcqVisitNote(visitId, body);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setDraft("");
      onMutate();
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(noteId: string) {
    const body = editText.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await updateAcqVisitNote(noteId, body);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setEditingId(null);
      onMutate();
    } finally {
      setBusy(false);
    }
  }

  async function remove(noteId: string) {
    if (!window.confirm("Delete this note?")) return;
    setBusy(true);
    try {
      const res = await deleteAcqVisitNote(noteId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      onMutate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border/50 bg-muted/20 p-2.5">
      <div className="flex items-center gap-1.5 text-meta font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        <MessageSquarePlus className="size-3.5" />
        Notes
        <span className="numeric font-normal normal-case tracking-normal">({notes.length})</span>
      </div>

      {notes.length > 0 && (
        <ol className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border border-border/50 bg-card px-2.5 py-2">
              {editingId === n.id ? (
                <div className="space-y-1.5">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className="text-detail"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="xs" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="size-3" /> Cancel
                    </Button>
                    <Button size="xs" onClick={() => saveEdit(n.id)} disabled={busy || !editText.trim()}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-detail leading-relaxed text-foreground">{n.body}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-meta text-muted-foreground">
                    <span className="font-medium">{n.authorName ?? "Unknown"}</span>
                    <span aria-hidden>·</span>
                    <span className="numeric">{fmtRelative(n.createdAt)}</span>
                    {n.editedAt && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="italic">edited {fmtRelative(n.editedAt)}</span>
                      </>
                    )}
                    {canWrite && (
                      <span className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          onClick={() => {
                            setEditingId(n.id);
                            setEditText(n.body);
                          }}
                        >
                          <Pencil className="size-3" /> Edit
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-destructive hover:underline"
                          onClick={() => remove(n.id)}
                        >
                          <Trash2 className="size-3" /> Delete
                        </button>
                      </span>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ol>
      )}

      {canWrite && (
        <div className="space-y-1.5">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="What happened on this call / visit? Add a note — earlier notes are kept."
            className="text-detail"
          />
          <div className="flex justify-end">
            <Button size="xs" variant="outline" onClick={add} disabled={busy || !draft.trim()}>
              {busy ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
              Add note
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
