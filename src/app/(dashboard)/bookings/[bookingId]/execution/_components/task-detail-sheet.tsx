"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangleIcon,
  CameraIcon,
  CheckCircle2Icon,
  ClockIcon,
  Loader2Icon,
  OctagonIcon,
  PlayIcon,
  PlusIcon,
  ShieldCheckIcon,
  UserIcon,
} from "lucide-react";
import {
  EXECUTION_TASK_STATUS_COLORS,
  TASK_CATEGORY_LABELS,
  TASK_PRIORITY_COLORS,
  ESCALATION_LEVEL_LABELS,
  ESCALATION_STATUS_COLORS,
} from "@/lib/constants";
import {
  startTask,
  completeTask,
  blockTask,
  approveTask,
  addTaskProof,
  addExecutionChecklist,
  toggleExecutionChecklist,
} from "@/actions/execution-task.actions";

interface TaskDetailSheetProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  task: any;
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailSheet({
  task,
  bookingId,
  open,
  onOpenChange,
}: TaskDetailSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Checklist
  const [newChecklistTitle, setNewChecklistTitle] = useState("");

  // Proof
  const [proofType, setProofType] = useState("NOTE");
  const [proofContent, setProofContent] = useState("");
  const [proofNotes, setProofNotes] = useState("");

  // Block
  const [blockReason, setBlockReason] = useState("");
  const [showBlockForm, setShowBlockForm] = useState(false);

  // Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (task.status === "IN_PROGRESS" && task.actualStart) {
      const startTime = new Date(task.actualStart).getTime();
      const updateTimer = () => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [task.status, task.actualStart]);

  function formatDuration(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(" ");
  }

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
      toast.error("Please provide a reason.");
      return;
    }
    startTransition(async () => {
      const result = await blockTask(task.id, blockReason.trim());
      if (result.success) {
        toast.success("Task blocked.");
        setShowBlockForm(false);
        setBlockReason("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to block task.");
      }
    });
  }

  function handleApprove() {
    startTransition(async () => {
      const result = await approveTask(task.id);
      if (result.success) {
        toast.success("Task approved.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to approve task.");
      }
    });
  }

  function handleAddChecklist() {
    if (!newChecklistTitle.trim()) return;
    startTransition(async () => {
      const result = await addExecutionChecklist(
        task.id,
        newChecklistTitle.trim()
      );
      if (result.success) {
        toast.success("Checklist item added.");
        setNewChecklistTitle("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to add checklist item.");
      }
    });
  }

  function handleToggleChecklist(checklistId: string) {
    startTransition(async () => {
      const result = await toggleExecutionChecklist(checklistId);
      if (result.success) {
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to toggle checklist.");
      }
    });
  }

  function handleAddProof() {
    if (!proofContent.trim()) {
      toast.error("Please provide proof content.");
      return;
    }
    startTransition(async () => {
      const result = await addTaskProof(task.id, {
        type: proofType as "PHOTO" | "NOTE" | "SIGN_OFF",
        content: proofContent.trim(),
        notes: proofNotes.trim() || undefined,
      });
      if (result.success) {
        toast.success("Proof added.");
        setProofContent("");
        setProofNotes("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to add proof.");
      }
    });
  }

  const checklistItems = task.checklistItems ?? [];
  const proofs = task.proofs ?? [];
  const escalations = task.escalations ?? [];
  const timeLogs = task.timeLogs ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left">{task.title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* Status & Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={EXECUTION_TASK_STATUS_COLORS[task.status] ?? ""}
            >
              {task.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline">
              {TASK_CATEGORY_LABELS[task.category] ?? task.category}
            </Badge>
            <Badge
              variant="outline"
              className={TASK_PRIORITY_COLORS[task.priority] ?? ""}
            >
              {task.priority}
            </Badge>
            {task.isMandatory && (
              <Badge variant="outline" className="text-warning border-warning/20">
                <AlertTriangleIcon className="mr-1 size-3" />
                Mandatory
              </Badge>
            )}
            {task.requiresApproval && (
              <Badge variant="outline" className="text-violet-600 border-violet-300">
                <ShieldCheckIcon className="mr-1 size-3" />
                Approval Required
              </Badge>
            )}
            {task.requiresProof && (
              <Badge variant="outline" className="text-blue-600 border-blue-300">
                <CameraIcon className="mr-1 size-3" />
                Proof Required
              </Badge>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h4 className="text-sm font-medium mb-1">Description</h4>
              <p className="text-sm text-muted-foreground">
                {task.description}
              </p>
            </div>
          )}

          {/* Timer (when IN_PROGRESS) */}
          {task.status === "IN_PROGRESS" && task.actualStart && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
              <div className="flex items-center gap-2">
                <ClockIcon className="size-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  Elapsed: {formatDuration(elapsedSeconds)}
                </span>
              </div>
              {task.estimatedMinutes && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Estimated: {task.estimatedMinutes} minutes
                </p>
              )}
            </div>
          )}

          {/* Delay Reason */}
          {(task.status === "BLOCKED" || task.status === "DELAYED") &&
            task.delayReason && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                <h4 className="text-sm font-medium text-destructive mb-1">
                  {task.status === "BLOCKED" ? "Block" : "Delay"} Reason
                </h4>
                <p className="text-sm text-destructive">
                  {task.delayReason}
                </p>
              </div>
            )}

          <Separator />

          {/* Assignment */}
          <div>
            <h4 className="text-sm font-medium mb-2">Assignment</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <UserIcon className="size-4 text-muted-foreground" />
                <span>
                  {task.assignee
                    ? task.assignee.name ?? task.assignee.email
                    : "Unassigned"}
                </span>
              </div>
              {task.vendor && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Vendor: {task.vendor.name}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* SLA & Time Details */}
          <div>
            <h4 className="text-sm font-medium mb-2">SLA & Timing</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {task.slaStartBy && (
                <div>
                  <span className="text-muted-foreground">SLA Start By:</span>
                  <p className="font-medium">
                    {new Date(task.slaStartBy).toLocaleString("en-IN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              )}
              {task.slaFinishBy && (
                <div>
                  <span className="text-muted-foreground">SLA Finish By:</span>
                  <p className="font-medium">
                    {new Date(task.slaFinishBy).toLocaleString("en-IN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              )}
              {task.actualStart && (
                <div>
                  <span className="text-muted-foreground">Actual Start:</span>
                  <p className="font-medium">
                    {new Date(task.actualStart).toLocaleString("en-IN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              )}
              {task.actualEnd && (
                <div>
                  <span className="text-muted-foreground">Actual End:</span>
                  <p className="font-medium">
                    {new Date(task.actualEnd).toLocaleString("en-IN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              )}
              {task.estimatedMinutes && (
                <div>
                  <span className="text-muted-foreground">Estimated:</span>
                  <p className="font-medium">{task.estimatedMinutes} min</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Checklist */}
          <div>
            <h4 className="text-sm font-medium mb-2">
              Checklist ({checklistItems.filter(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (c: any) => c.isCompleted
              ).length}/{checklistItems.length})
            </h4>
            {checklistItems.length > 0 && (
              <div className="space-y-2 mb-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {checklistItems.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={item.isCompleted}
                      onCheckedChange={() => handleToggleChecklist(item.id)}
                      disabled={isPending}
                    />
                    <span
                      className={`text-sm ${
                        item.isCompleted
                          ? "line-through text-muted-foreground"
                          : ""
                      }`}
                    >
                      {item.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Add checklist item..."
                value={newChecklistTitle}
                onChange={(e) => setNewChecklistTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddChecklist();
                  }
                }}
                className="text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddChecklist}
                disabled={isPending || !newChecklistTitle.trim()}
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Proofs */}
          <div>
            <h4 className="text-sm font-medium mb-2">
              Proofs ({proofs.length})
            </h4>
            {proofs.length > 0 && (
              <div className="space-y-2 mb-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {proofs.map((proof: any) => (
                  <div
                    key={proof.id}
                    className="rounded-md border border-border p-2 text-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-meta">
                        {proof.type}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {new Date(proof.createdAt).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    <p className="text-sm">{proof.content}</p>
                    {proof.notes && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {proof.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex gap-2">
                <Select value={proofType} onValueChange={setProofType}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PHOTO">Photo</SelectItem>
                    <SelectItem value="NOTE">Note</SelectItem>
                    <SelectItem value="SIGN_OFF">Sign-off</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder={
                    proofType === "PHOTO"
                      ? "Photo URL..."
                      : proofType === "SIGN_OFF"
                      ? "Signed off by..."
                      : "Note content..."
                  }
                  value={proofContent}
                  onChange={(e) => setProofContent(e.target.value)}
                  className="text-sm"
                />
              </div>
              <Input
                placeholder="Optional notes..."
                value={proofNotes}
                onChange={(e) => setProofNotes(e.target.value)}
                className="text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddProof}
                disabled={isPending || !proofContent.trim()}
                className="w-full"
              >
                {isPending ? (
                  <Loader2Icon className="mr-1 size-4 animate-spin" />
                ) : (
                  <PlusIcon className="mr-1 size-4" />
                )}
                Add Proof
              </Button>
            </div>
          </div>

          {/* Approval Status */}
          {task.requiresApproval && task.status === "COMPLETED" && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Approval</h4>
                {task.isApproved ? (
                  <div className="rounded-md bg-success/10 border border-success/20 p-3 text-sm">
                    <CheckCircle2Icon className="inline mr-1 size-4 text-success" />
                    Approved
                    {task.approvedAt && (
                      <span className="text-muted-foreground ml-2">
                        at{" "}
                        {new Date(task.approvedAt).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-warning">
                      Awaiting approval.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleApprove}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <Loader2Icon className="mr-1 size-4 animate-spin" />
                      ) : (
                        <ShieldCheckIcon className="mr-1 size-4" />
                      )}
                      Approve Task
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Escalations */}
          {escalations.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Escalations ({escalations.length})
                </h4>
                <div className="space-y-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {escalations.map((esc: any) => (
                    <div
                      key={esc.id}
                      className="rounded-md border border-border p-2 text-sm"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={ESCALATION_STATUS_COLORS[esc.status] ?? ""}
                        >
                          {esc.status.replace("_", " ")}
                        </Badge>
                        <Badge variant="secondary" className="text-meta">
                          {ESCALATION_LEVEL_LABELS[esc.level] ?? esc.level}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {esc.reason}
                      </p>
                      {esc.delayMinutes != null && (
                        <p className="text-xs text-destructive mt-0.5">
                          Delay: {esc.delayMinutes} minutes
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(esc.createdAt).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                      {esc.resolutionNotes && (
                        <p className="text-xs mt-1">
                          Resolution: {esc.resolutionNotes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Time Logs */}
          {timeLogs.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Time Log ({timeLogs.length})
                </h4>
                <div className="space-y-1">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {timeLogs.map((log: any, idx: number) => (
                    <div
                      key={log.id ?? idx}
                      className="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <span className="capitalize">{log.action}</span>
                      <span>
                        {new Date(log.timestamp).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {task.status === "NOT_STARTED" && (
              <Button size="sm" onClick={handleStart} disabled={isPending}>
                {isPending ? (
                  <Loader2Icon className="mr-1 size-4 animate-spin" />
                ) : (
                  <PlayIcon className="mr-1 size-4" />
                )}
                Start Task
              </Button>
            )}
            {task.status === "IN_PROGRESS" && (
              <>
                <Button
                  size="sm"
                  onClick={handleComplete}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2Icon className="mr-1 size-4 animate-spin" />
                  ) : (
                    <CheckCircle2Icon className="mr-1 size-4" />
                  )}
                  Complete
                </Button>
                {!showBlockForm ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowBlockForm(true)}
                    disabled={isPending}
                  >
                    <OctagonIcon className="mr-1 size-4" />
                    Block
                  </Button>
                ) : (
                  <div className="flex w-full gap-2">
                    <Textarea
                      placeholder="Block reason..."
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleBlock}
                        disabled={isPending}
                      >
                        {isPending ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : (
                          "Block"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowBlockForm(false);
                          setBlockReason("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
