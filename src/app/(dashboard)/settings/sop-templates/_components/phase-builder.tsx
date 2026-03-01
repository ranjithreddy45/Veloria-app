"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  TrashIcon,
  GripVerticalIcon,
  Loader2Icon,
  ClockIcon,
  ShieldCheckIcon,
  CameraIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ListChecksIcon,
} from "lucide-react";

import {
  addSOPPhase,
  updateSOPPhase,
  removeSOPPhase,
  addSOPTaskDefinition,
  updateSOPTaskDefinition,
  removeSOPTaskDefinition,
} from "@/actions/sop-template.actions";
import {
  EVENT_PHASE_LABELS,
  EVENT_PHASE_COLORS,
  TASK_CATEGORY_LABELS,
  TASK_PRIORITY_COLORS,
} from "@/lib/constants";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// ============================================================
// Types
// ============================================================

interface TaskDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  estimatedMinutes: number | null;
  isMandatory: boolean;
  requiresApproval: boolean;
  requiresProof: boolean;
  order: number;
  checklistItems: Array<{ title: string; order: number }> | null;
  dependsOnTaskOrder: number | null;
}

interface Phase {
  id: string;
  name: string;
  phase: string;
  order: number;
  description: string;
  taskDefinitions: TaskDefinition[];
}

interface PhaseBuilderProps {
  templateId: string;
  initialPhases: Phase[];
}

// ============================================================
// Phase type options
// ============================================================

const phaseTypeOptions = Object.entries(EVENT_PHASE_LABELS).map(
  ([value, label]) => ({ value, label })
);

const categoryOptions = Object.entries(TASK_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label })
);

const priorityOptions = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

// ============================================================
// Phase Builder Component
// ============================================================

export function PhaseBuilder({ templateId, initialPhases }: PhaseBuilderProps) {
  const router = useRouter();
  const [phases, setPhases] = React.useState<Phase[]>(initialPhases);
  const [expandedPhases, setExpandedPhases] = React.useState<Set<string>>(
    new Set(initialPhases.map((p) => p.id))
  );
  const [isPending, startTransition] = React.useTransition();

  // Dialog states
  const [phaseDialogOpen, setPhaseDialogOpen] = React.useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false);
  const [deletePhaseId, setDeletePhaseId] = React.useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = React.useState<string | null>(null);

  // Phase form state
  const [phaseForm, setPhaseForm] = React.useState({
    name: "",
    phase: "PRE_EVENT",
    description: "",
  });

  // Task form state
  const [taskPhaseId, setTaskPhaseId] = React.useState<string | null>(null);
  const [taskForm, setTaskForm] = React.useState({
    title: "",
    description: "",
    category: "GENERAL",
    priority: "MEDIUM",
    estimatedMinutes: "",
    isMandatory: false,
    requiresApproval: false,
    requiresProof: false,
  });

  // ============================================================
  // Toggle phase expansion
  // ============================================================

  function togglePhase(phaseId: string) {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  }

  // ============================================================
  // Add Phase
  // ============================================================

  function openAddPhaseDialog() {
    setPhaseForm({ name: "", phase: "PRE_EVENT", description: "" });
    setPhaseDialogOpen(true);
  }

  function handleAddPhase() {
    if (!phaseForm.name.trim()) {
      toast.error("Phase name is required");
      return;
    }

    startTransition(async () => {
      const result = await addSOPPhase(templateId, {
        name: phaseForm.name,
        phase: phaseForm.phase as "PRE_EVENT" | "SETUP" | "GUEST_ARRIVAL" | "LIVE_EVENT" | "WRAP_UP" | "HANDOVER",
        description: phaseForm.description || undefined,
      });

      if (result.success && result.data) {
        const newPhase: Phase = {
          id: result.data.id,
          name: result.data.name,
          phase: result.data.phase,
          order: result.data.order,
          description: result.data.description ?? "",
          taskDefinitions: result.data.taskDefinitions?.map((td: Record<string, unknown>) => ({
            id: td.id as string,
            title: td.title as string,
            description: (td.description as string) ?? "",
            category: td.category as string,
            priority: td.priority as string,
            estimatedMinutes: td.estimatedMinutes as number | null,
            isMandatory: td.isMandatory as boolean,
            requiresApproval: td.requiresApproval as boolean,
            requiresProof: td.requiresProof as boolean,
            order: td.order as number,
            checklistItems: td.checklistItems as Array<{ title: string; order: number }> | null,
            dependsOnTaskOrder: td.dependsOnTaskOrder as number | null,
          })) ?? [],
        };
        setPhases((prev) => [...prev, newPhase].sort((a, b) => a.order - b.order));
        setExpandedPhases((prev) => new Set([...prev, newPhase.id]));
        toast.success("Phase added successfully");
        setPhaseDialogOpen(false);
      } else {
        toast.error(result.error ?? "Failed to add phase");
      }
    });
  }

  // ============================================================
  // Remove Phase
  // ============================================================

  function handleRemovePhase(phaseId: string) {
    startTransition(async () => {
      const result = await removeSOPPhase(phaseId);
      if (result.success) {
        setPhases((prev) => prev.filter((p) => p.id !== phaseId));
        setExpandedPhases((prev) => {
          const next = new Set(prev);
          next.delete(phaseId);
          return next;
        });
        toast.success("Phase removed successfully");
      } else {
        toast.error(result.error ?? "Failed to remove phase");
      }
      setDeletePhaseId(null);
    });
  }

  // ============================================================
  // Add Task Definition
  // ============================================================

  function openAddTaskDialog(phaseId: string) {
    setTaskPhaseId(phaseId);
    setTaskForm({
      title: "",
      description: "",
      category: "GENERAL",
      priority: "MEDIUM",
      estimatedMinutes: "",
      isMandatory: false,
      requiresApproval: false,
      requiresProof: false,
    });
    setTaskDialogOpen(true);
  }

  function handleAddTask() {
    if (!taskPhaseId) return;
    if (!taskForm.title.trim()) {
      toast.error("Task title is required");
      return;
    }

    startTransition(async () => {
      const result = await addSOPTaskDefinition(taskPhaseId!, {
        title: taskForm.title,
        description: taskForm.description || undefined,
        category: taskForm.category as "DECOR" | "AV" | "CATERING" | "HOUSEKEEPING" | "GUEST_SEATING" | "ENTERTAINMENT" | "LOGISTICS" | "SECURITY" | "GENERAL",
        priority: taskForm.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
        estimatedMinutes: taskForm.estimatedMinutes
          ? parseInt(taskForm.estimatedMinutes, 10)
          : undefined,
        isMandatory: taskForm.isMandatory,
        requiresApproval: taskForm.requiresApproval,
        requiresProof: taskForm.requiresProof,
      });

      if (result.success && result.data) {
        const td = result.data;
        const newTask: TaskDefinition = {
          id: td.id,
          title: td.title,
          description: td.description ?? "",
          category: td.category,
          priority: td.priority,
          estimatedMinutes: td.estimatedMinutes,
          isMandatory: td.isMandatory,
          requiresApproval: td.requiresApproval,
          requiresProof: td.requiresProof,
          order: td.order,
          checklistItems: td.checklistItems as Array<{ title: string; order: number }> | null,
          dependsOnTaskOrder: td.dependsOnTaskOrder,
        };
        setPhases((prev) =>
          prev.map((p) =>
            p.id === taskPhaseId
              ? {
                  ...p,
                  taskDefinitions: [...p.taskDefinitions, newTask].sort(
                    (a, b) => a.order - b.order
                  ),
                }
              : p
          )
        );
        toast.success("Task definition added successfully");
        setTaskDialogOpen(false);
      } else {
        toast.error(result.error ?? "Failed to add task definition");
      }
    });
  }

  // ============================================================
  // Remove Task Definition
  // ============================================================

  function handleRemoveTask(taskId: string) {
    startTransition(async () => {
      const result = await removeSOPTaskDefinition(taskId);
      if (result.success) {
        setPhases((prev) =>
          prev.map((p) => ({
            ...p,
            taskDefinitions: p.taskDefinitions.filter((t) => t.id !== taskId),
          }))
        );
        toast.success("Task definition removed successfully");
      } else {
        toast.error(result.error ?? "Failed to remove task definition");
      }
      setDeleteTaskId(null);
    });
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Phases & Task Definitions</h2>
        <Button onClick={openAddPhaseDialog} size="sm" disabled={isPending}>
          <PlusIcon className="mr-2 size-4" />
          Add Phase
        </Button>
      </div>

      {phases.length === 0 ? (
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <ListChecksIcon className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No phases yet. Add a phase to start building your SOP.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={openAddPhaseDialog}
            >
              <PlusIcon className="mr-2 size-4" />
              Add First Phase
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {phases.map((phase) => {
            const isExpanded = expandedPhases.has(phase.id);
            const phaseColorClass =
              EVENT_PHASE_COLORS[phase.phase] ?? EVENT_PHASE_COLORS.PRE_EVENT;
            const phaseLabel =
              EVENT_PHASE_LABELS[phase.phase] ?? phase.phase;

            return (
              <Card
                key={phase.id}
                className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm"
              >
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => togglePhase(phase.id)}
                      className="flex items-center gap-2 text-left flex-1 min-w-0"
                    >
                      {isExpanded ? (
                        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="font-semibold truncate">
                        {phase.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={phaseColorClass}
                      >
                        {phaseLabel}
                      </Badge>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {phase.taskDefinitions.length}{" "}
                        {phase.taskDefinitions.length === 1 ? "task" : "tasks"}
                      </span>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAddTaskDialog(phase.id)}
                        disabled={isPending}
                      >
                        <PlusIcon className="mr-1 size-3.5" />
                        Task
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletePhaseId(phase.id)}
                        disabled={isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    </div>
                  </div>
                  {phase.description && (
                    <p className="text-sm text-muted-foreground ml-6 mt-1">
                      {phase.description}
                    </p>
                  )}
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-4">
                    {phase.taskDefinitions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No task definitions in this phase. Click &ldquo;Task&rdquo; to
                        add one.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {phase.taskDefinitions.map((task, idx) => (
                          <div
                            key={task.id}
                            className="flex items-start gap-3 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 p-3"
                          >
                            <span className="text-xs text-muted-foreground font-mono mt-0.5 shrink-0 w-5 text-center">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">
                                  {task.title}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={
                                    TASK_PRIORITY_COLORS[task.priority] ?? ""
                                  }
                                >
                                  {task.priority}
                                </Badge>
                                <Badge variant="secondary">
                                  {TASK_CATEGORY_LABELS[task.category] ??
                                    task.category}
                                </Badge>
                              </div>
                              {task.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                {task.estimatedMinutes != null && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <ClockIcon className="size-3" />
                                    {task.estimatedMinutes} min
                                  </span>
                                )}
                                {task.isMandatory && (
                                  <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                    <AlertTriangleIcon className="size-3" />
                                    Mandatory
                                  </span>
                                )}
                                {task.requiresApproval && (
                                  <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                    <ShieldCheckIcon className="size-3" />
                                    Approval
                                  </span>
                                )}
                                {task.requiresProof && (
                                  <span className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
                                    <CameraIcon className="size-3" />
                                    Proof
                                  </span>
                                )}
                                {task.checklistItems &&
                                  task.checklistItems.length > 0 && (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <CheckCircleIcon className="size-3" />
                                      {task.checklistItems.length} checklist{" "}
                                      {task.checklistItems.length === 1
                                        ? "item"
                                        : "items"}
                                    </span>
                                  )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTaskId(task.id)}
                              disabled={isPending}
                              className="text-destructive hover:text-destructive shrink-0"
                            >
                              <TrashIcon className="size-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Phase Dialog */}
      <Dialog open={phaseDialogOpen} onOpenChange={setPhaseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Phase</DialogTitle>
            <DialogDescription>
              Add a new phase to the SOP template. Phases organize task
              definitions by event stage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="phase-name">Phase Name *</Label>
              <Input
                id="phase-name"
                placeholder="e.g., Venue Setup"
                value={phaseForm.name}
                onChange={(e) =>
                  setPhaseForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phase-type">Phase Type *</Label>
              <Select
                value={phaseForm.phase}
                onValueChange={(val) =>
                  setPhaseForm((prev) => ({ ...prev, phase: val }))
                }
              >
                <SelectTrigger id="phase-type" className="w-full">
                  <SelectValue placeholder="Select phase type" />
                </SelectTrigger>
                <SelectContent>
                  {phaseTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phase-description">Description</Label>
              <Textarea
                id="phase-description"
                placeholder="Optional description..."
                rows={2}
                value={phaseForm.description}
                onChange={(e) =>
                  setPhaseForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPhaseDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleAddPhase} disabled={isPending}>
              {isPending && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              Add Phase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Definition Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Task Definition</DialogTitle>
            <DialogDescription>
              Define a task that will be created when this SOP is applied to an
              event.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="task-title">Task Title *</Label>
              <Input
                id="task-title"
                placeholder="e.g., Arrange stage lighting"
                value={taskForm.title}
                onChange={(e) =>
                  setTaskForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                placeholder="Optional task description..."
                rows={2}
                value={taskForm.description}
                onChange={(e) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-category">Category</Label>
                <Select
                  value={taskForm.category}
                  onValueChange={(val) =>
                    setTaskForm((prev) => ({ ...prev, category: val }))
                  }
                >
                  <SelectTrigger id="task-category" className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  value={taskForm.priority}
                  onValueChange={(val) =>
                    setTaskForm((prev) => ({ ...prev, priority: val }))
                  }
                >
                  <SelectTrigger id="task-priority" className="w-full">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-estimated-minutes">
                Estimated Minutes
              </Label>
              <Input
                id="task-estimated-minutes"
                type="number"
                min={1}
                placeholder="e.g., 30"
                value={taskForm.estimatedMinutes}
                onChange={(e) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    estimatedMinutes: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-3 border-t pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Mandatory</Label>
                  <p className="text-xs text-muted-foreground">
                    This task must be completed
                  </p>
                </div>
                <Switch
                  checked={taskForm.isMandatory}
                  onCheckedChange={(checked) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      isMandatory: checked,
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Requires Approval</Label>
                  <p className="text-xs text-muted-foreground">
                    Needs manager approval on completion
                  </p>
                </div>
                <Switch
                  checked={taskForm.requiresApproval}
                  onCheckedChange={(checked) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      requiresApproval: checked,
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Requires Proof</Label>
                  <p className="text-xs text-muted-foreground">
                    Photo or document upload required
                  </p>
                </div>
                <Switch
                  checked={taskForm.requiresProof}
                  onCheckedChange={(checked) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      requiresProof: checked,
                    }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTaskDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleAddTask} disabled={isPending}>
              {isPending && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Phase Confirmation Dialog */}
      <Dialog
        open={deletePhaseId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletePhaseId(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Phase</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this phase? All task definitions
              within this phase will also be removed. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletePhaseId(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletePhaseId) handleRemovePhase(deletePhaseId);
              }}
              disabled={isPending}
            >
              {isPending && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              Remove Phase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Task Confirmation Dialog */}
      <Dialog
        open={deleteTaskId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTaskId(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Task Definition</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this task definition? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTaskId(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTaskId) handleRemoveTask(deleteTaskId);
              }}
              disabled={isPending}
            >
              {isPending && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              Remove Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
