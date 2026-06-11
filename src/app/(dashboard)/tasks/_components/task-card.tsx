"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  CalendarIcon,
  CheckSquareIcon,
  GitBranchIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TASK_PRIORITY_COLORS } from "@/lib/constants";
import type { TaskItem } from "./task-board";

// ============================================================
// Helpers
// ============================================================

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

function isOverdue(date: Date | null): boolean {
  if (!date) return false;
  return new Date(date) < new Date() && new Date(date).toDateString() !== new Date().toDateString();
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================
// Props
// ============================================================

interface TaskCardProps {
  task: TaskItem;
  isOverlay?: boolean;
}

// ============================================================
// Component
// ============================================================

export function TaskCard({ task, isOverlay = false }: TaskCardProps) {
  const router = useRouter();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "task",
      status: task.status,
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Checklist progress
  const totalChecklist = task.checklistItems?.length ?? 0;
  const completedChecklist =
    task.checklistItems?.filter((i) => i.isCompleted).length ?? 0;
  const checklistProgress =
    totalChecklist > 0
      ? Math.round((completedChecklist / totalChecklist) * 100)
      : 0;

  const overdue = isOverdue(task.dueDate) && task.status !== "DONE";
  const priorityColor =
    TASK_PRIORITY_COLORS[task.priority] ??
    "bg-muted text-foreground/80 border-border";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group cursor-pointer rounded-lg border border-border bg-card shadow-sm transition-all hover:shadow-md",
        isDragging && "opacity-40 shadow-lg",
        isOverlay && "shadow-xl ring-2 ring-indigo-300"
      )}
    >
      <div className="flex">
        {/* Drag Handle */}
        <div className="flex items-start pt-3 pl-1">
          <button
            className="shrink-0 cursor-grab touch-none rounded p-0.5 text-zinc-300 opacity-100 transition-opacity hover:text-zinc-500 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </button>
        </div>

        <div
          className="flex flex-1 flex-col p-3 pl-1 min-w-0"
          onClick={() => router.push(`/tasks/${task.id}`)}
        >
          {/* Title + Priority */}
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium leading-tight text-zinc-800 line-clamp-2">
              {task.title}
            </h4>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 border text-[10px] font-medium px-1.5 py-0",
                priorityColor
              )}
            >
              {task.priority}
            </Badge>
          </div>

          {/* Booking name */}
          {task.booking && (
            <p className="mt-1 text-xs text-zinc-400 truncate">
              {task.booking.eventName}
            </p>
          )}

          {/* Bottom row: due date, checklist, subtasks, assignee */}
          <div className="mt-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Due Date */}
              {task.dueDate && (
                <div
                  className={cn(
                    "flex items-center gap-1",
                    overdue ? "text-red-500" : "text-zinc-400"
                  )}
                >
                  <CalendarIcon className="size-3" />
                  <span className="text-[11px] font-medium">
                    {formatDate(task.dueDate)}
                  </span>
                </div>
              )}

              {/* Checklist progress */}
              {totalChecklist > 0 && (
                <div className="flex items-center gap-1.5">
                  <CheckSquareIcon
                    className={cn(
                      "size-3",
                      completedChecklist === totalChecklist
                        ? "text-green-500"
                        : "text-zinc-400"
                    )}
                  />
                  <span className="text-[11px] text-zinc-500">
                    {completedChecklist}/{totalChecklist}
                  </span>
                  {/* Mini progress bar */}
                  <div className="h-1 w-8 rounded-full bg-zinc-200">
                    <div
                      className={cn(
                        "h-1 rounded-full transition-all",
                        completedChecklist === totalChecklist
                          ? "bg-green-500"
                          : "bg-blue-500"
                      )}
                      style={{ width: `${checklistProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Subtask count */}
              {task._count.subtasks > 0 && (
                <div className="flex items-center gap-1 text-zinc-400">
                  <GitBranchIcon className="size-3" />
                  <span className="text-[11px]">
                    {task._count.subtasks}
                  </span>
                </div>
              )}
            </div>

            {/* Assignee avatar */}
            {task.assignee && (
              <Avatar className="size-5">
                <AvatarImage src={task.assignee.image ?? undefined} />
                <AvatarFallback className="text-[9px] bg-indigo-100 text-indigo-700">
                  {getInitials(task.assignee.name)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
