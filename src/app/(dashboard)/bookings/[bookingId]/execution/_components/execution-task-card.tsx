"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EXECUTION_TASK_STATUS_COLORS,
  TASK_CATEGORY_LABELS,
  TASK_PRIORITY_COLORS,
} from "@/lib/constants";
import {
  startTask,
  completeTask,
  blockTask,
} from "@/actions/execution-task.actions";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  Loader2Icon,
  OctagonIcon,
  PlayIcon,
  ShieldCheckIcon,
  CameraIcon,
  UserIcon,
  ListChecksIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { TaskDetailSheet } from "./task-detail-sheet";

interface ExecutionTaskCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  task: any;
  bookingId: string;
}

export function ExecutionTaskCard({ task, bookingId }: ExecutionTaskCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const checklistItems = task.checklistItems ?? [];
  const completedChecklist = checklistItems.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c: any) => c.isCompleted
  ).length;
  const totalChecklist = checklistItems.length;

  function handleStart() {
    startTransition(async () => {
      const result = await startTask(task.id);
      if (result.success) {
        toast.success("Task started.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to start task.");
      }
    });
  }

  function handleComplete() {
    startTransition(async () => {
      const result = await completeTask(task.id);
      if (result.success) {
        toast.success("Task completed.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to complete task.");
      }
    });
  }

  function handleBlock() {
    if (!blockReason.trim()) {
      toast.error("Please provide a reason for blocking.");
      return;
    }
    startTransition(async () => {
      const result = await blockTask(task.id, blockReason.trim());
      if (result.success) {
        toast.success("Task blocked.");
        setBlockDialogOpen(false);
        setBlockReason("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to block task.");
      }
    });
  }

  function getSlaIndicator() {
    if (!task.slaFinishBy) return null;
    const now = new Date();
    const deadline = new Date(task.slaFinishBy);
    const diffMs = deadline.getTime() - now.getTime();

    if (task.status === "COMPLETED") return null;

    if (diffMs < 0) {
      const overdueMins = Math.abs(Math.round(diffMs / 60000));
      const hours = Math.floor(overdueMins / 60);
      const mins = overdueMins % 60;
      return (
        <span className="text-xs font-medium text-destructive">
          OVERDUE {hours > 0 ? `${hours}h ` : ""}{mins}m
        </span>
      );
    }

    const remainingMins = Math.round(diffMs / 60000);
    const hours = Math.floor(remainingMins / 60);
    const mins = remainingMins % 60;
    return (
      <span className="text-xs text-muted-foreground">
        <ClockIcon className="inline mr-0.5 size-3" />
        {hours > 0 ? `${hours}h ` : ""}{mins}m left
      </span>
    );
  }

  return (
    <>
      <div
        className="group rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors cursor-pointer"
        onClick={() => setSheetOpen(true)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium truncate">
                {task.title}
              </span>
              {task.isMandatory && (
                <span className="text-warning text-xs" title="Mandatory">
                  <AlertTriangleIcon className="inline size-3.5" />
                </span>
              )}
              {task.requiresApproval && (
                <span className="text-violet-500 text-xs" title="Requires Approval">
                  <ShieldCheckIcon className="inline size-3.5" />
                </span>
              )}
              {task.requiresProof && (
                <span className="text-blue-500 text-xs" title="Requires Proof">
                  <CameraIcon className="inline size-3.5" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={`text-meta px-1.5 py-0 ${EXECUTION_TASK_STATUS_COLORS[task.status] ?? ""}`}
              >
                {task.status.replace("_", " ")}
              </Badge>
              <Badge
                variant="outline"
                className="text-meta px-1.5 py-0"
              >
                {TASK_CATEGORY_LABELS[task.category] ?? task.category}
              </Badge>
              <Badge
                variant="outline"
                className={`text-meta px-1.5 py-0 ${TASK_PRIORITY_COLORS[task.priority] ?? ""}`}
              >
                {task.priority}
              </Badge>
              {task.estimatedMinutes && (
                <span className="text-meta text-muted-foreground">
                  ~{task.estimatedMinutes}min
                </span>
              )}
              {getSlaIndicator()}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {task.assignee ? (
                <span className="flex items-center gap-1">
                  <UserIcon className="size-3" />
                  {task.assignee.name ?? task.assignee.email}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-warning">
                  <UserIcon className="size-3" />
                  Unassigned
                </span>
              )}
              {totalChecklist > 0 && (
                <span className="flex items-center gap-1">
                  <ListChecksIcon className="size-3" />
                  {completedChecklist}/{totalChecklist}
                </span>
              )}
            </div>
          </div>

          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {task.status === "NOT_STARTED" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStart}
                disabled={isPending}
                className="h-7 px-2 text-xs"
              >
                {isPending ? (
                  <Loader2Icon className="size-3 animate-spin" />
                ) : (
                  <PlayIcon className="mr-0.5 size-3" />
                )}
                Start
              </Button>
            )}
            {task.status === "IN_PROGRESS" && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleComplete}
                  disabled={isPending}
                  className="h-7 px-2 text-xs text-success"
                >
                  {isPending ? (
                    <Loader2Icon className="size-3 animate-spin" />
                  ) : (
                    <CheckCircle2Icon className="mr-0.5 size-3" />
                  )}
                  Complete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBlockDialogOpen(true)}
                  disabled={isPending}
                  className="h-7 px-2 text-xs text-destructive"
                >
                  <OctagonIcon className="mr-0.5 size-3" />
                  Block
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Block Reason Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Blocking &quot;{task.title}&quot;. Please provide a reason.
            </p>
            <Textarea
              placeholder="Reason for blocking..."
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBlockDialogOpen(false);
                setBlockReason("");
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBlock}
              disabled={isPending}
            >
              {isPending && (
                <Loader2Icon className="mr-1 size-4 animate-spin" />
              )}
              Block Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        task={task}
        bookingId={bookingId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
