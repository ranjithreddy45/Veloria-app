"use client";

// ============================================================
// Sales → Ops Handover card + Guest Confirmation (48h) indicator.
// ------------------------------------------------------------
// Handover section: schedule / reschedule / complete the post-sale handover
// meeting (24h SLA) via @/actions/handover.actions. Guest-confirmation section
// is display-only — the guest-facing confirm flow is built separately.
// ============================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  HandshakeIcon,
  CalendarClockIcon,
  MapPinIcon,
  VideoIcon,
  CheckCircle2,
  PencilIcon,
  UserCheckIcon,
  AlarmClockIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  scheduleHandoverMeeting,
  completeHandoverMeeting,
  setEventStartAt,
} from "@/actions/handover.actions";

type HandoverStatus = "PENDING" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
type HandoverMode = "PHYSICAL" | "VIRTUAL";

export interface HandoverMeeting {
  id: string;
  bookingId: string;
  scheduledAt: string | null;
  mode: HandoverMode | null;
  meetingUrl: string | null;
  location: string | null;
  agenda: string | null;
  status: HandoverStatus;
  slaDueAt: string | null;
  completedAt?: string | null;
}

export interface HandoverCardProps {
  bookingId: string;
  handover: HandoverMeeting | null;
  guestConfirmationDueAt: string | null;
  guestConfirmedAt: string | null;
  eventStartAt: string | null;
}

const IST = "Asia/Kolkata";

function fmt(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: IST,
  });
}

// Format an ISO instant into the value a <input type="datetime-local"> expects
// (yyyy-MM-ddTHH:mm) rendered in IST, so the picker opens at the saved time.
function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: IST,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// Inverse of toLocalInput: the datetime-local value is IST wall-clock (that's how we
// fill it), so build the absolute instant explicitly as IST = UTC+5:30 — NOT via
// new Date(str), which parses in the BROWSER's zone and skews the saved instant on a
// non-IST device (shifting the reminder anchor).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function istLocalToISO(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)) - IST_OFFSET_MS;
  const dt = new Date(utcMs);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

export function HandoverCard({
  bookingId,
  handover,
  guestConfirmationDueAt,
  guestConfirmedAt,
  eventStartAt,
}: HandoverCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  // ---- Event start time editor ----
  const [editingStart, setEditingStart] = useState(false);
  const [startInput, setStartInput] = useState(toLocalInput(eventStartAt));

  function saveEventStart() {
    if (!startInput) {
      toast.error("Pick a date & time.");
      return;
    }
    const iso = istLocalToISO(startInput);
    if (!iso) {
      toast.error("Pick a valid date & time.");
      return;
    }
    startTransition(async () => {
      const res = await setEventStartAt(bookingId, iso);
      if (res.success) {
        toast.success("Event start time saved");
        setEditingStart(false);
        router.refresh();
      } else {
        toast.error(res.error || "Something went wrong");
      }
    });
  }

  function clearEventStart() {
    startTransition(async () => {
      const res = await setEventStartAt(bookingId, null);
      if (res.success) {
        toast.success("Event start time cleared");
        setEditingStart(false);
        router.refresh();
      } else {
        toast.error(res.error || "Something went wrong");
      }
    });
  }

  const status: HandoverStatus = handover?.status ?? "PENDING";
  const slaOverdue =
    status === "PENDING" &&
    handover?.slaDueAt != null &&
    new Date(handover.slaDueAt).getTime() < Date.now();

  // ---- Dialog form state ----
  const [scheduledAt, setScheduledAt] = useState(
    toLocalInput(handover?.scheduledAt)
  );
  const [mode, setMode] = useState<HandoverMode>(handover?.mode ?? "PHYSICAL");
  const [meetingUrl, setMeetingUrl] = useState(handover?.meetingUrl ?? "");
  const [location, setLocation] = useState(handover?.location ?? "");
  const [agenda, setAgenda] = useState(handover?.agenda ?? "");

  function openDialog() {
    setScheduledAt(toLocalInput(handover?.scheduledAt));
    setMode(handover?.mode ?? "PHYSICAL");
    setMeetingUrl(handover?.meetingUrl ?? "");
    setLocation(handover?.location ?? "");
    setAgenda(handover?.agenda ?? "");
    setOpen(true);
  }

  function submitSchedule() {
    if (!scheduledAt) {
      toast.error("Pick a date & time.");
      return;
    }
    if (mode === "VIRTUAL" && !meetingUrl.trim()) {
      toast.error("A meeting link is required for a virtual meeting.");
      return;
    }
    if (mode === "PHYSICAL" && !location.trim()) {
      toast.error("A location is required for a physical meeting.");
      return;
    }
    const iso = istLocalToISO(scheduledAt);
    if (!iso) {
      toast.error("Pick a valid date & time.");
      return;
    }
    startTransition(async () => {
      const res = await scheduleHandoverMeeting({
        bookingId,
        // datetime-local is IST wall-clock; convert to an absolute instant that's
        // correct regardless of the browser's own timezone.
        scheduledAt: iso,
        mode,
        meetingUrl: mode === "VIRTUAL" ? meetingUrl.trim() : undefined,
        location: mode === "PHYSICAL" ? location.trim() : undefined,
        agenda: agenda.trim() || undefined,
      });
      if (res.success) {
        toast.success("Handover meeting scheduled");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Something went wrong");
      }
    });
  }

  function markCompleted() {
    startTransition(async () => {
      const res = await completeHandoverMeeting(bookingId);
      if (res.success) {
        toast.success("Handover marked completed");
        router.refresh();
      } else {
        toast.error(res.error || "Something went wrong");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <HandshakeIcon className="size-4 text-indigo-600" />
          Sales → Ops Handover
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* ---- Handover section ---- */}
        {status === "PENDING" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-warning/20 bg-warning/10 font-medium text-warning"
              >
                Awaiting schedule
              </Badge>
              {slaOverdue && (
                <Badge
                  variant="outline"
                  className="border-destructive/20 bg-destructive/10 font-medium text-destructive"
                >
                  SLA overdue
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Schedule within 24h of confirmation (SLA)
              {handover?.slaDueAt ? ` · due ${fmt(handover.slaDueAt)}` : ""}
            </p>
            <Button size="sm" onClick={openDialog} disabled={isPending}>
              <CalendarClockIcon className="mr-1.5 size-4" />
              Schedule handover
            </Button>
          </div>
        )}

        {status === "SCHEDULED" && (
          <div className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2.5">
                <CalendarClockIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">{fmt(handover?.scheduledAt)}</span>
              </div>
              <div className="flex items-center gap-2.5">
                {handover?.mode === "VIRTUAL" ? (
                  <>
                    <VideoIcon className="size-4 shrink-0 text-muted-foreground" />
                    {handover?.meetingUrl ? (
                      <a
                        href={handover.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 hover:underline break-all"
                      >
                        {handover.meetingUrl}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Virtual</span>
                    )}
                  </>
                ) : (
                  <>
                    <MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span>{handover?.location || "On-site"}</span>
                  </>
                )}
              </div>
              {handover?.agenda && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="mb-1 text-xs text-muted-foreground">Agenda</p>
                  <p className="whitespace-pre-wrap text-sm">{handover.agenda}</p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={markCompleted} disabled={isPending}>
                <CheckCircle2 className="mr-1.5 size-4" />
                Mark completed
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openDialog}
                disabled={isPending}
              >
                <PencilIcon className="mr-1.5 size-4" />
                Edit
              </Button>
            </div>
          </div>
        )}

        {status === "COMPLETED" && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="gap-1 border-success/20 bg-success/10 font-medium text-success"
            >
              <CheckCircle2 className="size-3" />
              Completed
            </Badge>
            <span className="text-sm text-muted-foreground">
              {fmt(handover?.completedAt ?? handover?.scheduledAt)}
            </span>
          </div>
        )}

        {status === "CANCELLED" && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-slate-300 bg-slate-200 font-medium text-slate-700"
            >
              Cancelled
            </Badge>
            <Button size="sm" variant="outline" onClick={openDialog} disabled={isPending}>
              <CalendarClockIcon className="mr-1.5 size-4" />
              Reschedule
            </Button>
          </div>
        )}

        {/* ---- Guest confirmation (48h) section ---- */}
        <div className="border-t pt-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <UserCheckIcon className="size-4 text-muted-foreground" />
            Guest Confirmation (48h)
          </h3>
          <GuestConfirmationIndicator
            guestConfirmationDueAt={guestConfirmationDueAt}
            guestConfirmedAt={guestConfirmedAt}
          />
        </div>

        {/* ---- Event start time (drives exact reminder timing) ---- */}
        <div className="border-t pt-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <AlarmClockIcon className="size-4 text-muted-foreground" />
            Event start time
          </h3>
          {editingStart ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="event-start-when" className="text-xs">
                  Date &amp; time (IST)
                </Label>
                <Input
                  id="event-start-when"
                  type="datetime-local"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  disabled={isPending}
                />
                <p className="text-xs text-muted-foreground">
                  Precise start time for 48/24/12/4h reminders. Leave unset to
                  use the slot&apos;s default time.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={saveEventStart} disabled={isPending}>
                  Save
                </Button>
                {eventStartAt && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearEventStart}
                    disabled={isPending}
                  >
                    Clear
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStartInput(toLocalInput(eventStartAt));
                    setEditingStart(false);
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {eventStartAt ? (
                <span className="flex items-center gap-2 text-sm">
                  <CalendarClockIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{fmt(eventStartAt)}</span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Not set — reminders use the slot&apos;s default time
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartInput(toLocalInput(eventStartAt));
                  setEditingStart(true);
                }}
                disabled={isPending}
              >
                <PencilIcon className="mr-1.5 size-4" />
                {eventStartAt ? "Edit" : "Set"}
              </Button>
            </div>
          )}
        </div>
      </CardContent>

      {/* ---- Schedule / reschedule dialog ---- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <span className="hidden" aria-hidden />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {status === "SCHEDULED" ? "Reschedule handover" : "Schedule handover"}
            </DialogTitle>
            <DialogDescription>
              Set up the Sales → Ops handover meeting. Attendees are notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="handover-when" className="text-xs">
                Date &amp; time (IST)
              </Label>
              <Input
                id="handover-when"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mode</Label>
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as HandoverMode)}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PHYSICAL">Physical</SelectItem>
                  <SelectItem value="VIRTUAL">Virtual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === "VIRTUAL" && (
              <div className="space-y-1.5">
                <Label htmlFor="handover-url" className="text-xs">
                  Meeting link <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="handover-url"
                  type="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://meet.google.com/…"
                  disabled={isPending}
                />
              </div>
            )}
            {mode === "PHYSICAL" && (
              <div className="space-y-1.5">
                <Label htmlFor="handover-loc" className="text-xs">
                  Location <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="handover-loc"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Ops office, 2nd floor"
                  disabled={isPending}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="handover-agenda" className="text-xs">
                Agenda <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="handover-agenda"
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                placeholder="Points to cover in the handover…"
                rows={3}
                disabled={isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={submitSchedule} disabled={isPending}>
              {status === "SCHEDULED" ? "Save changes" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function GuestConfirmationIndicator({
  guestConfirmationDueAt,
  guestConfirmedAt,
}: {
  guestConfirmationDueAt: string | null;
  guestConfirmedAt: string | null;
}) {
  if (guestConfirmedAt) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="gap-1 border-success/20 bg-success/10 font-medium text-success"
        >
          <CheckCircle2 className="size-3" />
          Confirmed
        </Badge>
        <span className="text-sm text-muted-foreground">
          {fmt(guestConfirmedAt)}
        </span>
      </div>
    );
  }

  if (guestConfirmationDueAt) {
    const due = new Date(guestConfirmationDueAt);
    const msLeft = due.getTime() - Date.now();
    if (msLeft > 0) {
      const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "font-medium",
              hoursLeft <= 12
                ? "border-warning/20 bg-warning/10 text-warning"
                : "border-sky-200 bg-sky-100 text-sky-800"
            )}
          >
            Awaiting guest
          </Badge>
          <span className="text-sm text-muted-foreground">
            Due by {fmt(guestConfirmationDueAt)} · {hoursLeft}h left
          </span>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="border-destructive/20 bg-destructive/10 font-medium text-destructive"
        >
          Confirmation overdue
        </Badge>
        <span className="text-sm text-muted-foreground">
          Was due {fmt(guestConfirmationDueAt)}
        </span>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Guest confirmation not yet initiated.
    </p>
  );
}
