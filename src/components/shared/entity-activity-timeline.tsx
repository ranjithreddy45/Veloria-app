"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { getEntityActivity } from "@/actions/activity.actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================
// EntityActivityTimeline — a compact, read-only activity timeline for a
// single entity (Task, Deal, …). Wired to the app's existing ActivityLog via
// getEntityActivity(entityType, entityId). Matches the dashboard ActivityFeed
// look. Loads lazily when `enabled` becomes true (e.g. when a sheet opens).
// ============================================================

type Log = {
  id: string;
  action: string;
  entityType: string;
  createdAt: string | Date;
  user?: { name?: string | null; image?: string | null } | null;
};

function pretty(action: string) {
  return action.toLowerCase().replace(/_/g, " ");
}

function initials(name?: string | null) {
  if (!name) return "—";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface EntityActivityTimelineProps {
  entityType: string;
  entityId: string;
  /** When false, the fetch is deferred (e.g. until a sheet opens). Default true. */
  enabled?: boolean;
}

export function EntityActivityTimeline({
  entityType,
  entityId,
  enabled = true,
}: EntityActivityTimelineProps) {
  const [logs, setLogs] = React.useState<Log[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!enabled || !entityId) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    getEntityActivity(entityType, entityId)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setLogs(res.data.logs as unknown as Log[]);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, enabled]);

  if (loading && logs === null) {
    return (
      <div className="space-y-3 py-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (failed) {
    return (
      <p className="py-6 text-center text-[13px] text-muted-foreground">
        Couldn&rsquo;t load activity right now — please retry in a moment.
      </p>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-muted-foreground">
        No activity yet.
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {logs.map((l) => (
        <li
          key={l.id}
          className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
        >
          <Avatar className="size-7">
            <AvatarImage src={l.user?.image || undefined} alt={l.user?.name || ""} />
            <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
              {initials(l.user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] leading-tight">
              <span className="font-medium text-foreground">
                {l.user?.name || "Someone"}
              </span>{" "}
              <span className="text-muted-foreground">{pretty(l.action)}</span>
            </p>
          </div>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {formatDistanceToNow(new Date(l.createdAt), { addSuffix: true })}
          </span>
        </li>
      ))}
    </ul>
  );
}
