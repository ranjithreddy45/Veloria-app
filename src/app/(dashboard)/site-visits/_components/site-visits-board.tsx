"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  UserCheck,
  UserPlus,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  confirmSiteVisit,
  updateSiteVisitStatus,
  reassignSiteVisit,
  type SiteVisitRow,
  type SiteVisitStats,
} from "@/actions/site-visit.actions";

// ============================================================
// INTERNAL client board — calendar-grouped site visits with per-row actions
// (confirm / complete / no-show / cancel / reassign). Reads only the gated
// site-visit.actions; mutations re-fetch via router.refresh().
// ============================================================

interface Props {
  initialUpcoming: SiteVisitRow[];
  initialPast: SiteVisitRow[];
  stats: SiteVisitStats | null;
  assignees: { id: string; name: string | null }[];
  canManage: boolean;
}

const STATUS_BADGE: Record<
  SiteVisitRow["status"],
  { label: string; cls: string }
> = {
  REQUESTED: { label: "Requested", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  CONFIRMED: { label: "Confirmed", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  COMPLETED: { label: "Completed", cls: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" },
  CANCELLED: { label: "Cancelled", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
  NO_SHOW: { label: "No-show", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
  RESCHEDULED: { label: "Rescheduled", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" },
};

export function SiteVisitsBoard({
  initialUpcoming,
  initialPast,
  stats,
  assignees,
  canManage,
}: Props) {
  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Upcoming" value={stats.upcoming} accent="violet" icon={<CalendarClock />} />
          <StatTile label="Requested" value={stats.requested} accent="amber" icon={<Clock />} />
          <StatTile label="Confirmed" value={stats.confirmed} accent="emerald" icon={<CalendarCheck />} />
          <StatTile label="Completed" value={stats.completed} accent="indigo" icon={<CheckCircle2 />} />
          <StatTile label="No-shows" value={stats.noShow} accent="rose" icon={<XCircle />} />
          <StatTile label="Show rate" value={`${stats.showRate}%`} accent="emerald" pct={stats.showRate} />
        </div>
      )}

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({initialUpcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({initialPast.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-4">
          <VisitList rows={initialUpcoming} assignees={assignees} canManage={canManage} />
        </TabsContent>
        <TabsContent value="past" className="mt-4">
          <VisitList rows={initialPast} assignees={assignees} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VisitList({
  rows,
  assignees,
  canManage,
}: {
  rows: SiteVisitRow[];
  assignees: { id: string; name: string | null }[];
  canManage: boolean;
}) {
  // Calendar-style grouping by date label.
  const groups = useMemo(() => {
    const map = new Map<string, SiteVisitRow[]>();
    for (const r of rows) {
      const key = r.dateLabel;
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/50 p-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
        No visits here yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(([day, dayRows]) => (
        <div key={day} className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <CalendarClock className="size-3.5" />
            {day}
          </p>
          <div className="space-y-2">
            {dayRows.map((r) => (
              <VisitCard key={r.id} row={r} assignees={assignees} canManage={canManage} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function VisitCard({
  row,
  assignees,
  canManage,
}: {
  row: SiteVisitRow;
  assignees: { id: string; name: string | null }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showReassign, setShowReassign] = useState(false);
  const badge = STATUS_BADGE[row.status];
  const isOpen = row.status === "REQUESTED" || row.status === "CONFIRMED" || row.status === "RESCHEDULED";

  function run(fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.success) {
        toast.success(okMsg);
        router.refresh();
      } else {
        toast.error(res.error || "Something went wrong.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {row.customerName}
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {row.kindLabel}
            </Badge>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {row.timeLabel}
            </span>
            {row.venueName && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {row.venueName}
              </span>
            )}
            <a href={`tel:${row.customerPhone}`} className="flex items-center gap-1 hover:text-zinc-700">
              <Phone className="size-3" />
              {row.customerPhone}
            </a>
            {row.assignedToName && (
              <span className="flex items-center gap-1">
                <UserCheck className="size-3" />
                {row.assignedToName}
              </span>
            )}
            {row.guestCount ? <span>{row.guestCount} guests</span> : null}
            {row.eventType ? <span>{row.eventType}</span> : null}
          </div>
          {row.leadId && (
            <a
              href={`/leads/${row.leadId}`}
              className="inline-block text-[11px] font-medium text-violet-600 hover:underline"
            >
              View lead →
            </a>
          )}
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {row.status === "REQUESTED" || row.status === "RESCHEDULED" ? (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(() => confirmSiteVisit(row.id), "Visit confirmed.")}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="mr-1 size-3.5" /> Confirm
              </Button>
            ) : null}
            {isOpen && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => updateSiteVisitStatus(row.id, { status: "COMPLETED" }),
                      "Marked complete."
                    )
                  }
                >
                  Complete
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => updateSiteVisitStatus(row.id, { status: "NO_SHOW" }),
                      "Marked no-show."
                    )
                  }
                >
                  No-show
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => updateSiteVisitStatus(row.id, { status: "CANCELLED" }),
                      "Visit cancelled."
                    )
                  }
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                >
                  Cancel
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setShowReassign((s) => !s)}
            >
              <UserPlus className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {showReassign && canManage && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <span className="text-xs text-zinc-500">Reassign to:</span>
          <select
            defaultValue={row.assignedToId ?? ""}
            disabled={pending}
            onChange={(e) => {
              const userId = e.target.value;
              if (!userId) return;
              run(() => reassignSiteVisit(row.id, userId), "Reassigned.");
              setShowReassign(false);
            }}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900"
          >
            <option value="">Choose…</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || "Unnamed"}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
