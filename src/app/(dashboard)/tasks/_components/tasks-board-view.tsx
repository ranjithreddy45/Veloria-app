"use client";

import Link from "next/link";
import { CalendarIcon, LinkIcon } from "lucide-react";

import {
  KanbanBoard,
  type KanbanColumn,
  type ColumnHue,
} from "@/components/ui/kanban-board";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { TaskItem } from "./task-board";

// ============================================================
// TasksBoardView — read-only ClickUp-style board built on the shared
// KanbanBoard primitive. Groups the already-fetched tasks by status.
// No drag/drop, no server calls — pure view layer.
// ============================================================

const COLUMN_DEFS: { id: string; label: string; hue: ColumnHue }[] = [
  { id: "TODO", label: "To do", hue: "slate" },
  { id: "IN_PROGRESS", label: "In progress", hue: "amber" },
  { id: "IN_REVIEW", label: "In review", hue: "violet" },
  { id: "DONE", label: "Done", hue: "emerald" },
];

const STATUS_PILL: Record<string, { label: string; hue: Hue }> = {
  TODO: { label: "To Do", hue: "slate" },
  IN_PROGRESS: { label: "In Progress", hue: "amber" },
  IN_REVIEW: { label: "In Review", hue: "violet" },
  DONE: { label: "Done", hue: "emerald" },
};

const PRIORITY_PILL: Record<string, { label: string; hue: Hue }> = {
  LOW: { label: "Low", hue: "slate" },
  MEDIUM: { label: "Medium", hue: "blue" },
  HIGH: { label: "High", hue: "orange" },
  URGENT: { label: "Urgent", hue: "red" },
};

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

/** Returns "overdue" | "soon" | "none" for due-date urgency (DONE never flags). */
function dueUrgency(date: Date | null, status: string): "overdue" | "soon" | "none" {
  if (!date || status === "DONE") return "none";
  const due = new Date(date);
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round(
    (dueDay.getTime() - startOfToday.getTime()) / 86_400_000
  );
  if (diffDays < 0) return "overdue";
  if (diffDays <= 2) return "soon";
  return "none";
}

function getInitials(name: string | null, email: string): string {
  const base = name?.trim() || email;
  return base
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface TasksBoardViewProps {
  tasks: TaskItem[];
}

export function TasksBoardView({ tasks }: TasksBoardViewProps) {
  const columns: KanbanColumn<TaskItem>[] = COLUMN_DEFS.map((def) => ({
    id: def.id,
    label: def.label,
    hue: def.hue,
    items: tasks.filter((t) => t.status === def.id),
  }));

  return (
    <KanbanBoard
      columns={columns}
      getKey={(t) => t.id}
      emptyLabel="No tasks"
      renderCard={(task) => {
        const status = STATUS_PILL[task.status];
        const priority = PRIORITY_PILL[task.priority];
        const urgency = dueUrgency(task.dueDate, task.status);

        return (
          <Link href={`/tasks/${task.id}`} className="block space-y-2.5">
            {/* Title */}
            <p className="text-[13px] font-semibold leading-snug text-foreground line-clamp-2">
              {task.title}
            </p>

            {/* Type (priority) + status pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {status && (
                <StatusPill label={status.label} hue={status.hue} size="xs" />
              )}
              {priority && (
                <StatusPill
                  label={priority.label}
                  hue={priority.hue}
                  size="xs"
                />
              )}
            </div>

            {/* Linked booking / enquiry */}
            {task.booking && (
              <div className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
                <LinkIcon className="size-3 shrink-0" />
                <span className="truncate">{task.booking.eventName}</span>
              </div>
            )}

            {/* Footer: due date + assignee */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              {task.dueDate ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11.5px] font-medium",
                    urgency === "overdue"
                      ? "text-red-600 dark:text-red-400"
                      : urgency === "soon"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="size-3" />
                  {formatDate(task.dueDate)}
                </span>
              ) : (
                <span />
              )}

              {task.assignee && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <Avatar className="size-5 shrink-0">
                    <AvatarImage src={task.assignee.image ?? undefined} />
                    <AvatarFallback className="text-[9px] bg-indigo-100 text-indigo-700">
                      {getInitials(task.assignee.name, task.assignee.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-[11.5px] text-muted-foreground max-w-[96px]">
                    {task.assignee.name ?? task.assignee.email}
                  </span>
                </div>
              )}
            </div>
          </Link>
        );
      }}
    />
  );
}
