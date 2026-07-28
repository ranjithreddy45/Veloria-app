"use client";

import { useState, useEffect } from "react";
import { ClockIcon, TimerIcon, AlertTriangleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskTimerProps {
  status: string;
  actualStart?: string | null;
  actualEnd?: string | null;
  slaFinishBy?: string | null;
  estimatedMinutes?: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timeLogs?: any[];
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function TaskTimer({
  status,
  actualStart,
  actualEnd,
  slaFinishBy,
  estimatedMinutes,
  timeLogs = [],
}: TaskTimerProps) {
  const [now, setNow] = useState(new Date());

  const isRunning = status === "IN_PROGRESS" && actualStart && !actualEnd;

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Calculate elapsed time
  const getElapsedSeconds = (): number => {
    if (!actualStart) return 0;
    const start = new Date(actualStart);
    const end = actualEnd ? new Date(actualEnd) : now;
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
  };

  // Calculate SLA remaining
  const getSlaRemaining = (): { seconds: number; isOverdue: boolean } | null => {
    if (!slaFinishBy) return null;
    const deadline = new Date(slaFinishBy);
    const diffMs = deadline.getTime() - now.getTime();
    return {
      seconds: Math.abs(Math.floor(diffMs / 1000)),
      isOverdue: diffMs < 0,
    };
  };

  const elapsed = getElapsedSeconds();
  const sla = getSlaRemaining();
  const estimatedSeconds = estimatedMinutes ? estimatedMinutes * 60 : 0;
  const progress = estimatedSeconds > 0 ? Math.min(100, (elapsed / estimatedSeconds) * 100) : 0;

  if (status === "NOT_STARTED" && !slaFinishBy) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {/* Elapsed Timer */}
      {(isRunning || actualEnd) && (
        <div className="flex items-center gap-1.5">
          <TimerIcon
            className={cn(
              "size-3.5",
              isRunning ? "text-blue-500 animate-pulse" : "text-muted-foreground"
            )}
          />
          <span
            className={cn(
              "font-mono tabular-nums",
              isRunning ? "text-blue-600 dark:text-blue-400 font-medium" : "text-muted-foreground"
            )}
          >
            {formatDuration(elapsed)}
          </span>
          {actualEnd && (
            <span className="text-muted-foreground">elapsed</span>
          )}
          {estimatedMinutes && isRunning && (
            <span className="text-muted-foreground">
              / {estimatedMinutes}min est.
            </span>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {isRunning && estimatedSeconds > 0 && (
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-1000",
              progress >= 100
                ? "bg-destructive"
                : progress >= 75
                  ? "bg-warning"
                  : "bg-blue-500"
            )}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}

      {/* SLA Countdown */}
      {sla && status !== "COMPLETED" && (
        <div
          className={cn(
            "flex items-center gap-1.5",
            sla.isOverdue
              ? "text-destructive font-medium"
              : "text-muted-foreground"
          )}
        >
          {sla.isOverdue ? (
            <AlertTriangleIcon className="size-3.5 text-destructive" />
          ) : (
            <ClockIcon className="size-3.5" />
          )}
          <span className="font-mono tabular-nums">
            {sla.isOverdue ? "OVERDUE " : ""}
            {formatDuration(sla.seconds)}
          </span>
          <span>{sla.isOverdue ? "past deadline" : "remaining"}</span>
        </div>
      )}

      {/* Time Logs Summary */}
      {timeLogs.length > 0 && (
        <div className="text-muted-foreground">
          {timeLogs.length} time {timeLogs.length === 1 ? "entry" : "entries"}
        </div>
      )}
    </div>
  );
}
