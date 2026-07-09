"use client";

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
import { scheduleCrmTask, getCrmScheduleOptions, type CrmScheduleOptions } from "@/actions/crm-task.actions";

const TASK_TYPES = [
  { v: "FOLLOW_UP", l: "Follow-up" },
  { v: "CALL", l: "Call" },
  { v: "MEETING", l: "Meeting" },
  { v: "SHOW_AROUND", l: "Show-around / venue tour" },
  { v: "TASK", l: "Task" },
] as const;

/** Schedule a follow-up / call / meeting / show-around against a lead or enquiry.
 *  Show-around adds an owner invite + internal-team tagging. Lands in the calendar. */
export function ScheduleTaskDialog({ leadId, inquiryId }: { leadId?: string; inquiryId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [taskType, setTaskType] = useState<(typeof TASK_TYPES)[number]["v"]>("FOLLOW_UP");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
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
        leadId, inquiryId, taskType,
        title: title.trim() || TASK_TYPES.find((t) => t.v === taskType)!.l,
        dueDate: new Date(dueDate).toISOString(),
        metadata: taskType === "SHOW_AROUND"
          ? { ownerId: ownerId || null, ownerInvited: !!ownerId, inviteeIds, location: location || null }
          : null,
      });
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Scheduled — added to your calendar.");
      setOpen(false);
      setTitle(""); setDueDate(""); setLocation(""); setOwnerId(""); setInviteeIds([]);
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5"><CalendarPlus className="size-3.5" /> Schedule</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Schedule a follow-up</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={taskType} onValueChange={(v) => setTaskType(v as typeof taskType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TASK_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={TASK_TYPES.find((t) => t.v === taskType)!.l} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">When</Label>
            <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          {taskType === "SHOW_AROUND" && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-2.5">
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
                      <span className="ml-auto text-[10px] text-muted-foreground">{usr.role}</span>
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
