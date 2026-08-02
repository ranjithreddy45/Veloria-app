"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertTriangleIcon,
  CameraIcon,
  CheckCircle2Icon,
  CircleIcon,
  ClockIcon,
  GaugeIcon,
  ListChecksIcon,
  OctagonIcon,
  PlayIcon,
  SirenIcon,
  TimerIcon,
  UserIcon,
} from "lucide-react";
import {
  EVENT_PHASE_LABELS,
  EVENT_PHASE_COLORS,
  OPERATION_STATUS_COLORS,
  TASK_PRIORITY_COLORS,
  ESCALATION_LEVEL_LABELS,
  ESCALATION_STATUS_COLORS,
} from "@/lib/constants";

interface ControlDashboardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dashboard: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  escalations: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readiness?: any;
  bookingId: string;
}

export function ControlDashboard({
  dashboard,
  escalations,
  readiness,
  bookingId,
}: ControlDashboardProps) {
  const router = useRouter();

  // Auto-refresh every 30 seconds when the plan is LIVE
  useEffect(() => {
    if (dashboard?.planStatus === "LIVE") {
      const interval = setInterval(() => {
        router.refresh();
      }, 30000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [dashboard?.planStatus, router]);

  if (!dashboard) {
    return (
      <Card className="border-border shadow-sm">
        <CardContent className="py-16 text-center">
          <ListChecksIcon className="mx-auto size-12 text-muted-foreground/40 mb-3" />
          <h3 className="text-lg font-semibold mb-1">No Execution Plan Found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create an execution plan first to use the control dashboard.
          </p>
          <Button asChild>
            <Link href={`/bookings/${bookingId}/execution`}>
              Go to Execution Plan
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const {
    planStatus,
    totalTasks,
    completedTasks,
    inProgressTasks,
    blockedTasks,
    delayedTasks,
    overallProgress,
    phaseProgress,
    upcomingTasks,
    overdueTasks,
    phaseTimeline,
    proofNeeded,
  } = dashboard;

  function getTimeAgo(dateStr: string) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  }

  function getCountdown(dateStr: string) {
    const now = new Date();
    const target = new Date(dateStr);
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) return "NOW";
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  }

  function getOverdueTime(dateStr: string) {
    const now = new Date();
    const deadline = new Date(dateStr);
    const diffMs = now.getTime() - deadline.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m overdue`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m overdue`;
  }

  function fmtTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const TASK_STATUS_DOT: Record<string, string> = {
    COMPLETED: "bg-emerald-500",
    IN_PROGRESS: "bg-blue-500",
    BLOCKED: "bg-red-500",
    DELAYED: "bg-amber-500",
    NOT_STARTED: "bg-zinc-300 dark:bg-zinc-600",
  };

  // Across the whole timeline, find the single "current" task (in-progress, or
  // the earliest not-started whose start window has opened) and the "next"
  // upcoming not-started task — so we can highlight them on the day-of view.
  const flatTimeline: { id: string; status: string; slaStartBy?: string }[] =
    Array.isArray(phaseTimeline)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        phaseTimeline.flatMap((p: any) => p.tasks ?? [])
      : [];
  const nowMs = Date.now();
  const currentTask =
    flatTimeline.find((t) => t.status === "IN_PROGRESS") ??
    flatTimeline.find(
      (t) =>
        t.status === "NOT_STARTED" &&
        t.slaStartBy &&
        new Date(t.slaStartBy).getTime() <= nowMs
    );
  const nextTask = flatTimeline.find(
    (t) =>
      t.status === "NOT_STARTED" &&
      t.id !== currentTask?.id &&
      (!t.slaStartBy || new Date(t.slaStartBy).getTime() > nowMs)
  );
  const currentTaskId = currentTask?.id;
  const nextTaskId = nextTask?.id;

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {escalations.length > 0 && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 flex items-center gap-3">
          <SirenIcon className="size-6 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">
              {escalations.length} Active Escalation{escalations.length > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-destructive">
              Immediate attention required. Review escalated tasks below.
            </p>
          </div>
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
            {escalations.length}
          </Badge>
        </div>
      )}

      {/* Plan Status */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Plan Status:</span>
        <Badge
          variant="outline"
          className={OPERATION_STATUS_COLORS[planStatus] ?? ""}
        >
          {planStatus}
        </Badge>
        {planStatus === "LIVE" && (
          <span className="flex items-center gap-1 text-xs text-success">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-success" />
            </span>
            Auto-refreshing
          </span>
        )}
      </div>

      {/* Live Readiness Header */}
      {readiness && (
        <Card className="border-border shadow-sm overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <GaugeIcon
                  className={`size-9 ${
                    readiness.canGoLive
                      ? "text-success"
                      : readiness.readyPct >= 60
                      ? "text-warning"
                      : "text-destructive"
                  }`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-muted-foreground">
                    Event Readiness
                  </p>
                  {readiness.canGoLive ? (
                    <Badge
                      variant="outline"
                      className="text-meta px-1.5 py-0 bg-success/10 text-success border-success/20"
                    >
                      Ready to go live
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-meta px-1.5 py-0 bg-warning/10 text-warning border-warning/20"
                    >
                      Blocking gates open
                    </Badge>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <p
                    className={`text-3xl font-bold ${
                      readiness.canGoLive
                        ? "text-success"
                        : readiness.readyPct >= 60
                        ? "text-warning"
                        : "text-destructive"
                    }`}
                  >
                    {readiness.readyPct}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {readiness.readyCount}/{readiness.totalCount} gates ready
                  </p>
                </div>
                <Progress value={readiness.readyPct} className="h-1.5 mt-2" />
              </div>
            </div>

            {/* Gate chips */}
            {Array.isArray(readiness.gates) && readiness.gates.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {readiness.gates.map((g: any) => (
                  <span
                    key={g.key}
                    title={g.detail ?? undefined}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-meta ${
                      g.ready
                        ? "bg-success/10 text-success border-success/20"
                        : g.required
                        ? "bg-destructive/10 text-destructive border-destructive/20"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {g.ready ? (
                      <CheckCircle2Icon className="size-3" />
                    ) : (
                      <CircleIcon className="size-3" />
                    )}
                    {g.label}
                    {!g.ready && g.required && (
                      <span className="font-semibold">·req</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{totalTasks}</p>
              </div>
              <ListChecksIcon className="size-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-success">
                  {overallProgress}%
                </p>
              </div>
              <CheckCircle2Icon className="size-8 text-success/30" />
            </div>
            <Progress value={overallProgress} className="h-1.5 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {completedTasks} of {totalTasks}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">
                  {inProgressTasks}
                </p>
              </div>
              <PlayIcon className="size-8 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Blocked / Delayed
                </p>
                <p className="text-2xl font-bold text-destructive">
                  {blockedTasks + delayedTasks}
                </p>
              </div>
              <OctagonIcon className="size-8 text-destructive/30" />
            </div>
            {(blockedTasks > 0 || delayedTasks > 0) && (
              <p className="text-xs text-muted-foreground mt-1">
                {blockedTasks} blocked, {delayedTasks} delayed
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Phase Progress */}
      {phaseProgress && phaseProgress.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Phase Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {phaseProgress.map((phase: any) => (
                <div key={phase.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{phase.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-meta px-1.5 py-0 ${EVENT_PHASE_COLORS[phase.phase] ?? ""}`}
                      >
                        {EVENT_PHASE_LABELS[phase.phase] ?? phase.phase}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {phase.completedTasks}/{phase.totalTasks} ({phase.progress}%)
                    </span>
                  </div>
                  <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                      style={{
                        width: `${phase.progress}%`,
                        backgroundColor:
                          phase.progress === 100
                            ? "rgb(16, 185, 129)"
                            : phase.progress > 50
                            ? "rgb(59, 130, 246)"
                            : phase.progress > 0
                            ? "rgb(245, 158, 11)"
                            : "rgb(161, 161, 170)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Critical Items */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Overdue Tasks */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangleIcon className="size-4 text-destructive" />
              Overdue Tasks ({overdueTasks?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!overdueTasks || overdueTasks.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No overdue tasks. Everything is on track.
              </p>
            ) : (
              <div className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {overdueTasks.map((task: any) => (
                  <div
                    key={task.id}
                    className="rounded-lg bg-destructive/10 border border-destructive/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-meta px-1.5 py-0 ${TASK_PRIORITY_COLORS[task.priority] ?? ""}`}
                          >
                            {task.priority}
                          </Badge>
                          <Badge variant="outline" className="text-meta px-1.5 py-0">
                            {task.status?.replace("_", " ")}
                          </Badge>
                          {task.assignee && (
                            <span className="text-meta text-muted-foreground flex items-center gap-0.5">
                              <UserIcon className="size-2.5" />
                              {task.assignee.name ?? task.assignee.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-destructive shrink-0">
                        {task.slaFinishBy && getOverdueTime(task.slaFinishBy)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TimerIcon className="size-4 text-blue-500" />
              Upcoming Tasks ({upcomingTasks?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!upcomingTasks || upcomingTasks.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming tasks with SLA deadlines.
              </p>
            ) : (
              <div className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {upcomingTasks.map((task: any) => (
                  <div
                    key={task.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-meta px-1.5 py-0 ${TASK_PRIORITY_COLORS[task.priority] ?? ""}`}
                          >
                            {task.priority}
                          </Badge>
                          {task.assignee && (
                            <span className="text-meta text-muted-foreground flex items-center gap-0.5">
                              <UserIcon className="size-2.5" />
                              {task.assignee.name ?? task.assignee.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <ClockIcon className="size-3" />
                          {task.slaStartBy && getCountdown(task.slaStartBy)}
                        </span>
                        {task.slaStartBy && (
                          <p className="text-meta text-muted-foreground mt-0.5">
                            {new Date(task.slaStartBy).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Proof Needed */}
      {Array.isArray(proofNeeded) && proofNeeded.length > 0 && (
        <Card className="border-warning/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CameraIcon className="size-4 text-warning" />
              Photo Proof Needed ({proofNeeded.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {proofNeeded.map((task: any) => (
                <Link
                  key={task.id}
                  href={`/bookings/${bookingId}/execution`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-warning/10 border border-warning/20 p-3 transition-colors hover:bg-warning/10"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-meta px-1.5 py-0">
                        {task.status?.replace("_", " ")}
                      </Badge>
                      {task.assignee && (
                        <span className="text-meta text-muted-foreground flex items-center gap-0.5">
                          <UserIcon className="size-2.5" />
                          {task.assignee.name ?? task.assignee.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <CameraIcon className="size-4 text-warning shrink-0" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time-anchored Task Timeline */}
      {Array.isArray(phaseTimeline) && phaseTimeline.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecksIcon className="size-4 text-blue-500" />
              Run-of-Show Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {phaseTimeline.map((phase: any) => (
                <div key={phase.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-meta px-1.5 py-0 ${EVENT_PHASE_COLORS[phase.phase] ?? ""}`}
                    >
                      {EVENT_PHASE_LABELS[phase.phase] ?? phase.phase}
                    </Badge>
                    <span className="text-sm font-medium">{phase.name}</span>
                  </div>

                  {phase.tasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground pl-1">
                      No tasks in this phase.
                    </p>
                  ) : (
                    <div className="relative pl-4 space-y-1.5 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-border">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {phase.tasks.map((task: any) => {
                        const isCurrent = task.id === currentTaskId;
                        const isNext = task.id === nextTaskId;
                        const overdue =
                          task.slaFinishBy &&
                          task.status !== "COMPLETED" &&
                          new Date(task.slaFinishBy).getTime() < nowMs;
                        return (
                          <div
                            key={task.id}
                            className={`relative rounded-lg border p-2.5 ${
                              isCurrent
                                ? "border-blue-300 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-950/20 ring-1 ring-blue-300/50"
                                : isNext
                                ? "border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-indigo-950/10"
                                : "border-border"
                            }`}
                          >
                            <span
                              className={`absolute -left-[14px] top-3.5 size-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900 ${TASK_STATUS_DOT[task.status] ?? "bg-zinc-300"}`}
                            />
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-medium truncate">
                                    {task.title}
                                  </p>
                                  {isCurrent && (
                                    <Badge className="text-meta px-1.5 py-0 bg-blue-600 hover:bg-blue-600">
                                      NOW
                                    </Badge>
                                  )}
                                  {isNext && (
                                    <Badge
                                      variant="outline"
                                      className="text-meta px-1.5 py-0 border-indigo-300 text-indigo-600 dark:text-indigo-300"
                                    >
                                      NEXT
                                    </Badge>
                                  )}
                                  {task.requiresProof && (
                                    <CameraIcon className="size-3 text-warning" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap text-meta text-muted-foreground">
                                  <span className="flex items-center gap-0.5">
                                    <span
                                      className={`inline-block size-1.5 rounded-full ${TASK_STATUS_DOT[task.status] ?? "bg-zinc-300"}`}
                                    />
                                    {task.status?.replace("_", " ")}
                                  </span>
                                  {task.assignee && (
                                    <span className="flex items-center gap-0.5">
                                      <UserIcon className="size-2.5" />
                                      {task.assignee.name ?? task.assignee.email}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                {task.slaStartBy && (
                                  <p className="text-meta font-medium tabular-nums">
                                    {fmtTime(task.slaStartBy)}
                                  </p>
                                )}
                                {task.status === "NOT_STARTED" &&
                                  task.slaStartBy && (
                                    <p className="text-meta text-blue-600 dark:text-blue-400">
                                      starts {getCountdown(task.slaStartBy)}
                                    </p>
                                  )}
                                {overdue && task.slaFinishBy && (
                                  <p className="text-meta text-destructive font-semibold">
                                    {getOverdueTime(task.slaFinishBy)}
                                  </p>
                                )}
                                {!overdue &&
                                  task.status === "IN_PROGRESS" &&
                                  task.slaFinishBy && (
                                    <p className="text-meta text-warning">
                                      due {getCountdown(task.slaFinishBy)}
                                    </p>
                                  )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Escalations List */}
      {escalations.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <SirenIcon className="size-4 text-destructive" />
              Active Escalations ({escalations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {escalations.map((esc: any) => (
                <div
                  key={esc.id}
                  className="rounded-lg border border-destructive/20 bg-destructive/10 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={ESCALATION_STATUS_COLORS[esc.status] ?? ""}
                        >
                          {esc.status?.replace("_", " ")}
                        </Badge>
                        {esc.rule?.level && (
                          <Badge variant="secondary" className="text-xs">
                            {ESCALATION_LEVEL_LABELS[esc.rule.level] ?? esc.rule.level}
                          </Badge>
                        )}
                        {esc.rule?.name && (
                          <span className="text-xs text-muted-foreground">
                            Rule: {esc.rule.name}
                          </span>
                        )}
                      </div>
                      {esc.task && (
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">
                            {esc.task.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {esc.task.phase?.name && (
                              <span>Phase: {esc.task.phase.name}</span>
                            )}
                            {esc.task.assignee && (
                              <span className="flex items-center gap-0.5">
                                <UserIcon className="size-2.5" />
                                {esc.task.assignee.name ?? esc.task.assignee.email}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {esc.reason && (
                        <p className="text-xs text-muted-foreground">
                          {esc.reason}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {esc.delayMinutes != null && (
                        <p className="text-sm font-semibold text-destructive">
                          {esc.delayMinutes}m delay
                        </p>
                      )}
                      {esc.createdAt && (
                        <p className="text-meta text-muted-foreground mt-0.5">
                          {getTimeAgo(esc.createdAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
