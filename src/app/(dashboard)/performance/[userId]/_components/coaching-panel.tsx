"use client";

// ============================================================
// Coaching & 1:1 panel — log the manager↔report check-in (win / focus /
// action / follow-up) and see the history. The ritual that turns numbers
// into action for building A-players.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessagesSquare, Plus, Trophy, Target, CircleCheck, CalendarClock, Loader2, Star } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { createCoachingNote, completeCoachingNote } from "@/actions/coaching.actions";

interface Note {
  id: string;
  period: string;
  win: string | null;
  focus: string | null;
  actionItem: string | null;
  rating: number | null;
  followUpAt: string | null;
  status: string;
  createdAt: string;
  manager?: { name: string | null } | null;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export function CoachingPanel({ userId, notes, canCoach }: { userId: string; notes: Note[]; canCoach: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [win, setWin] = useState("");
  const [focus, setFocus] = useState("");
  const [actionItem, setActionItem] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [followUpAt, setFollowUpAt] = useState("");

  async function submit() {
    if (!win.trim() && !focus.trim() && !actionItem.trim()) {
      toast.error("Add at least a win, a focus, or an action.");
      return;
    }
    setSaving(true);
    try {
      const res = await createCoachingNote({
        subjectId: userId, win, focus, actionItem,
        rating: rating || null, followUpAt: followUpAt || null,
      });
      if (!res.success) return toast.error(res.error);
      toast.success("1:1 logged");
      setOpen(false);
      setWin(""); setFocus(""); setActionItem(""); setRating(0); setFollowUpAt("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function markDone(id: string) {
    const res = await completeCoachingNote(id);
    if (!res.success) return toast.error(res.error);
    toast.success("Action closed");
    router.refresh();
  }

  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-3 px-5 py-5">
        <div className="flex flex-row items-center justify-between">
        <h2 className="flex items-center gap-2 text-body font-semibold tracking-[-0.01em] text-foreground">
          <MessagesSquare className="size-4 text-muted-foreground" /> Coaching & 1:1s
        </h2>
        {canCoach && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="size-4" /> Log 1:1</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Log a 1:1 check-in</DialogTitle>
                <DialogDescription>One win, one focus, one agreed action — the weekly rhythm that builds A-players.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Trophy className="size-3.5 text-amber-500" /> What went well</Label>
                  <Textarea rows={2} value={win} onChange={(e) => setWin(e.target.value)} placeholder="A win to recognise…" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Target className="size-3.5 text-indigo-500" /> The one thing to improve</Label>
                  <Textarea rows={2} value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="The single focus area…" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><CircleCheck className="size-3.5 text-emerald-500" /> Agreed next action</Label>
                  <Textarea rows={2} value={actionItem} onChange={(e) => setActionItem(e.target.value)} placeholder="What they'll do before the next check-in…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Pulse (1–5)</Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" onClick={() => setRating(n === rating ? 0 : n)}
                          className="p-0.5" aria-label={`Rate ${n}`}>
                          <Star className={`size-5 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Follow-up date</Label>
                    <Input type="date" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Save 1:1
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        </div>
        {notes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No check-ins yet.{canCoach ? " Log the first 1:1 to start the coaching rhythm." : ""}
          </p>
        ) : (
          <ol className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-border/70 p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2 text-detail text-muted-foreground">
                  <span>{n.manager?.name ?? "Manager"} · {fmt(n.createdAt)}</span>
                  <span className="flex items-center gap-2">
                    {n.rating ? <span className="flex items-center gap-0.5 text-amber-500"><Star className="size-3 fill-amber-400" />{n.rating}/5</span> : null}
                    <Badge variant="secondary" className="text-meta">{n.period}</Badge>
                  </span>
                </div>
                <div className="space-y-1.5 text-body">
                  {n.win && (
                    <p className="border-l-2 border-amber-400/80 pl-2.5">
                      <Trophy className="mr-1 inline size-3.5 text-amber-500" />{n.win}
                    </p>
                  )}
                  {n.focus && (
                    <p className="border-l-2 border-indigo-400/80 pl-2.5">
                      <Target className="mr-1 inline size-3.5 text-indigo-500" />{n.focus}
                    </p>
                  )}
                  {n.actionItem && (
                    <p className="flex items-start justify-between gap-2 border-l-2 border-emerald-400/80 pl-2.5">
                      <span><CircleCheck className="mr-1 inline size-3.5 text-emerald-500" />{n.actionItem}</span>
                      {canCoach && n.status === "OPEN" && (
                        <Button variant="ghost" size="sm" className="h-6 shrink-0 px-2 text-meta" onClick={() => markDone(n.id)}>Mark done</Button>
                      )}
                      {n.status === "DONE" && (
                        <Badge className="shrink-0 border-transparent bg-success/15 text-meta text-success">Done</Badge>
                      )}
                    </p>
                  )}
                  {n.followUpAt && (
                    <p className="border-l-2 border-border pl-2.5 text-detail text-muted-foreground">
                      <CalendarClock className="mr-1 inline size-3.5" />Follow up {fmt(n.followUpAt)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
