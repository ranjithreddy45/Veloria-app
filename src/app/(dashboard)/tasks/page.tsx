import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { getTasks } from "@/actions/task.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
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
  const completedTasks = tasksByStatus.DONE.length;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <PageHeader
        title="Tasks"
        description={`${totalTasks} tasks, ${completedTasks} completed`}
      >
        <Button asChild>
          <Link href="/tasks/new">
            <PlusIcon className="mr-2 size-4" />
            New Task
          </Link>
        </Button>
      </PageHeader>

      <div className="mt-6 flex-1 overflow-hidden">
        <TaskViewToggle tasks={tasks} tasksByStatus={tasksByStatus} />
      </div>
    </div>
  );
}
