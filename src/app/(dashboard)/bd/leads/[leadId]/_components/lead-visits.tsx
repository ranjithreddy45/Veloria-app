"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, MapPin, NotebookPen, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import {
  addAcqLeadNote,
  scheduleAcqVisit,
  updateAcqVisit,
  getAcqVisits,
} from "@/actions/acq-visit.actions";

type Visit = {
  id: string;
  type: string;
  scheduledAt: string;
  location: string | null;
  agenda: string | null;
  assignedToName: string | null;
  status: string;
  outcomeNotes: string | null;
  completedAt: string | null;
};

const STATUS_VARIANT: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  CANCELLED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400",
  NO_SHOW: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  RESCHEDULED: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};

function fmt(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function LeadVisits({ leadId, canWrite }: { leadId: string; canWrite: boolean }) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);

  // Schedule form
  const [vtype, setVtype] = React.useState<"SITE_VISIT" | "MEETING">("SITE_VISIT");
  const [when, setWhen] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [agenda, setAgenda] = React.useState("");

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["acq-visits", leadId],
    queryFn: () => getAcqVisits(leadId),
  });
  const visits: Visit[] = data && data.success ? (data.data as Visit[]) : [];

  async function onAddNote() {
    if (!note.trim()) return;
    setPending(true);
    try {
      const r = await addAcqLeadNote(leadId, note);
      if (r.success) {
        setNote("");
        toast.success("Note added");
        router.refresh();
      } else toast.error(r.error);
    } finally {
      setPending(false);
    }
  }

  async function onSchedule() {
    if (!when) {
      toast.error("Pick a date & time");
      return;
    }
    setPending(true);
    try {
      const r = await scheduleAcqVisit({
        leadId,
        type: vtype,
        scheduledAt: new Date(when).toISOString(),
        location: location || undefined,
        agenda: agenda || undefined,
      });
      if (r.success) {
        setWhen("");
        setLocation("");
        setAgenda("");
        toast.success(`${vtype === "MEETING" ? "Meeting" : "Site visit"} scheduled`);
        refetch();
      } else toast.error(r.error);
    } finally {
      setPending(false);
    }
  }

  async function setStatus(id: string, status: string) {
    const r = await updateAcqVisit(id, { status: status as never });
    if (r.success) refetch();
    else toast.error(r.error);
  }

  async function saveOutcome(id: string, outcomeNotes: string) {
    const r = await updateAcqVisit(id, { outcomeNotes });
    if (r.success) {
      toast.success("Notes saved");
      refetch();
    } else toast.error(r.error);
  }

  return (
    <div className="space-y-4">
      {/* Add note */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <NotebookPen className="size-4 text-primary" /> Add a note
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Log a note about this owner / property…"
            disabled={!canWrite || pending}
            rows={2}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={onAddNote} disabled={!canWrite || pending || !note.trim()}>
              <Plus className="size-4" /> Add note
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Notes appear with date &amp; time on the activity timeline below.
          </p>
        </CardContent>
      </Card>

      {/* Schedule + list visits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <CalendarClock className="size-4 text-primary" /> Site visits &amp; meetings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canWrite && (
            <div className="grid gap-2 rounded-xl border border-border/60 p-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={vtype} onValueChange={(v) => setVtype(v as "SITE_VISIT" | "MEETING")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SITE_VISIT">Site visit</SelectItem>
                    <SelectItem value="MEETING">Meeting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date &amp; time</Label>
                <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Location (optional)</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Property / address" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Agenda (optional)</Label>
                <Input value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="What to cover" />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button size="sm" onClick={onSchedule} disabled={pending || !when}>
                  <Plus className="size-4" /> Schedule
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="py-4 text-center text-[13px] text-muted-foreground">Loading…</p>
          ) : visits.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-muted-foreground">No visits or meetings scheduled yet.</p>
          ) : (
            <ul className="space-y-3">
              {visits.map((v) => (
                <li key={v.id} className="rounded-xl border border-border/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{v.type === "MEETING" ? "Meeting" : "Site visit"}</Badge>
                      <span className="text-[13px] font-medium tabular-nums">{fmt(v.scheduledAt)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_VARIANT[v.status] ?? ""}`}>
                        {v.status.replace("_", " ")}
                      </span>
                    </div>
                    {canWrite && (
                      <Select value={v.status} onValueChange={(s) => setStatus(v.id, s)}>
                        <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"].map((s) => (
                            <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {(v.location || v.agenda || v.assignedToName) && (
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                      {v.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{v.location}</span>}
                      {v.agenda && <span>Agenda: {v.agenda}</span>}
                      {v.assignedToName && <span>Owner: {v.assignedToName}</span>}
                    </div>
                  )}
                  <OutcomeEditor
                    initial={v.outcomeNotes ?? ""}
                    disabled={!canWrite}
                    onSave={(text) => saveOutcome(v.id, text)}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OutcomeEditor({ initial, disabled, onSave }: { initial: string; disabled: boolean; onSave: (t: string) => void }) {
  const [text, setText] = React.useState(initial);
  const dirty = text !== initial;
  return (
    <div className="mt-2 space-y-1">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Meeting / visit notes & outcome…"
        rows={2}
        disabled={disabled}
        className="text-[13px]"
      />
      {dirty && !disabled && (
        <div className="flex justify-end">
          <Button size="xs" variant="outline" onClick={() => onSave(text)}>Save notes</Button>
        </div>
      )}
    </div>
  );
}
