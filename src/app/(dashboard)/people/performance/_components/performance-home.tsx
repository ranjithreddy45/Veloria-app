"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, Target, Star, Users, Settings2, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDate } from "@/lib/utils";
import {
  addGoal, updateGoal, deleteGoal, submitReview, createCycle, setCycleStatus,
} from "@/actions/hr-performance.actions";

interface Cycle { id: string; name: string; status: string; startDate: string; endDate: string; ratingMax: number }
interface Goal { id: string; title: string; description: string | null; weight: number; status: string; selfRating: number | null; managerRating: number | null }
interface Review { id: string; kind: string; status: string; rating: number | null; strengths: string | null; improvements: string | null; comments: string | null }
interface QueueRow { id: string; firstName: string; lastName: string; empCode: string; reviewed: boolean }

const GOAL_STATUS_HUE: Record<string, "slate" | "amber" | "emerald"> = { NOT_STARTED: "slate", IN_PROGRESS: "amber", COMPLETED: "emerald" };
const GOAL_STATUS_LABEL: Record<string, string> = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", COMPLETED: "Completed" };

export function PerformanceHome({
  employeeId, cycle, goals, reviews, cycles, reviewQueue, reviewCycleId, canAdmin,
}: {
  employeeId: string | null; cycle: Cycle | null; goals: Goal[]; reviews: Review[];
  cycles: Cycle[]; reviewQueue: QueueRow[]; reviewCycleId: string | null; canAdmin: boolean;
}) {
  const selfReview = reviews.find((r) => r.kind === "SELF");
  const mgrReview = reviews.find((r) => r.kind === "MANAGER");
  const ratingMax = cycle?.ratingMax ?? 5;

  return (
    <Tabs defaultValue="mine">
      <TabsList>
        <TabsTrigger value="mine" className="gap-1.5"><Target className="size-3.5" /> My appraisal</TabsTrigger>
        <TabsTrigger value="team" className="gap-1.5"><Users className="size-3.5" /> Team reviews{reviewQueue.filter((r) => !r.reviewed).length ? ` (${reviewQueue.filter((r) => !r.reviewed).length})` : ""}</TabsTrigger>
        {canAdmin && <TabsTrigger value="cycles" className="gap-1.5"><Settings2 className="size-3.5" /> Cycles</TabsTrigger>}
      </TabsList>

      {/* MY APPRAISAL */}
      <TabsContent value="mine" className="space-y-4">
        {!cycle ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-[13px] text-muted-foreground">No active appraisal cycle right now.</div>
        ) : !employeeId ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-[13px] text-muted-foreground">Your account isn’t linked to an employee record.</div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="text-[13px] text-muted-foreground">
                <span className="font-medium text-foreground">{cycle.name}</span> · {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
              </div>
              <AddGoalDialog employeeId={employeeId} cycleId={cycle.id} />
            </div>
            <div className="rounded-xl border bg-card">
              <div className="border-b px-4 py-2.5 text-[13px] font-semibold">Goals / KRAs</div>
              {goals.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No goals yet. Add your KRAs for this cycle.</div>
              ) : (
                <div className="divide-y">
                  {goals.map((g) => <GoalRow key={g.id} goal={g} ratingMax={ratingMax} canSelfRate />)}
                </div>
              )}
            </div>
            <SelfReviewCard cycleId={cycle.id} employeeId={employeeId} ratingMax={ratingMax} existing={selfReview} />
            {mgrReview?.status === "SUBMITTED" && (
              <div className="rounded-xl border bg-card p-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><Star className="size-4 text-[#C9A96E]" /> Manager review</h3>
                <p className="text-[13px]">Overall rating: <span className="font-semibold tabular-nums">{mgrReview.rating ?? "—"}/{ratingMax}</span></p>
                {mgrReview.strengths && <p className="mt-1.5 text-[13px]"><span className="text-muted-foreground">Strengths: </span>{mgrReview.strengths}</p>}
                {mgrReview.improvements && <p className="mt-1 text-[13px]"><span className="text-muted-foreground">To improve: </span>{mgrReview.improvements}</p>}
                {mgrReview.comments && <p className="mt-1 text-[13px] text-muted-foreground">{mgrReview.comments}</p>}
              </div>
            )}
          </>
        )}
      </TabsContent>

      {/* TEAM REVIEWS (manager) */}
      <TabsContent value="team" className="space-y-3">
        {!reviewCycleId ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-[13px] text-muted-foreground">No active cycle.</div>
        ) : reviewQueue.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-[13px] text-muted-foreground">You have no direct reports to review.</div>
        ) : (
          reviewQueue.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
              <div>
                <Link href={`/people/${r.id}`} className="font-medium hover:underline">{r.firstName} {r.lastName}</Link>
                <span className="ml-2 text-[12px] text-muted-foreground">{r.empCode}</span>
              </div>
              {r.reviewed
                ? <span className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-600"><CheckCircle2 className="size-4" /> Reviewed</span>
                : <ManagerReviewDialog cycleId={reviewCycleId} employee={r} ratingMax={ratingMax} />}
            </div>
          ))
        )}
      </TabsContent>

      {/* CYCLES (admin) */}
      {canAdmin && (
        <TabsContent value="cycles" className="space-y-3">
          <div className="flex justify-end"><CreateCycleDialog /></div>
          {cycles.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-[13px] text-muted-foreground">No appraisal cycles yet.</div>
          ) : (
            <div className="space-y-2.5">
              {cycles.map((c) => <CycleRow key={c.id} cycle={c} />)}
            </div>
          )}
        </TabsContent>
      )}
    </Tabs>
  );
}

function GoalRow({ goal, ratingMax, canSelfRate }: { goal: Goal; ratingMax: number; canSelfRate?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function patch(input: Record<string, unknown>) {
    setBusy(true); await updateGoal(goal.id, input); setBusy(false); router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{goal.title}</span>
          {goal.weight > 0 && <span className="text-[11.5px] text-muted-foreground">· {goal.weight}%</span>}
        </div>
        {goal.description && <p className="text-[12.5px] text-muted-foreground">{goal.description}</p>}
      </div>
      {busy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      <Select value={goal.status} onValueChange={(v) => patch({ status: v })}>
        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(GOAL_STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
      {canSelfRate && (
        <Select value={goal.selfRating?.toString() ?? ""} onValueChange={(v) => patch({ selfRating: Number(v) })}>
          <SelectTrigger className="h-8 w-24"><SelectValue placeholder="Self" /></SelectTrigger>
          <SelectContent>{Array.from({ length: ratingMax }, (_, i) => i + 1).map((n) => <SelectItem key={n} value={String(n)}>{n}/{ratingMax}</SelectItem>)}</SelectContent>
        </Select>
      )}
      <StatusPill label={GOAL_STATUS_LABEL[goal.status]} hue={GOAL_STATUS_HUE[goal.status]} size="xs" />
      <Button
        variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-red-600" disabled={busy}
        onClick={async () => { setBusy(true); await deleteGoal(goal.id); setBusy(false); router.refresh(); }}
        title="Delete goal"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function AddGoalDialog({ employeeId, cycleId }: { employeeId: string; cycleId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [weight, setWeight] = React.useState("");

  async function save() {
    setError(null);
    if (!title.trim()) { setError("Title required."); return; }
    setSaving(true);
    const res = await addGoal({ employeeId, cycleId, title, description: description || undefined, weight: weight ? Number(weight) : undefined });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false); setTitle(""); setDescription(""); setWeight("");
    router.refresh();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add goal</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add goal / KRA</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-[12.5px]">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">Weight (%)</Label><Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1.5">{saving && <Loader2 className="size-4 animate-spin" />} Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SelfReviewCard({ cycleId, employeeId, ratingMax, existing }: { cycleId: string; employeeId: string; ratingMax: number; existing?: Review }) {
  const router = useRouter();
  const [rating, setRating] = React.useState(existing?.rating?.toString() ?? "");
  const [strengths, setStrengths] = React.useState(existing?.strengths ?? "");
  const [improvements, setImprovements] = React.useState(existing?.improvements ?? "");
  const [comments, setComments] = React.useState(existing?.comments ?? "");
  const [busy, setBusy] = React.useState(false);
  const submitted = existing?.status === "SUBMITTED";

  async function save() {
    setBusy(true);
    const res = await submitReview({ cycleId, employeeId, kind: "SELF", rating: rating ? Number(rating) : undefined, strengths, improvements, comments });
    if (!res.success) { toast.error(res.error); setBusy(false); return; }
    setBusy(false); router.refresh();
  }
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold">
        <Star className="size-4 text-[#C9A96E]" /> Self review {submitted && <StatusPill label="Submitted" hue="emerald" size="xs" />}
      </h3>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label className="text-[12.5px]">Overall self-rating</Label>
          <Select value={rating} onValueChange={setRating}>
            <SelectTrigger className="h-9 w-32"><SelectValue placeholder="Rate" /></SelectTrigger>
            <SelectContent>{Array.from({ length: ratingMax }, (_, i) => i + 1).map((n) => <SelectItem key={n} value={String(n)}>{n}/{ratingMax}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Area label="Key strengths" value={strengths} onChange={setStrengths} />
        <Area label="Areas to improve" value={improvements} onChange={setImprovements} />
        <Area label="Comments" value={comments} onChange={setComments} />
        <Button onClick={save} disabled={busy} size="sm" className="gap-1.5">{busy && <Loader2 className="size-4 animate-spin" />} {submitted ? "Update self review" : "Submit self review"}</Button>
      </div>
    </div>
  );
}

function ManagerReviewDialog({ cycleId, employee, ratingMax }: { cycleId: string; employee: QueueRow; ratingMax: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [rating, setRating] = React.useState("");
  const [strengths, setStrengths] = React.useState("");
  const [improvements, setImprovements] = React.useState("");
  const [comments, setComments] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    const res = await submitReview({ cycleId, employeeId: employee.id, kind: "MANAGER", rating: rating ? Number(rating) : undefined, strengths, improvements, comments });
    if (!res.success) { toast.error(res.error); setBusy(false); return; }
    setBusy(false); setOpen(false); router.refresh();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Review</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review {employee.firstName} {employee.lastName}</DialogTitle>
          <DialogDescription>Submit your manager appraisal for this cycle.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-[12.5px]">Overall rating</Label>
            <Select value={rating} onValueChange={setRating}>
              <SelectTrigger className="h-9 w-32"><SelectValue placeholder="Rate" /></SelectTrigger>
              <SelectContent>{Array.from({ length: ratingMax }, (_, i) => i + 1).map((n) => <SelectItem key={n} value={String(n)}>{n}/{ratingMax}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Area label="Strengths" value={strengths} onChange={setStrengths} />
          <Area label="Areas to improve" value={improvements} onChange={setImprovements} />
          <Area label="Comments" value={comments} onChange={setComments} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy} className="gap-1.5">{busy && <Loader2 className="size-4 animate-spin" />} Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateCycleDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

  async function save() {
    setError(null);
    const res = await createCycle({ name, startDate, endDate });
    if (!res.success) { setError(res.error); return; }
    setOpen(false); setName(""); setStartDate(""); setEndDate(""); router.refresh();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="size-4" /> New cycle</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New appraisal cycle</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-[12.5px]">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="H1 FY26" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-[12.5px]">Start</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-[12.5px]">End</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={() => { setBusy(true); save().finally(() => setBusy(false)); }} disabled={busy} className="gap-1.5">{busy && <Loader2 className="size-4 animate-spin" />} Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CycleRow({ cycle }: { cycle: Cycle }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function setStatus(s: "DRAFT" | "ACTIVE" | "CLOSED") { setBusy(true); await setCycleStatus(cycle.id, s); setBusy(false); router.refresh(); }
  const hue = cycle.status === "ACTIVE" ? "emerald" : cycle.status === "CLOSED" ? "slate" : "amber";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <div>
        <Link href={`/people/performance/${cycle.id}`} className="font-medium hover:underline">{cycle.name}</Link>
        <div className="text-[12px] text-muted-foreground">{formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}</div>
      </div>
      <div className="flex items-center gap-2">
        <StatusPill label={cycle.status[0] + cycle.status.slice(1).toLowerCase()} hue={hue} size="xs" />
        {busy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        {cycle.status === "DRAFT" && <Button size="sm" variant="outline" onClick={() => setStatus("ACTIVE")}>Activate</Button>}
        {cycle.status === "ACTIVE" && <Button size="sm" variant="outline" onClick={() => setStatus("CLOSED")}>Close</Button>}
        <Button size="sm" variant="ghost" asChild><Link href={`/people/performance/${cycle.id}`}>Calibration</Link></Button>
      </div>
    </div>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12.5px]">{label}</Label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} className="h-16 w-full resize-y rounded-md border bg-background p-2.5 text-[13px] outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}
