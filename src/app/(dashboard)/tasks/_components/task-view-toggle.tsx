"use client";

import React, { useState } from "react";
import { LayoutGridIcon, ListIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskBoard } from "./task-board";
import { TaskList } from "./task-list";
import type { TaskItem } from "./task-board";

// ============================================================
// Types
// ============================================================

interface TaskViewToggleProps {
  tasks: TaskItem[];
  tasksByStatus: Record<string, TaskItem[]>;
}

// ============================================================
// Component
// ============================================================

export function TaskViewToggle({ tasks, tasksByStatus }: TaskViewToggleProps) {
  const [view, setView] = useState<"board" | "list">("board");

  return (
    <div className="flex h-full flex-col">
      {/* View Toggle */}
      <div className="mb-4 flex items-center gap-1 rounded-lg border bg-zinc-50 p-1 w-fit">
        <button
          onClick={() => setView("board")}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            view === "board"
              ? "bg-background text-foreground shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
          )}
        >
          <LayoutGridIcon className="size-4" />
          Board
        </button>
        <button
          onClick={() => setView("list")}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            view === "list"
              ? "bg-background text-foreground shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
          )}
        >
          <ListIcon className="size-4" />
          List
        </button>
      </div>

      {/* View Content */}
      <div className="flex-1 overflow-hidden">
        {view === "board" ? (
          <TaskBoard initialTasksByStatus={tasksByStatus} />
        ) : (
          <TaskList tasks={tasks} />
        )}
      </div>
    </div>
  );
}
