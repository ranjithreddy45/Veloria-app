import type { Metadata } from "next";
import {
  CircleDashedIcon,
  CircleDotIcon,
  CircleCheckIcon,
  AlertTriangleIcon,
} from "lucide-react";

import { auth } from "@/../auth";
import { getTasks } from "@/actions/task.actions";
import { PageHeader } from "@/components/layout/page-header";
import { QuickActions, type QuickActionSpec } from "@/components/ui/quick-actions";
import { PageHelp } from "@/lib/page-help";
import { visibleActions } from "@/lib/permission-claims";
import { StatTile } from "@/components/ui/stat-tile";
import { TasksViews } from "./_components/tasks-views";

export const metadata: Metadata = { title: "Tasks" };

// ============================================================
// Tasks Page (Server Component)
// ============================================================

export default async function TasksPage() {
  const [result, session] = await Promise.all([getTasks(), auth()]);
  const tasks = result.success ? result.data!.data : [];

  // Group tasks by status for the board view
  const tasksByStatus = {
    TODO: tasks.filter((t) => t.status === "TODO"),
    IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS"),
    IN_REVIEW: tasks.filter((t) => t.status === "IN_REVIEW"),
    DONE: tasks.filter((t) => t.status === "DONE"),
  };

  const totalTasks = tasks.length;
  const todoCount = tasksByStatus.TODO.length;
  const inProgressCount = tasksByStatus.IN_PROGRESS.length;
  const inReviewCount = tasksByStatus.IN_REVIEW.length;
  const completedTasks = tasksByStatus.DONE.length;

  // Overdue = has a due date in the past and not yet completed.
  const now = Date.now();
  const overdueCount = tasks.filter(
    (t) =>
      t.status !== "DONE" &&
      t.dueDate != null &&
      new Date(t.dueDate).getTime() < now
  ).length;

  // Active = everything not yet done (drives the In-progress tile's progress ring).
  const activeCount = todoCount + inProgressCount + inReviewCount;
  const completionPct =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // The page's one action: its create, gated on the permission createTask
  // enforces. The calendar and bookings are reached from the sidebar.
  const actions = visibleActions<QuickActionSpec>(session, [
    {
      href: "/tasks/new",
      label: "New task",
      hint: "Assign work",
      permission: "tasks:create",
      primary: true,
    },
  ]);

  // A fixed-height column: the board below takes what is left. The column's
  // gap spaces only the children that render, so with no tasks (no tiles)
  // the List/Board tabs sit one gap under the header.
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-6">
      <PageHeader
        title="Tasks"
        help={<PageHelp id="tasks" />}
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Operations · Board</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{totalTasks}</span> tasks
            </span>
            {overdueCount > 0 && (
              <>
                <span className="h-3 w-px bg-border" />
                <span className="text-destructive">
                  <span className="font-semibold tabular-nums">{overdueCount}</span> overdue
                </span>
              </>
            )}
          </div>
        }
        description="Plan, assign, and ship the work behind every booking — from to-do to done."
        actions={<QuickActions actions={actions} />}
      />

      {totalTasks > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-fade-in-up">
          <StatTile
            label="To-do"
            value={todoCount}
            accent="blue"
            icon={<CircleDashedIcon className="size-4" />}
            sub={`${activeCount} active`}
          />
          <StatTile
            label="In progress"
            value={inProgressCount + inReviewCount}
            accent="gold"
            icon={<CircleDotIcon className="size-4" />}
            sub={inReviewCount > 0 ? `${inReviewCount} in review` : "underway"}
          />
          <StatTile
            label="Done"
            value={completedTasks}
            accent="emerald"
            icon={<CircleCheckIcon className="size-4" />}
            pct={completionPct}
          />
          <StatTile
            label="Overdue"
            value={overdueCount}
            accent={overdueCount > 0 ? "rose" : "teal"}
            icon={<AlertTriangleIcon className="size-4" />}
            sub={overdueCount > 0 ? "needs attention" : "all on track"}
          />
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <TasksViews tasks={tasks} />
      </div>
    </div>
  );
}
