"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import {
  EVENT_PHASE_LABELS,
  EVENT_PHASE_COLORS,
  TASK_CATEGORY_LABELS,
} from "@/lib/constants";
import { removePhase } from "@/actions/execution-phase.actions";
import { addExecutionTask } from "@/actions/execution-task.actions";
import { ExecutionTaskCard } from "./execution-task-card";

interface PhaseCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  phase: any;
  planStatus: string;
  bookingId: string;
}

const CATEGORY_OPTIONS = Object.entries(TASK_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label })
);

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export function PhaseCard({ phase, planStatus, bookingId }: PhaseCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(true);
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  // Add task form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskCategory, setTaskCategory] = useState("GENERAL");
  const [taskPriority, setTaskPriority] = useState("MEDIUM");
  const [taskEstimatedMinutes, setTaskEstimatedMinutes] = useState("");
  const [taskIsMandatory, setTaskIsMandatory] = useState(false);
  const [taskRequiresApproval, setTaskRequiresApproval] = useState(false);
  const [taskRequiresProof, setTaskRequiresProof] = useState(false);

  const tasks = phase.tasks ?? [];
  const totalTasks = tasks.length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completedTasks = tasks.filter((t: any) => t.status === "COMPLETED").length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  function handleRemovePhase() {
    startTransition(async () => {
      const result = await removePhase(phase.id);
      if (result.success) {
        toast.success("Phase removed.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to remove phase.");
      }
    });
  }

  function handleAddTask() {
    if (!taskTitle.trim()) {
      toast.error("Please provide a task title.");
      return;
    }
    startTransition(async () => {
      const result = await addExecutionTask(phase.id, {
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
        category: taskCategory as "DECOR" | "AV" | "CATERING" | "HOUSEKEEPING" | "GUEST_SEATING" | "ENTERTAINMENT" | "LOGISTICS" | "SECURITY" | "GENERAL",
        priority: taskPriority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
        estimatedMinutes: taskEstimatedMinutes
          ? parseInt(taskEstimatedMinutes, 10)
          : undefined,
        isMandatory: taskIsMandatory,
        requiresApproval: taskRequiresApproval,
        requiresProof: taskRequiresProof,
      });
      if (result.success) {
        toast.success("Task added successfully.");
        resetTaskForm();
        setAddTaskOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to add task.");
      }
    });
  }

  function resetTaskForm() {
    setTaskTitle("");
    setTaskDescription("");
    setTaskCategory("GENERAL");
    setTaskPriority("MEDIUM");
    setTaskEstimatedMinutes("");
    setTaskIsMandatory(false);
    setTaskRequiresApproval(false);
    setTaskRequiresProof(false);
  }

  return (
    <Card className="border-border shadow-sm">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity">
                {isOpen ? (
                  <ChevronDownIcon className="size-5 text-muted-foreground" />
                ) : (
                  <ChevronRightIcon className="size-5 text-muted-foreground" />
                )}
                <CardTitle className="text-base">{phase.name}</CardTitle>
                <Badge
                  variant="outline"
                  className={EVENT_PHASE_COLORS[phase.phase] ?? ""}
                >
                  {EVENT_PHASE_LABELS[phase.phase] ?? phase.phase}
                </Badge>
                <Badge variant="secondary" className="ml-1 text-xs font-normal">
                  {completedTasks}/{totalTasks} tasks
                </Badge>
              </button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              {planStatus === "PLANNING" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemovePhase}
                  disabled={isPending}
                  className="text-destructive hover:text-destructive"
                >
                  {isPending ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <Trash2Icon className="size-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
          {totalTasks > 0 && (
            <div className="mt-2 ml-7">
              <Progress value={progress} className="h-1.5" />
            </div>
          )}
          {phase.description && (
            <p className="text-xs text-muted-foreground ml-7 mt-1">
              {phase.description}
            </p>
          )}
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No tasks in this phase.
              </p>
            ) : (
              <div className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {tasks.map((task: any) => (
                  <ExecutionTaskCard
                    key={task.id}
                    task={task}
                    bookingId={bookingId}
                  />
                ))}
              </div>
            )}

            <div className="mt-3 pt-3 border-t">
              <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <PlusIcon className="mr-1 size-4" />
                    Add Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>
                      Add Task to &quot;{phase.name}&quot;
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Title <span className="text-destructive">*</span>
                      </label>
                      <Input
                        placeholder="e.g. Set up audio system"
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        placeholder="Optional description..."
                        value={taskDescription}
                        onChange={(e) => setTaskDescription(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Category</label>
                        <Select
                          value={taskCategory}
                          onValueChange={setTaskCategory}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Priority</label>
                        <Select
                          value={taskPriority}
                          onValueChange={setTaskPriority}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Estimated Minutes
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g. 30"
                        value={taskEstimatedMinutes}
                        onChange={(e) => setTaskEstimatedMinutes(e.target.value)}
                        min={1}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={taskIsMandatory}
                          onChange={(e) => setTaskIsMandatory(e.target.checked)}
                          className="rounded border-border"
                        />
                        Mandatory task
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={taskRequiresApproval}
                          onChange={(e) =>
                            setTaskRequiresApproval(e.target.checked)
                          }
                          className="rounded border-border"
                        />
                        Requires approval
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={taskRequiresProof}
                          onChange={(e) =>
                            setTaskRequiresProof(e.target.checked)
                          }
                          className="rounded border-border"
                        />
                        Requires proof
                      </label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        resetTaskForm();
                        setAddTaskOpen(false);
                      }}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleAddTask} disabled={isPending}>
                      {isPending && (
                        <Loader2Icon className="mr-1 size-4 animate-spin" />
                      )}
                      Add Task
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
