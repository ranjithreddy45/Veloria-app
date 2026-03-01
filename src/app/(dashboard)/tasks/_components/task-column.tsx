"use client";

import React, { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TaskCard } from "./task-card";
import type { TaskItem, TaskStatus } from "./task-board";

// ============================================================
// Status Config
// ============================================================

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  TODO: {
    label: "To Do",
    color: "#71717a", // zinc-500
    bgColor: "bg-zinc-100/80",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "#3b82f6", // blue-500
    bgColor: "bg-blue-50/60",
  },
  IN_REVIEW: {
    label: "In Review",
    color: "#f59e0b", // amber-500
    bgColor: "bg-amber-50/60",
  },
  DONE: {
    label: "Done",
    color: "#22c55e", // green-500
    bgColor: "bg-green-50/60",
  },
};

// ============================================================
// Props
// ============================================================

interface TaskColumnProps {
  status: TaskStatus;
  tasks: TaskItem[];
}

// ============================================================
// Component
// ============================================================

export function TaskColumn({ status, tasks }: TaskColumnProps) {
  const config = STATUS_CONFIG[status];

  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: "column",
      status,
    },
  });

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div
      className={cn(
        "flex h-full w-[300px] min-w-[300px] flex-col rounded-xl transition-colors",
        config.bgColor,
        isOver && "ring-2 ring-indigo-200 bg-indigo-50/50"
      )}
    >
      {/* Colored top bar */}
      <div
        className="h-1.5 rounded-t-xl"
        style={{ backgroundColor: config.color }}
      />

      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-800">
            {config.label}
          </h3>
          <Badge
            variant="secondary"
            className="h-5 min-w-[20px] justify-center px-1.5 text-[10px] font-semibold"
          >
            {tasks.length}
          </Badge>
        </div>
      </div>

      {/* Task Cards Container */}
      <div
        ref={setNodeRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 py-8">
            <p className="text-xs text-zinc-400">Drop tasks here</p>
          </div>
        )}
      </div>
    </div>
  );
}
