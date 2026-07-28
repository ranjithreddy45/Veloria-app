"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable, DataTableColumnHeader } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { TASK_PRIORITY_COLORS } from "@/lib/constants";
import { deleteTask } from "@/actions/task.actions";
import type { TaskItem } from "./task-board";

// ============================================================
// Status Colors
// ============================================================

const TASK_STATUS_COLORS: Record<string, string> = {
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
// Columns
// ============================================================

function getColumns(
  onDelete: (id: string) => void,
  onNavigate: (id: string) => void,
  onEdit: (id: string) => void
): ColumnDef<TaskItem>[] {
  return [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
      cell: ({ row }) => (
        <button
          className="max-w-[300px] truncate font-medium text-left hover:underline"
          onClick={() => onNavigate(row.original.id)}
        >
          {row.getValue("title")}
        </button>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge
            variant="outline"
            className={cn(
              "border font-medium",
              TASK_STATUS_COLORS[status] ?? "bg-muted text-foreground/80"
            )}
          >
            {STATUS_LABELS[status] ?? status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "priority",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Priority" />
      ),
      cell: ({ row }) => {
        const priority = row.getValue("priority") as string;
        return (
          <Badge
            variant="outline"
            className={cn(
              "border font-medium",
              TASK_PRIORITY_COLORS[priority] ?? "bg-muted text-foreground/80"
            )}
          >
            {priority}
          </Badge>
        );
      },
    },
    {
      accessorKey: "dueDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Due Date" />
      ),
      cell: ({ row }) => {
        const date = row.getValue("dueDate") as Date | null;
        if (!date) return <span className="text-muted-foreground">--</span>;

        const isOverdue =
          new Date(date) < new Date() &&
          row.original.status !== "DONE";

        return (
          <span
            className={cn(
              "text-sm",
              isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
            )}
          >
            {format(new Date(date), "dd MMM yyyy")}
          </span>
        );
      },
    },
    {
      accessorKey: "assignee",
      header: "Assignee",
      cell: ({ row }) => {
        const assignee = row.original.assignee;
        if (!assignee) return <span className="text-muted-foreground">--</span>;

        const initials = assignee.name
          ? assignee.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
          : "?";

        return (
          <div className="flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarImage src={assignee.image ?? undefined} />
              <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-foreground truncate max-w-[120px]">
              {assignee.name ?? assignee.email}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "booking",
      header: "Booking",
      cell: ({ row }) => {
        const booking = row.original.booking;
        if (!booking) return <span className="text-muted-foreground">--</span>;
        return (
          <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
            {booking.eventName}
          </span>
        );
      },
    },
    {
      id: "checklist",
      header: "Checklist",
      cell: ({ row }) => {
        const items = row.original.checklistItems;
        if (!items || items.length === 0) {
          return <span className="text-muted-foreground">--</span>;
        }
        const completed = items.filter((i) => i.isCompleted).length;
        const total = items.length;
        const pct = Math.round((completed / total) * 100);

        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-12 rounded-full bg-muted">
              <div
                className={cn(
                  "h-1.5 rounded-full",
                  completed === total ? "bg-success" : "bg-blue-500"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {completed}/{total}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const task = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs">
                <MoreHorizontalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onNavigate(task.id)}>
                <ExternalLinkIcon className="mr-2 size-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(task.id)}>
                <PencilIcon className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(task.id)}
              >
                <TrashIcon className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

// ============================================================
// Props
// ============================================================

interface TaskListProps {
  tasks: TaskItem[];
}

// ============================================================
// Component
// ============================================================

export function TaskList({ tasks }: TaskListProps) {
  const router = useRouter();

  const handleDelete = async (id: string) => {
    const result = await deleteTask(id);
    if (result.success) {
      toast.success("Task deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleNavigate = (id: string) => {
    router.push(`/tasks/${id}`);
  };

  const handleEdit = (id: string) => {
    router.push(`/tasks/${id}/edit`);
  };

  const columns = getColumns(handleDelete, handleNavigate, handleEdit);

  return (
    <DataTable
      columns={columns}
      data={tasks}
      searchKey="title"
      searchPlaceholder="Search tasks..."
    />
  );
}
