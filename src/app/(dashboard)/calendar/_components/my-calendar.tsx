"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  format,
  parseISO,
  isToday,
  isTomorrow,
  isSameMonth,
} from "date-fns";
import { toast } from "sonner";
import {
  CalendarClock,
  Phone,
  Users,
  MapPin,
  CheckSquare,
  CheckCircle2,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CalendarX2,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  updateCrmTaskStatus,
  type CalendarTaskDTO,
} from "@/actions/crm-task.actions";

// ============================================================
// Task-type visual config (icon + colour). Kept generous so an
// unknown / null taskType still renders sensibly as a generic task.
// ============================================================

interface TypeStyle {
  label: string;
  icon: LucideIcon;
  /** Badge classes (used for the coloured type chip). */
  badge: string;
  /** Left accent rail colour. */
  rail: string;
}

const TYPE_STYLES: Record<string, TypeStyle> = {
  FOLLOW_UP: {
    label: "Follow-up",
    icon: CalendarClock,
    badge: "bg-blue-500/12 text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-500/25",
    rail: "bg-blue-500",
  },
  CALL: {
    label: "Call",
    icon: Phone,
    badge: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/25",
    rail: "bg-emerald-500",
  },
  MEETING: {
    label: "Meeting",
    icon: Users,
    badge: "bg-violet-500/12 text-violet-600 dark:text-violet-400 ring-1 ring-inset ring-violet-500/25",
    rail: "bg-violet-500",
  },
  SHOW_AROUND: {
    label: "Show-around",
    icon: MapPin,
    badge: "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-500/25",
    rail: "bg-amber-500",
  },
  TASK: {
    label: "Task",
    icon: CheckSquare,
    badge: "bg-slate-500/12 text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-slate-500/25",
    rail: "bg-slate-400",
  },
};

function styleFor(taskType: string | null): TypeStyle {
  return (taskType && TYPE_STYLES[taskType]) || TYPE_STYLES.TASK;
}

// ============================================================
// Day heading label
// ============================================================

function dayHeading(date: Date): string {
  if (isToday(date)) return `Today · ${format(date, "EEE, d MMM")}`;
  if (isTomorrow(date)) return `Tomorrow · ${format(date, "EEE, d MMM")}`;
  return format(date, "EEEE, d MMM");
}

// ============================================================
// Single task row (client interactions: mark done)
// ============================================================

function TaskRow({
  task,
  onDone,
}: {
  task: CalendarTaskDTO;
  onDone: (id: string) => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const style = styleFor(task.taskType);
  const Icon = style.icon;
  const due = parseISO(task.dueDate);
  const isDone = task.status === "DONE";
  const overdue = task.isOverdue && !isDone;

  const linkHref = task.leadId
    ? `/leads/${task.leadId}`
    : task.inquiryId
    ? `/inquiries`
    : null;

  function markDone() {
    startTransition(async () => {
      const res = await updateCrmTaskStatus(task.id, "DONE");
      if (res.success) {
        toast.success("Marked done");
        onDone(task.id);
      } else {
        toast.error(res.error || "Could not update task");
      }
    });
  }

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 overflow-hidden rounded-xl border border-border/60 bg-card p-3 pl-4 transition-colors",
        isDone ? "opacity-60" : "hover:border-border hover:bg-accent/30"
      )}
    >
      {/* Left accent rail */}
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          isDone ? "bg-emerald-500" : overdue ? "bg-red-500" : style.rail
        )}
        aria-hidden
      />

      {/* Time column */}
      <div className="w-14 shrink-0 pt-0.5 text-right">
        <div
          className={cn(
            "text-sm font-semibold tabular-nums",
            overdue ? "text-red-600 dark:text-red-400" : "text-foreground"
          )}
        >
          {format(due, "h:mm")}
        </div>
        <div className="text-[10px] font-medium uppercase text-muted-foreground">
          {format(due, "a")}
        </div>
      </div>

      {/* Main */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              style.badge
            )}
          >
            <Icon className="size-3" />
            {style.label}
          </span>
          {overdue && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 text-[11px] font-semibold text-red-600 ring-1 ring-inset ring-red-500/25 dark:text-red-400">
              Overdue
            </span>
          )}
          {isDone && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              Done
            </span>
          )}
        </div>
        <div
          className={cn(
            "mt-1 truncate text-sm font-medium",
            isDone && "line-through text-muted-foreground"
          )}
          title={task.title}
        >
          {task.title}
        </div>
        {linkHref && (
          <Link
            href={linkHref}
            className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {task.leadId ? "Open lead" : "Open enquiry"}
            <ExternalLink className="size-3" />
          </Link>
        )}
      </div>

      {/* Action */}
      {!isDone && (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={pending}
          onClick={markDone}
        >
          <Check className="mr-1 size-3.5" />
          {pending ? "Saving…" : "Mark done"}
        </Button>
      )}
    </div>
  );
}

// ============================================================
// Main agenda
// ============================================================

export function MyCalendar({
  tasks: initialTasks,
  month,
  year,
}: {
  tasks: CalendarTaskDTO[];
  month: number; // 1-12
  year: number;
}) {
  const router = useRouter();
  // Local status overrides for optimistic "mark done" without a full reload.
  const [doneIds, setDoneIds] = React.useState<Set<string>>(new Set());

  const tasks = React.useMemo(
    () =>
      initialTasks.map((t) =>
        doneIds.has(t.id)
          ? { ...t, status: "DONE", isOverdue: false }
          : t
      ),
    [initialTasks, doneIds]
  );

  function onDone(id: string) {
    setDoneIds((prev) => new Set(prev).add(id));
  }

  // Group by calendar day (already sorted asc by the server).
  const groups = React.useMemo(() => {
    const map = new Map<string, { date: Date; items: CalendarTaskDTO[] }>();
    for (const t of tasks) {
      const d = parseISO(t.dueDate);
      const key = format(d, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, { date: d, items: [] });
      map.get(key)!.items.push(t);
    }
    return Array.from(map.values());
  }, [tasks]);

  const pendingCount = tasks.filter((t) => t.status !== "DONE").length;
  const overdueCount = tasks.filter((t) => t.isOverdue && t.status !== "DONE").length;

  // Month navigation via URL query (server refetches the window).
  const prev = { m: month === 1 ? 12 : month - 1, y: month === 1 ? year - 1 : year };
  const next = { m: month === 12 ? 1 : month + 1, y: month === 12 ? year + 1 : year };
  const monthLabel = format(new Date(year, month - 1, 1), "MMMM yyyy");
  const isCurrentMonth = isSameMonth(new Date(), new Date(year, month - 1, 1));

  function go(m: number, y: number) {
    router.push(`/calendar?month=${m}&year=${y}`);
  }

  return (
    <div className="space-y-4">
      {/* Month toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => go(prev.m, prev.y)} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-[9.5rem] text-center text-base font-semibold tabular-nums">
            {monthLabel}
          </div>
          <Button variant="outline" size="icon" onClick={() => go(next.m, next.y)} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
          {!isCurrentMonth && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-1"
              onClick={() => {
                const now = new Date();
                go(now.getMonth() + 1, now.getFullYear());
              }}
            >
              Today
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{pendingCount}</span> pending
          </span>
          {overdueCount > 0 && (
            <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
              {overdueCount} overdue
            </span>
          )}
        </div>
      </div>

      {/* Agenda */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-card/50 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <CalendarX2 className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No scheduled tasks</p>
            <p className="text-sm text-muted-foreground">
              Nothing on your calendar for {monthLabel}.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const key = format(group.date, "yyyy-MM-dd");
            const today = isToday(group.date);
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <h2
                    className={cn(
                      "text-sm font-semibold",
                      today ? "text-primary" : "text-foreground"
                    )}
                  >
                    {dayHeading(group.date)}
                  </h2>
                  <span className="h-px flex-1 bg-border/60" />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {group.items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.items.map((t) => (
                    <TaskRow key={t.id} task={t} onDone={onDone} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
