"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, Target, Trash2, CheckCircle2, Archive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createObjective, updateObjective, deleteObjective,
  addKeyResult, updateKeyResult, deleteKeyResult,
  type ObjectiveDTO, type KeyResultDTO,
} from "@/actions/okr.actions";

const STATUS_META: Record<string, { label: string; variant: "success" | "warning" | "outline" }> = {
  ACTIVE: { label: "Active", variant: "warning" },
  DONE: { label: "Done", variant: "success" },
  ARCHIVED: { label: "Archived", variant: "outline" },
};

export function OkrBoard({
  objectives,
  canManage,
  viewingOther,
  ownerName,
  currentUserId,
  ownerId,
  owners,
}: {
  objectives: ObjectiveDTO[];
  canManage: boolean;
  viewingOther: boolean;
  ownerName: string;
  currentUserId: string;
  ownerId: string;
  owners: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function switchOwner(id: string) {
    const params = new URLSearchParams();
    if (id !== currentUserId) params.set("owner", id);
    const qs = params.toString();
    router.push(`/people/okr${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-[13px] text-muted-foreground">
            {viewingOther ? (
              <>Viewing <span className="font-medium text-foreground">{ownerName}</span>&rsquo;s objectives.</>
            ) : (
              <>Your objectives and their measurable key results.</>
            )}
          </p>
          {owners.length > 0 && (
            <Select value={ownerId} onValueChange={switchOwner}>
              <SelectTrigger className="h-8 w-56 text-[13px]">
                <SelectValue placeholder="View someone…" />
              </SelectTrigger>
              <SelectContent>
                {owners.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.id === currentUserId ? `${o.name} (me)` : o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {!viewingOther && <NewObjectiveDialog onDone={() => router.refresh()} />}
      </div>

      {objectives.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Target className="mx-auto mb-3 size-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">No objectives yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {viewingOther ? "This person hasn't set any objectives." : "Create your first objective to start tracking progress."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {objectives.map((o) => (
            <ObjectiveCard key={o.id} objective={o} canManage={canManage} pending={pending} startTransition={startTransition} onDone={() => router.refresh()} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Objective card
// ============================================================
function ObjectiveCard({
  objective, canManage, pending, startTransition, onDone,
}: {
  objective: ObjectiveDTO;
  canManage: boolean;
  pending: boolean;
  startTransition: React.TransitionStartFunction;
  onDone: () => void;
}) {
  const meta = STATUS_META[objective.status] ?? STATUS_META.ACTIVE;

  function setStatus(status: string) {
    startTransition(async () => {
      const res = await updateObjective(objective.id, { status });
      if (res.success) { toast.success("Objective updated."); onDone(); }
      else toast.error(res.error);
    });
  }

  function remove() {
    if (!confirm("Delete this objective and all its key results?")) return;
    startTransition(async () => {
      const res = await deleteObjective(objective.id);
      if (res.success) { toast.success("Objective deleted."); onDone(); }
      else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold leading-tight text-foreground">{objective.title}</h3>
              <Badge variant={meta.variant} className="shrink-0">{meta.label}</Badge>
              <Badge variant="outline" className="shrink-0 font-normal">{objective.period}</Badge>
            </div>
            {objective.description && (
              <p className="text-[13px] leading-relaxed text-muted-foreground">{objective.description}</p>
            )}
          </div>
          {canManage && (
            <div className="flex shrink-0 items-center gap-1">
              {objective.status !== "ARCHIVED" ? (
                <Button variant="ghost" size="icon" title="Archive" disabled={pending} onClick={() => setStatus("ARCHIVED")}>
                  <Archive className="size-4" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon" title="Reactivate" disabled={pending} onClick={() => setStatus("ACTIVE")}>
                  <RotateCcw className="size-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" title="Delete" disabled={pending} onClick={remove}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium text-muted-foreground">Overall progress</span>
            <span className="font-semibold tabular-nums text-foreground">{objective.progress}%</span>
          </div>
          <Progress value={objective.progress} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Key results ({objective.keyResults.length})
          </span>
          {canManage && <AddKeyResultDialog objectiveId={objective.id} onDone={onDone} />}
        </div>

        {objective.keyResults.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-[13px] text-muted-foreground">
            No key results yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {objective.keyResults.map((kr) => (
              <KeyResultRow key={kr.id} kr={kr} canManage={canManage} pending={pending} startTransition={startTransition} onDone={onDone} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Key result row — inline editable current / target
// ============================================================
function KeyResultRow({
  kr, canManage, pending, startTransition, onDone,
}: {
  kr: KeyResultDTO;
  canManage: boolean;
  pending: boolean;
  startTransition: React.TransitionStartFunction;
  onDone: () => void;
}) {
  const [current, setCurrent] = React.useState(kr.current != null ? String(kr.current) : "");
  const [target, setTarget] = React.useState(kr.target != null ? String(kr.target) : "");

  React.useEffect(() => {
    setCurrent(kr.current != null ? String(kr.current) : "");
    setTarget(kr.target != null ? String(kr.target) : "");
  }, [kr.current, kr.target]);

  const dirty =
    current !== (kr.current != null ? String(kr.current) : "") ||
    target !== (kr.target != null ? String(kr.target) : "");

  function save() {
    const c = current.trim() === "" ? null : Number(current);
    const t = target.trim() === "" ? null : Number(target);
    if ((c != null && Number.isNaN(c)) || (t != null && Number.isNaN(t))) {
      toast.error("Enter valid numbers.");
      return;
    }
    startTransition(async () => {
      const res = await updateKeyResult(kr.id, { current: c, target: t });
      if (res.success) { toast.success("Key result saved."); onDone(); }
      else toast.error(res.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteKeyResult(kr.id);
      if (res.success) { toast.success("Key result removed."); onDone(); }
      else toast.error(res.error);
    });
  }

  return (
    <li className="rounded-lg border bg-card/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {kr.progress >= 100 && <CheckCircle2 className="size-4 shrink-0 text-success" />}
          <span className="truncate text-[13px] font-medium text-foreground">{kr.title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">{kr.progress}%</span>
          {canManage && (
            <Button variant="ghost" size="icon" className="size-7" title="Remove key result" disabled={pending} onClick={remove}>
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      <div className="mt-2">
        <Progress value={kr.progress} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px]">
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            inputMode="decimal"
            value={current}
            disabled={!canManage || pending}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="current"
            className="h-8 w-24"
            aria-label="Current value"
          />
          <span className="text-muted-foreground">/</span>
          <Input
            type="number"
            inputMode="decimal"
            value={target}
            disabled={!canManage || pending}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="target"
            className="h-8 w-24"
            aria-label="Target value"
          />
          {kr.unit && <span className="text-muted-foreground">{kr.unit}</span>}
        </div>
        {canManage && dirty && (
          <Button size="sm" className="h-8" disabled={pending} onClick={save}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
          </Button>
        )}
      </div>
    </li>
  );
}

// ============================================================
// New objective dialog
// ============================================================
function currentPeriod() {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q}-${d.getFullYear()}`;
}

function NewObjectiveDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [period, setPeriod] = React.useState(currentPeriod());
  const [pending, startTransition] = React.useTransition();

  function submit() {
    if (!title.trim()) { toast.error("Title is required."); return; }
    if (!period.trim()) { toast.error("Period is required."); return; }
    startTransition(async () => {
      const res = await createObjective({ title, description, period });
      if (res.success) {
        toast.success("Objective created.");
        setTitle(""); setDescription(""); setPeriod(currentPeriod());
        setOpen(false);
        onDone();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="size-4" /> New objective</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New objective</DialogTitle>
          <DialogDescription>Set an objective for the period. Add measurable key results after.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="okr-title">Title</Label>
            <Input id="okr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Grow qualified pipeline" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="okr-period">Period</Label>
            <Input id="okr-period" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Q3-2026" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="okr-desc">Description (optional)</Label>
            <Textarea id="okr-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why this matters this period…" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Add key result dialog
// ============================================================
function AddKeyResultDialog({ objectiveId, onDone }: { objectiveId: string; onDone: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [current, setCurrent] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function submit() {
    if (!title.trim()) { toast.error("Title is required."); return; }
    const c = current.trim() === "" ? null : Number(current);
    const t = target.trim() === "" ? null : Number(target);
    if ((c != null && Number.isNaN(c)) || (t != null && Number.isNaN(t))) {
      toast.error("Enter valid numbers.");
      return;
    }
    startTransition(async () => {
      const res = await addKeyResult(objectiveId, { title, current: c, target: t, unit });
      if (res.success) {
        toast.success("Key result added.");
        setTitle(""); setCurrent(""); setTarget(""); setUnit("");
        setOpen(false);
        onDone();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[12px]"><Plus className="size-3.5" /> Add key result</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add key result</DialogTitle>
          <DialogDescription>Progress is computed from current ÷ target.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="kr-title">Title</Label>
            <Input id="kr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Close 20 new bookings" autoFocus />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="kr-current">Current</Label>
              <Input id="kr-current" type="number" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kr-target">Target</Label>
              <Input id="kr-target" type="number" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="20" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kr-unit">Unit</Label>
              <Input id="kr-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="bookings" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
