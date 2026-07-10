"use client";

import { useState } from "react";
import { LayoutList, KanbanIcon } from "lucide-react";

import { ViewTabs } from "@/components/ui/view-tabs";
import { TaskList } from "./task-list";
import { TasksBoardView } from "./tasks-board-view";
import type { TaskItem } from "./task-board";

// ============================================================
// TasksViews — ClickUp-style List / Board switcher for the Tasks module.
// List (default) keeps the existing table untouched; Board is a read-only
// KanbanBoard over the SAME already-fetched tasks. View-layer only.
// ============================================================

type View = "list" | "board";

interface TasksViewsProps {
  tasks: TaskItem[];
}

export function TasksViews({ tasks }: TasksViewsProps) {
  const [view, setView] = useState<View>("list");

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4">
        <ViewTabs
          value={view}
          onValueChange={setView}
          options={[
            { value: "list", label: "List", icon: LayoutList },
            { value: "board", label: "Board", icon: KanbanIcon },
          ]}
        />
      </div>

      {view === "list" ? (
        <div className="flex-1 overflow-y-auto pb-4">
          <TaskList tasks={tasks} />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <TasksBoardView tasks={tasks} />
        </div>
      )}
    </div>
  );
}
