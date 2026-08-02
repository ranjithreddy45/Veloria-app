import type { Metadata } from "next";
import type React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  PencilIcon,
  LinkIcon,
  ChevronRightIcon,
  ListChecks,
} from "lucide-react";

import { getTask } from "@/actions/task.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatusPill } from "@/components/shared/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TASK_PRIORITY_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { TaskChecklist } from "./_components/task-checklist";
import { TaskSubtasks } from "./_components/task-subtasks";
import { TaskStatusSelect } from "./_components/task-status-select";
import { TaskDeleteButton } from "./_components/task-delete-button";
import { EntityActivityTimeline } from "@/components/shared/entity-activity-timeline";

export const metadata: Metadata = { title: "Task Details" };

// ============================================================
// Status Colors
// ============================================================

const TASK_STATUS_COLORS: Record<string, string> = {
  TODO: "bg-zinc-100 text-zinc-700 border-zinc-200",
  IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
  IN_REVIEW: "bg-amber-100 text-amber-700 border-amber-200",
  DONE: "bg-green-100 text-green-700 border-green-200",
};

// ============================================================
// Section shell — consistent card + heading + muted description
// ============================================================

function Section({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-copy font-semibold tracking-[-0.01em]">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-body text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-meta uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className={cn("mt-1 text-sm", mono && "numeric")}>{children}</div>
    </div>
  );
}

// ============================================================
// Task Detail Page
// ============================================================

interface TaskDetailPageProps {
  params: Promise<{ taskId: string }>;
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { taskId } = await params;
  const taskResult = await getTask(taskId);

  if (!taskResult.success || !taskResult.data) {
    notFound();
  }

  const task = taskResult.data;

  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== "DONE";

  // Checklist progress
  const totalChecklist = task.checklistItems.length;
  const completedChecklist = task.checklistItems.filter(
    (i) => i.isCompleted
  ).length;
  const checklistProgress =
    totalChecklist > 0
      ? Math.round((completedChecklist / totalChecklist) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ListChecks}
        accent="blue"
        title={task.title}
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/tasks" className="transition-colors hover:text-foreground">
              Tasks
            </Link>
            <ChevronRightIcon className="size-3 opacity-50" />
            {task.parent ? (
              <Link
                href={`/tasks/${task.parent.id}`}
                className="truncate transition-colors hover:text-foreground"
              >
                {task.parent.title}
              </Link>
            ) : (
              <span>Task</span>
            )}
          </span>
        }
      >
        <TaskStatusSelect taskId={task.id} currentStatus={task.status} />
        <Button variant="outline" asChild>
          <Link href={`/tasks/${task.id}/edit`}>
            <PencilIcon className="mr-2 size-4" />
            Edit
          </Link>
        </Button>
        <TaskDeleteButton taskId={task.id} taskTitle={task.title} />
      </PageHeader>

      {/* ============================================================
          At-a-glance strip — priority, due, assignee, progress
          ============================================================ */}
      <div className="grid gap-5 rounded-2xl border bg-card p-5 shadow-card sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Priority">
          <Badge
            variant="outline"
            className={cn("border font-medium", TASK_PRIORITY_COLORS[task.priority])}
          >
            {task.priority}
          </Badge>
        </Field>

        <Field label="Due date" mono>
          {task.dueDate ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className={cn(isOverdue && "font-medium text-destructive")}>
                {format(new Date(task.dueDate), "dd MMM yyyy")}
              </span>
              {isOverdue && <StatusPill label="Overdue" hue="red" size="xs" />}
            </span>
          ) : (
            <span className="text-muted-foreground">No due date</span>
          )}
        </Field>

        <Field label="Assignee">
          {task.assignee ? (
            task.assignee.name ?? task.assignee.email
          ) : (
            <span className="text-muted-foreground">Unassigned</span>
          )}
        </Field>

        <Field label="Checklist">
          {totalChecklist > 0 ? (
            <div className="space-y-1.5">
              <p className="numeric">
                {completedChecklist} / {totalChecklist} done
              </p>
              <Progress value={checklistProgress} className="h-1.5" />
            </div>
          ) : (
            <span className="text-muted-foreground">No items</span>
          )}
        </Field>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ============================================================
            Main column
            ============================================================ */}
        <div className="space-y-4 lg:col-span-2">
          {task.description && (
            <Section
              title="Description"
              description="The full brief for whoever picks this up."
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {task.description}
              </p>
            </Section>
          )}

          <Section
            title="Checklist"
            description="Step-by-step items that make this task done."
            aside={
              totalChecklist > 0 ? (
                <div className="flex w-28 items-center gap-2">
                  <Progress value={checklistProgress} className="h-1.5 flex-1" />
                  <span className="numeric text-meta text-muted-foreground">
                    {checklistProgress}%
                  </span>
                </div>
              ) : undefined
            }
          >
            <TaskChecklist taskId={task.id} items={task.checklistItems} />
          </Section>

          <Section
            title="Subtasks"
            description="Smaller pieces of work rolled up under this task."
            aside={
              task.subtasks.length > 0 ? (
                <Badge variant="outline" className="numeric">
                  {task.subtasks.length}
                </Badge>
              ) : undefined
            }
          >
            <TaskSubtasks taskId={task.id} subtasks={task.subtasks} />
          </Section>

          <Section
            title="Activity"
            description="Every change made to this task, newest first."
          >
            <EntityActivityTimeline entityType="Task" entityId={task.id} />
          </Section>
        </div>

        {/* ============================================================
            Sidebar
            ============================================================ */}
        <div className="space-y-4">
          <Section
            title="Details"
            description="Ownership, timing, and what this task is attached to."
          >
            <div className="space-y-5">
              <Field label="Status">
                <div className="mt-0.5">
                  <StatusBadge
                    status={task.status}
                    colorMap={TASK_STATUS_COLORS}
                  />
                </div>
              </Field>

              <Field label="Created by">
                {task.creator.name ?? task.creator.email}
              </Field>

              {task.booking && (
                <Field label="Linked booking">
                  <Link
                    href={`/bookings/${task.booking.id}`}
                    className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
                  >
                    <LinkIcon className="size-3.5" />
                    {task.booking.eventName}
                  </Link>
                </Field>
              )}

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <Field label="Created" mono>
                  {format(new Date(task.createdAt), "dd MMM yyyy, HH:mm")}
                </Field>
                {task.completedAt && (
                  <Field label="Completed" mono>
                    {format(new Date(task.completedAt), "dd MMM yyyy, HH:mm")}
                  </Field>
                )}
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
