import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  PencilIcon,
  CalendarIcon,
  UserIcon,
  LinkIcon,
  ArrowLeftIcon,
  ClipboardListIcon,
} from "lucide-react";

import { getTask } from "@/actions/task.actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
      {/* Breadcrumb / Back */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tasks">
            <ArrowLeftIcon className="mr-1 size-4" />
            Back to Tasks
          </Link>
        </Button>
        {task.parent && (
          <>
            <span className="text-zinc-300">/</span>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/tasks/${task.parent.id}`}>
                {task.parent.title}
              </Link>
            </Button>
          </>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{task.title}</h1>
            <Badge
              variant="outline"
              className={cn(
                "border font-medium",
                TASK_PRIORITY_COLORS[task.priority]
              )}
            >
              {task.priority}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <TaskStatusSelect
              taskId={task.id}
              currentStatus={task.status}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link
              href={`/tasks/${task.id}/edit`}
            >
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Link>
          </Button>
          <TaskDeleteButton taskId={task.id} taskTitle={task.title} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content (left 2 cols) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          {task.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-700 whitespace-pre-wrap">
                  {task.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Checklist */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardListIcon className="size-4 text-zinc-500" />
                <CardTitle className="text-base">Checklist</CardTitle>
                {totalChecklist > 0 && (
                  <span className="text-xs text-zinc-500">
                    {completedChecklist}/{totalChecklist}
                  </span>
                )}
              </div>
              {totalChecklist > 0 && (
                <div className="flex items-center gap-2 w-24">
                  <div className="h-1.5 flex-1 rounded-full bg-zinc-200">
                    <div
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        completedChecklist === totalChecklist
                          ? "bg-green-500"
                          : "bg-blue-500"
                      )}
                      style={{ width: `${checklistProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {checklistProgress}%
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <TaskChecklist
                taskId={task.id}
                items={task.checklistItems}
              />
            </CardContent>
          </Card>

          {/* Subtasks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subtasks</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskSubtasks
                taskId={task.id}
                subtasks={task.subtasks}
              />
            </CardContent>
          </Card>

          {/* Activity Log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <EntityActivityTimeline entityType="Task" entityId={task.id} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar (right col) */}
        <div className="space-y-6">
          {/* Task Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status */}
              <div>
                <p className="text-muted-foreground text-xs mb-1">Status</p>
                <StatusBadge
                  status={task.status}
                  colorMap={TASK_STATUS_COLORS}
                />
              </div>

              <Separator />

              {/* Priority */}
              <div>
                <p className="text-muted-foreground text-xs mb-1">Priority</p>
                <Badge
                  variant="outline"
                  className={cn(
                    "border font-medium",
                    TASK_PRIORITY_COLORS[task.priority]
                  )}
                >
                  {task.priority}
                </Badge>
              </div>

              <Separator />

              {/* Due Date */}
              <div>
                <p className="text-muted-foreground text-xs mb-1">Due Date</p>
                {task.dueDate ? (
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-sm",
                      isOverdue ? "text-red-600 font-medium" : "text-zinc-700"
                    )}
                  >
                    <CalendarIcon className="size-3.5" />
                    {format(new Date(task.dueDate), "dd MMM yyyy")}
                    {isOverdue && (
                      <Badge
                        variant="outline"
                        className="ml-1 border-red-200 bg-red-50 text-red-600 text-[10px]"
                      >
                        Overdue
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-zinc-400">No due date</span>
                )}
              </div>

              <Separator />

              {/* Assignee */}
              <div>
                <p className="text-muted-foreground text-xs mb-1">Assignee</p>
                {task.assignee ? (
                  <div className="flex items-center gap-2">
                    <UserIcon className="size-3.5 text-zinc-400" />
                    <span className="text-sm text-zinc-700">
                      {task.assignee.name ?? task.assignee.email}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-zinc-400">Unassigned</span>
                )}
              </div>

              <Separator />

              {/* Creator */}
              <div>
                <p className="text-muted-foreground text-xs mb-1">Created by</p>
                <div className="flex items-center gap-2">
                  <UserIcon className="size-3.5 text-zinc-400" />
                  <span className="text-sm text-zinc-700">
                    {task.creator.name ?? task.creator.email}
                  </span>
                </div>
              </div>

              {/* Linked Booking */}
              {task.booking && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">
                      Linked Booking
                    </p>
                    <Link
                      href={`/bookings/${task.booking.id}`}
                      className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"
                    >
                      <LinkIcon className="size-3.5" />
                      {task.booking.eventName}
                    </Link>
                  </div>
                </>
              )}

              <Separator />

              {/* Dates */}
              <div>
                <p className="text-muted-foreground text-xs mb-1">Created</p>
                <span className="text-sm text-zinc-600">
                  {format(new Date(task.createdAt), "dd MMM yyyy, HH:mm")}
                </span>
              </div>

              {task.completedAt && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">
                      Completed
                    </p>
                    <span className="text-sm text-zinc-600">
                      {format(
                        new Date(task.completedAt),
                        "dd MMM yyyy, HH:mm"
                      )}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
