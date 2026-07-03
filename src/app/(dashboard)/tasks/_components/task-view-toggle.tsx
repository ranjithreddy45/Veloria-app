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
      <div className="mb-4 flex items-center gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
        <button
          onClick={() => setView("board")}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            view === "board"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
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
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ListIcon className="size-4" />
          List
        </button>
      </div>

      {/* View Content */}
      {/* Board manages its own internal column scroll, so it stays clipped to
          the available height. The list, however, is a plain table with no
          internal scroll region — inside `overflow-hidden` it gets clipped and
          only the first row(s) stay visible. Give the list view its own
          vertical scroll so every row is reachable. */}
      {view === "board" ? (
        <div className="flex-1 overflow-hidden">
          <TaskBoard initialTasksByStatus={tasksByStatus} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-4">
          <TaskList tasks={tasks} />
        </div>
      )}
    </div>
  );
}
