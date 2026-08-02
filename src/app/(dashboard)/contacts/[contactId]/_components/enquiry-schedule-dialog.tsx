"use client";

// ============================================================
// Schedule a reminder against an enquiry (Contact) — meeting, call, follow-up
// or other. Goes through the shared scheduleCrmTask action, the same path
// leads use, so the reminder lands on /calendar and notifies the assignee.
// ============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  scheduleCrmTask, getCrmScheduleOptions, type CrmScheduleOptions,
} from "@/actions/crm-task.actions";

const TASK_TYPES = [
  { v: "FOLLOW_UP", l: "Follow-up" },
  { v: "CALL", l: "Call reminder" },
  { v: "MEETING", l: "Meeting" },
  { v: "SHOW_AROUND", l: "Show-around / venue tour" },
  { v: "TASK", l: "Other" },
] as const;

export function EnquiryScheduleDialog({
  contactId,
  onScheduled,
}: {
  contactId: string;
  /** Let the parent refetch — router.refresh() alone won't refresh a client list. */
  onScheduled?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [taskType, setTaskType] = useState<(typeof TASK_TYPES)[number]["v"]>("FOLLOW_UP");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [location, setLocation] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);
  const [opts, setOpts] = useState<CrmScheduleOptions | null>(null);

  useEffect(() => {
    if (open && !opts) getCrmScheduleOptions().then((r) => { if (r.success) setOpts(r.data); });
  }, [open, opts]);

  function toggleInvitee(id: string) {
    setInviteeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    if (!dueDate) { toast.error("Pick a date & time."); return; }
    setBusy(true);
    try {
      const res = await scheduleCrmTask({
        contactId,
        taskType,
        title: title.trim() || TASK_TYPES.find((t) => t.v === taskType)!.l,
        dueDate: new Date(dueDate).toISOString(),
        assigneeId: assigneeId || null,
        metadata: taskType === "SHOW_AROUND"
          ? { ownerId: ownerId || null, ownerInvited: !!ownerId, inviteeIds, location: location || null }
          : null,
      });
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Scheduled — added to the calendar.");
      setOpen(false);
      setTitle(""); setDueDate(""); setAssigneeId(""); setLocation(""); setOwnerId(""); setInviteeIds([]);
      onScheduled?.();
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <CalendarPlus className="size-3.5" /> Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule a reminder</DialogTitle>
          <DialogDescription>
            Blocks the assignee&rsquo;s calendar and sends them a notification.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={taskType} onValueChange={(v) => setTaskType(v as typeof taskType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={TASK_TYPES.find((t) => t.v === taskType)!.l}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">When</Label>
            <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Assign to</Label>
            <Select value={assigneeId || "self"} onValueChange={(v) => setAssigneeId(v === "self" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Me" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="self">Me</SelectItem>
                {(opts?.users ?? []).map((usr) => (
                  <SelectItem key={usr.id} value={usr.id}>{usr.name ?? usr.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {taskType === "SHOW_AROUND" && (
            <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Venue / meeting point" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Invite owner</Label>
                <Select value={ownerId || "none"} onValueChange={(v) => setOwnerId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select owner (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No owner</SelectItem>
                    {(opts?.owners ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs"><Users className="size-3.5" /> Tag internal team</Label>
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border bg-background p-1.5">
                  {(opts?.users ?? []).map((usr) => (
                    <label key={usr.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
                      <input type="checkbox" checked={inviteeIds.includes(usr.id)} onChange={() => toggleInvitee(usr.id)} />
                      <span>{usr.name ?? usr.id}</span>
                      <span className="ml-auto text-meta text-muted-foreground">{usr.role}</span>
                    </label>
                  ))}
                  {!opts && <p className="px-1.5 py-1 text-xs text-muted-foreground">Loading team…</p>}
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />} Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
