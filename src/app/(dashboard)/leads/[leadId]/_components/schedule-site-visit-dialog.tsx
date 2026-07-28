"use client";

// ============================================================
// "Schedule site visit" — staff-initiated visit/tasting from a lead.
// ------------------------------------------------------------
// Prefills the guest from the lead's contact, picks a venue + IST date/time +
// duration, names a host rep and tags the internal property team (invitee
// picker reused from the SHOW_AROUND flow via getCrmScheduleOptions).
// On submit the server action creates the booking, tags the team (notify +
// calendar) and emails the guest the /visit/<token> invitation.
// ============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  scheduleSiteVisitForLead,
  getLeadVisitVenues,
  type LeadVisitVenueOption,
} from "@/actions/site-visit.actions";
import { getCrmScheduleOptions, type CrmScheduleOptions } from "@/actions/crm-task.actions";
import { SITE_VISIT_KIND_LABEL, SITE_VISIT_DEFAULT_DURATION_MIN } from "@/lib/site-visit/slots";
import { SITE_VISIT_KINDS } from "@/schemas/site-visit.schema";

const DURATIONS = [30, 45, 60, 90, 120, 180] as const;

interface Props {
  leadId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  /** Lead's preferred venue, preselected when set. */
  preferredVenueId: string | null;
  /** Lead owner — the natural default host rep. */
  defaultHostId: string | null;
}

export function ScheduleSiteVisitDialog({
  leadId, customerName, customerPhone, customerEmail, preferredVenueId, defaultHostId,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState<(typeof SITE_VISIT_KINDS)[number]>("SITE_VISIT");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMin, setDurationMin] = useState(String(SITE_VISIT_DEFAULT_DURATION_MIN));
  const [venueId, setVenueId] = useState(preferredVenueId ?? "");
  const [name, setName] = useState(customerName);
  const [phone, setPhone] = useState(customerPhone);
  const [email, setEmail] = useState(customerEmail);
  const [notes, setNotes] = useState("");
  const [hostId, setHostId] = useState(defaultHostId ?? "");
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);

  const [venues, setVenues] = useState<LeadVisitVenueOption[] | null>(null);
  const [opts, setOpts] = useState<CrmScheduleOptions | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!venues) getLeadVisitVenues().then((r) => { if (r.success) setVenues(r.data); });
    if (!opts) getCrmScheduleOptions().then((r) => { if (r.success) setOpts(r.data); });
  }, [open, venues, opts]);

  function toggleInvitee(id: string) {
    setInviteeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    if (!scheduledAt) { toast.error("Pick a date & time."); return; }
    if (!phone.trim()) { toast.error("A contact phone is required for the visit."); return; }
    if (!hostId) { toast.error("Pick a host rep."); return; }
    setBusy(true);
    try {
      // datetime-local is wall-clock in the browser's zone; toISOString() sends
      // the exact instant so the server renders it back in IST.
      const res = await scheduleSiteVisitForLead({
        leadId,
        kind,
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMin: Number(durationMin),
        venueId: venueId || "",
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim(),
        notes: notes.trim(),
        assignedToId: hostId,
        inviteeIds,
      });
      if (!res.success) { toast.error(res.error); return; }
      toast.success(
        res.data.emailSent
          ? "Site visit scheduled — team tagged and invitation emailed."
          : "Site visit scheduled — team tagged and notified."
      );
      setOpen(false);
      setScheduledAt(""); setNotes(""); setInviteeIds([]);
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <CalendarPlus className="size-3.5" /> Schedule site visit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Schedule a site visit</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SITE_VISIT_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>{SITE_VISIT_KIND_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Venue</Label>
              <Select value={venueId || "none"} onValueChange={(v) => setVenueId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not decided</SelectItem>
                  {(venues ?? []).map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">When (IST)</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duration</Label>
              <Select value={durationMin} onValueChange={setDurationMin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Guest</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Required" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Optional — an invitation is emailed when set"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Host rep</Label>
            <Select value={hostId} onValueChange={setHostId}>
              <SelectTrigger><SelectValue placeholder="Select host rep" /></SelectTrigger>
              <SelectContent>
                {(opts?.users ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name ?? u.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Users className="size-3.5" /> Tag property team
            </Label>
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border bg-background p-1.5">
              {(opts?.users ?? []).map((u) => (
                <label
                  key={u.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={inviteeIds.includes(u.id)}
                    onChange={() => toggleInvitee(u.id)}
                  />
                  <span>{u.name ?? u.id}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{u.role}</span>
                </label>
              ))}
              {!opts && <p className="px-1.5 py-1 text-xs text-muted-foreground">Loading team…</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the team should know before the tour"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
            Schedule visit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
