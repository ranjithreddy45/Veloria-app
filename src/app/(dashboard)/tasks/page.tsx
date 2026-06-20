import type { Metadata } from "next";
import Link from "next/link";
import {
  PlusIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleCheckIcon,
  AlertTriangleIcon,
} from "lucide-react";

import { getTasks } from "@/actions/task.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { TaskViewToggle } from "./_components/task-view-toggle";

export const metadata: Metadata = { title: "Tasks" };

// ============================================================
// Tasks Page (Server Component)
// ============================================================

export default async function TasksPage() {
  const result = await getTasks();
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

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <PageHeader
        aura
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
                <span className="text-rose-600">
                  <span className="font-semibold tabular-nums">{overdueCount}</span> overdue
                </span>
              </>
            )}
          </div>
        }
        description="Plan, assign, and ship the work behind every booking — from to-do to done."
      >
        <Button asChild>
          <Link href="/tasks/new">
            <PlusIcon className="mr-2 size-4" />
            New Task
          </Link>
        </Button>
      </PageHeader>

      {totalTasks > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 animate-fade-in-up">
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
            accent="violet"
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

      <div className="mt-6 flex-1 overflow-hidden">
        <TaskViewToggle tasks={tasks} tasksByStatus={tasksByStatus} />
      </div>
    </div>
  );
}
