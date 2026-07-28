"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { PlusIcon, Loader2Icon } from "lucide-react";

import { createSubtask } from "@/actions/task.actions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TASK_PRIORITY_COLORS } from "@/lib/constants";

// ============================================================
// Types
// ============================================================

interface SubtaskData {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  order: number;
  assignee: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

interface TaskSubtasksProps {
  taskId: string;
  subtasks: SubtaskData[];
}

// ============================================================
// Status Config
// ============================================================

const STATUS_COLORS: Record<string, string> = {
  TODO: "bg-zinc-100 text-zinc-700 border-zinc-200",
  IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
  IN_REVIEW: "bg-amber-100 text-amber-700 border-amber-200",
  DONE: "bg-green-100 text-green-700 border-green-200",
};

const STATUS_LABELS: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

// ============================================================
// Component
// ============================================================

export function TaskSubtasks({ taskId, subtasks }: TaskSubtasksProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    setIsCreating(true);
    try {
      const result = await createSubtask(taskId, { title: trimmed });
      if (result.success) {
        setTitle("");
        setShowForm(false);
        toast.success("Subtask created");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to create subtask");
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
    }
    if (e.key === "Escape") {
      setShowForm(false);
      setTitle("");
    }
  };

  return (
    <div className="space-y-2">
      {/* Subtask List */}
      {subtasks.length > 0 && (
        <div className="space-y-1">
          {subtasks.map((subtask) => {
            const isOverdue =
              subtask.dueDate &&
              new Date(subtask.dueDate) < new Date() &&
              subtask.status !== "DONE";

            return (
              <Link
                key={subtask.id}
                href={`/tasks/${subtask.id}`}
                className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "size-2 rounded-full shrink-0",
                      subtask.status === "DONE"
                        ? "bg-green-500"
                        : subtask.status === "IN_PROGRESS"
                        ? "bg-blue-500"
                        : subtask.status === "IN_REVIEW"
                        ? "bg-amber-500"
                        : "bg-zinc-400"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm truncate",
                      subtask.status === "DONE"
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    )}
                  >
                    {subtask.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "border text-[10px] font-medium",
                      TASK_PRIORITY_COLORS[subtask.priority]
                    )}
                  >
                    {subtask.priority}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border text-[10px] font-medium",
                      STATUS_COLORS[subtask.status]
                    )}
                  >
                    {STATUS_LABELS[subtask.status] ?? subtask.status}
                  </Badge>
                  {subtask.dueDate && (
                    <span
                      className={cn(
                        "text-[11px]",
                        isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
                      )}
                    >
                      {new Intl.DateTimeFormat("en-IN", {
                        day: "numeric",
                        month: "short",
                      }).format(new Date(subtask.dueDate))}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {subtasks.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground py-2">
          No subtasks yet.
        </p>
      )}

      {/* Add Subtask */}
      {showForm ? (
        <div className="flex items-center gap-2 pt-2">
          <Input
            placeholder="Subtask title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 text-sm"
            disabled={isCreating}
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={handleCreate}
            disabled={isCreating || !title.trim()}
            className="h-8 shrink-0"
          >
            {isCreating ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              "Add"
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowForm(false);
              setTitle("");
            }}
            className="h-8 shrink-0"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-indigo-600 mt-1"
          onClick={() => setShowForm(true)}
        >
          <PlusIcon className="size-4" />
          Add subtask
        </Button>
      )}
    </div>
  );
}
