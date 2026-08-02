"use client";

// ============================================================
// Workqueue — the user's personal worklist. Colorful StatTiles (open / overdue
// / due-today / my leads / my bookings) + a tasks table that surfaces overdue
// work first with a "Late by N days" red treatment. Visual-only; reads from
// getMyWorkqueue.
// ============================================================

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListChecks, AlarmClock, CalendarClock, Users, CalendarCheck, ArrowRight } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { WorkqueueData, WorkqueueTask } from "@/actions/workqueue.actions";

const PRIORITY_HUE: Record<string, Hue> = { URGENT: "rose", HIGH: "amber", MEDIUM: "blue", LOW: "slate" };
const STATUS_HUE: Record<string, Hue> = { TODO: "slate", IN_PROGRESS: "blue", IN_REVIEW: "violet" };
const STATUS_LABEL: Record<string, string> = { TODO: "Not started", IN_PROGRESS: "In progress", IN_REVIEW: "In review" };

const DAY = 86_400_000;

function dueDisplay(due: string | null): { text: string; tone: "late" | "today" | "soon" | "none" } {
  if (!due) return { text: "No due date", tone: "none" };
  const d = new Date(due);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((dueDay.getTime() - startToday.getTime()) / DAY);
  if (diffDays < 0) return { text: `Late by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`, tone: "late" };
  if (diffDays === 0) return { text: "Due today", tone: "today" };
  if (diffDays === 1) return { text: "Due tomorrow", tone: "soon" };
  return { text: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), tone: "soon" };
}

export function Workqueue({ data, userName }: { data: WorkqueueData; userName: string }) {
  const router = useRouter();
  const { tasks, counts } = data;

  return (
    <div className="space-y-5">
      {/* Personal stat strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 animate-stagger-1">
        <StatTile label="Open tasks" value={counts.open} accent="indigo" icon={<ListChecks className="size-4" />} />
        <StatTile label="Overdue" value={counts.overdue} accent="rose" icon={<AlarmClock className="size-4" />} sub={counts.overdue > 0 ? "Needs attention" : "All clear"} />
        <StatTile label="Due today" value={counts.dueToday} accent="amber" icon={<CalendarClock className="size-4" />} />
        <StatTile label="My leads" value={counts.leads} accent="gold" icon={<Users className="size-4" />} />
        <StatTile label="My bookings" value={counts.bookings} accent="emerald" icon={<CalendarCheck className="size-4" />} />
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <QuickLink href="/leads" label="My leads" />
        <QuickLink href="/bookings" label="My bookings" />
        <QuickLink href="/tasks" label="All tasks" />
      </div>

      {/* Tasks */}
      <Card className="border-0 shadow-card">
        <CardContent className="px-0">
          <div className="flex items-center justify-between px-4 pb-2">
            <h2 className="text-base font-semibold">My tasks</h2>
            <span className="text-xs text-muted-foreground">{counts.overdue > 0 ? `${counts.overdue} overdue · ` : ""}{counts.open} open</span>
          </div>
          {tasks.length === 0 ? (
            <EmptyState tone="success" icon={<ListChecks className="size-5" />} title="Inbox zero 🎉" description={`Nothing on your plate, ${userName}. Enjoy it.`} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Related to</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => <TaskRow key={t.id} t={t} onOpen={() => router.push(`/tasks/${t.id}`)} />)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TaskRow({ t, onOpen }: { t: WorkqueueTask; onOpen: () => void }) {
  const due = dueDisplay(t.dueDate);
  return (
    <TableRow
      className="cursor-pointer transition-premium hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open task: ${t.title}`}
    >
      <TableCell className="font-medium">{t.title}</TableCell>
      <TableCell>
        <span className={
          due.tone === "late" ? "text-body font-medium text-rose-600 dark:text-rose-400"
            : due.tone === "today" ? "text-body font-medium text-amber-600 dark:text-amber-400"
            : "text-body text-muted-foreground"
        }>{due.text}</span>
      </TableCell>
      <TableCell><StatusPill label={STATUS_LABEL[t.status] ?? t.status} hue={STATUS_HUE[t.status] ?? "slate"} size="xs" /></TableCell>
      <TableCell><StatusPill label={t.priority[0] + t.priority.slice(1).toLowerCase()} hue={PRIORITY_HUE[t.priority] ?? "slate"} size="xs" /></TableCell>
      <TableCell className="max-w-[260px] truncate text-body text-muted-foreground" title={t.related ?? undefined}>
        {t.related ?? "—"}
      </TableCell>
    </TableRow>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-1.5 text-body font-medium shadow-card transition-premium hover:shadow-card-hover">
      {label}
      <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
