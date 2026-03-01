"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  PlusIcon,
  PlayIcon,
  RocketIcon,
  Trash2Icon,
} from "lucide-react";
import {
  OPERATION_STATUS_COLORS,
  EVENT_PHASE_LABELS,
} from "@/lib/constants";
import { updateExecutionPlanStatus, deleteExecutionPlan } from "@/actions/execution-plan.actions";
import { addPhase } from "@/actions/execution-phase.actions";
import { PhaseCard } from "./phase-card";

interface ExecutionPlanViewProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plan: any;
  bookingId: string;
}

const STATUS_TRANSITIONS: Record<string, { next: string; label: string; icon: React.ReactNode }[]> = {
  PLANNING: [
    { next: "READY", label: "Mark Ready", icon: <CheckCircle2Icon className="mr-1 size-4" /> },
  ],
  READY: [
    { next: "LIVE", label: "Go Live", icon: <RocketIcon className="mr-1 size-4" /> },
  ],
  LIVE: [
    { next: "COMPLETED", label: "Mark Completed", icon: <CheckCircle2Icon className="mr-1 size-4" /> },
  ],
  COMPLETED: [],
};

const PHASE_TYPE_OPTIONS = Object.entries(EVENT_PHASE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function ExecutionPlanView({ plan, bookingId }: ExecutionPlanViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [phaseName, setPhaseName] = useState("");
  const [phaseType, setPhaseType] = useState("");
  const [phaseDescription, setPhaseDescription] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const phases = plan.phases ?? [];
  const totalTasks = phases.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, phase: any) => sum + (phase.tasks?.length ?? 0),
    0
  );
  const completedTasks = phases.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, phase: any) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sum + (phase.tasks?.filter((t: any) => t.status === "COMPLETED").length ?? 0),
    0
  );
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  function handleStatusTransition(nextStatus: string) {
    startTransition(async () => {
      const result = await updateExecutionPlanStatus(plan.id, nextStatus);
      if (result.success) {
        toast.success(`Plan status updated to ${nextStatus}.`);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to update plan status.");
      }
    });
  }

  function handleDeletePlan() {
    startTransition(async () => {
      const result = await deleteExecutionPlan(plan.id);
      if (result.success) {
        toast.success("Execution plan deleted.");
        setDeleteConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to delete plan.");
      }
    });
  }

  function handleAddPhase() {
    if (!phaseName.trim() || !phaseType) {
      toast.error("Please provide a name and phase type.");
      return;
    }
    startTransition(async () => {
      const result = await addPhase(plan.id, {
        name: phaseName.trim(),
        phase: phaseType as "PRE_EVENT" | "SETUP" | "GUEST_ARRIVAL" | "LIVE_EVENT" | "WRAP_UP" | "HANDOVER",
        description: phaseDescription.trim() || undefined,
      });
      if (result.success) {
        toast.success("Phase added successfully.");
        setPhaseName("");
        setPhaseType("");
        setPhaseDescription("");
        setAddPhaseOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to add phase.");
      }
    });
  }

  const transitions = STATUS_TRANSITIONS[plan.status] ?? [];

  return (
    <div className="space-y-6">
      {/* Plan Summary Card */}
      <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                Execution Plan
                <Badge
                  variant="outline"
                  className={OPERATION_STATUS_COLORS[plan.status] ?? ""}
                >
                  {plan.status}
                </Badge>
              </CardTitle>
              <div className="text-sm text-muted-foreground space-y-0.5">
                {plan.sopTemplate && (
                  <p>Template: {plan.sopTemplate.name}</p>
                )}
                {plan.eventDate && (
                  <p>
                    Event Date:{" "}
                    {new Date(plan.eventDate).toLocaleDateString("en-IN", {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
                {(plan.startTime || plan.endTime) && (
                  <p>
                    Time: {plan.startTime ?? "N/A"} - {plan.endTime ?? "N/A"}
                  </p>
                )}
                {plan.createdBy && (
                  <p>Created by: {plan.createdBy.name}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {transitions.map((t) => (
                <Button
                  key={t.next}
                  size="sm"
                  onClick={() => handleStatusTransition(t.next)}
                  disabled={isPending}
                  variant={t.next === "LIVE" ? "default" : "outline"}
                >
                  {isPending ? (
                    <Loader2Icon className="mr-1 size-4 animate-spin" />
                  ) : (
                    t.icon
                  )}
                  {t.label}
                </Button>
              ))}
              {plan.status === "PLANNING" && (
                <Dialog
                  open={deleteConfirmOpen}
                  onOpenChange={setDeleteConfirmOpen}
                >
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2Icon className="mr-1 size-4" />
                      Delete Plan
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete Execution Plan</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground py-2">
                      Are you sure you want to delete this execution plan? This
                      will remove all phases and tasks. This action cannot be
                      undone.
                    </p>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setDeleteConfirmOpen(false)}
                        disabled={isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleDeletePlan}
                        disabled={isPending}
                      >
                        {isPending && (
                          <Loader2Icon className="mr-1 size-4 animate-spin" />
                        )}
                        Delete Plan
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">
                {completedTasks}/{totalTasks} tasks ({overallProgress}%)
              </span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>
          {plan.notes && (
            <div className="mt-3 text-sm text-muted-foreground rounded-md border p-3">
              {plan.notes}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phases List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Phases ({phases.length})
          </h2>
          <Dialog open={addPhaseOpen} onOpenChange={setAddPhaseOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <PlusIcon className="mr-1 size-4" />
                Add Phase
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Phase</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Phase Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Stage Setup"
                    value={phaseName}
                    onChange={(e) => setPhaseName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Phase Type <span className="text-red-500">*</span>
                  </label>
                  <Select value={phaseType} onValueChange={setPhaseType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select phase type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PHASE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    placeholder="Optional description..."
                    value={phaseDescription}
                    onChange={(e) => setPhaseDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddPhaseOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddPhase} disabled={isPending}>
                  {isPending && (
                    <Loader2Icon className="mr-1 size-4 animate-spin" />
                  )}
                  Add Phase
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {phases.length === 0 ? (
          <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
            <CardContent className="py-10 text-center">
              <AlertTriangleIcon className="mx-auto size-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                No phases yet. Click &quot;Add Phase&quot; to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {phases.map((phase: any) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                planStatus={plan.status}
                bookingId={bookingId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
