"use client";

// ============================================================
// Upcoming reminders on an enquiry (Contact). Reads the same Task records the
// personal calendar renders — scheduling here and opening /calendar show the
// same rows.
// ============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  BellRing, CalendarDays, CheckCircle2, ExternalLink, Phone, Users, MapPin, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listCrmTasksFor, updateCrmTaskStatus, type CrmEntityTaskDTO,
} from "@/actions/crm-task.actions";
import { cn } from "@/lib/utils";
import { EnquiryScheduleDialog } from "./enquiry-schedule-dialog";

const TYPE_STYLE: Record<string, { label: string; icon: typeof Phone; badge: string }> = {
  FOLLOW_UP:   { label: "Follow-up", icon: BellRing,      badge: "bg-violet-500/12 text-violet-700 ring-1 ring-inset ring-violet-500/25 dark:text-violet-300" },
  CALL:        { label: "Call",      icon: Phone,         badge: "bg-blue-500/12 text-blue-700 ring-1 ring-inset ring-blue-500/25 dark:text-blue-300" },
  MEETING:     { label: "Meeting",   icon: Users,         badge: "bg-amber-500/12 text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300" },
  SHOW_AROUND: { label: "Show-around", icon: MapPin,      badge: "bg-teal-500/12 text-teal-700 ring-1 ring-inset ring-teal-500/25 dark:text-teal-300" },
  TASK:        { label: "Task",      icon: ClipboardList, badge: "bg-zinc-500/12 text-zinc-700 ring-1 ring-inset ring-zinc-500/25 dark:text-zinc-300" },
};

function styleFor(taskType: string | null) {
  return TYPE_STYLE[taskType ?? "TASK"] ?? TYPE_STYLE.TASK;
}

export function EnquiryRemindersPanel({ contactId }: { contactId: string }) {
  const [tasks, setTasks] = useState<CrmEntityTaskDTO[]>([]);
  const [loading, setLoading] = useState(true);
  // Bumped after scheduling — router.refresh() only re-renders the server
  // component, so this client list needs its own nudge to refetch.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // `alive` drops a response that lands after the contact changed or the
    // panel unmounted, so a slow request can't overwrite newer state.
    let alive = true;
    (async () => {
      const res = await listCrmTasksFor({ contactId });
      if (!alive) return;
      if (res.success) setTasks(res.data);
      else toast.error(res.error);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [contactId, reloadKey]);

  async function markDone(id: string) {
    const res = await updateCrmTaskStatus(id, "DONE");
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Marked done");
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="size-4 text-amber-600" /> Reminders
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" asChild className="gap-1.5">
            <Link href="/calendar">
              <CalendarDays className="size-3.5" /> Calendar
            </Link>
          </Button>
          <EnquiryScheduleDialog
            contactId={contactId}
            onScheduled={() => setReloadKey((k) => k + 1)}
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-[13px] text-muted-foreground">Loading…</p>
        ) : tasks.length === 0 ? (
          <EmptyState
            className="py-8"
            icon={<CalendarDays />}
            title="Nothing scheduled"
            description="Book a meeting, call or follow-up — it lands on the assignee's calendar and notifies them."
          />
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => {
              const style = styleFor(t.taskType);
              const Icon = style.icon;
              const due = new Date(t.dueDate);
              return (
                <li
                  key={t.id}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border bg-card p-3 shadow-card",
                    t.isOverdue && "border-red-500/40 bg-red-500/5"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", style.badge)}>
                        <Icon className="size-3" />
                        {style.label}
                      </span>
                      {t.isOverdue && (
                        <span className="inline-flex items-center rounded-full bg-red-500/12 px-2 py-0.5 text-[11px] font-semibold text-red-600 ring-1 ring-inset ring-red-500/25 dark:text-red-400">
                          Overdue
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm font-medium" title={t.title}>{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(due, "EEE dd MMM, h:mm a")}
                      {t.assigneeName && <> · {t.assigneeName}</>}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => markDone(t.id)}>
                    <CheckCircle2 className="size-3.5" /> Done
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {tasks.length > 0 && (
          <Link
            href="/calendar"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            See these on your calendar
            <ExternalLink className="size-3" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
