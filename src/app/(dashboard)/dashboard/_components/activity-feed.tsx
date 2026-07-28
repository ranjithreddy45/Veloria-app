"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Activity } from "lucide-react";
import { getActivityLogs } from "@/actions/activity.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================
// ActivityFeed — a live team pulse on the dashboard. Polls the existing
// activity log every 30s so the app feels active ("Priya just confirmed a
// booking"). Read-only; no effect on app logic.
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
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export function ActivityFeed() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "activity-feed"],
    queryFn: () => getActivityLogs({ limit: 8 }),
    // Poll at a relaxed cadence to keep the feed feeling live without piling
    // redundant load onto the DB when many staff have the dashboard open.
    // Don't also refetch on every window focus — the interval already covers it.
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  // The action can resolve to { success:false } (e.g. transient fetch error).
  // Treat that as an error state rather than silently masking it as "no
  // activity", which would mislead the user into thinking nothing happened.
  const failed = isError || (data ? !data.success : false);
  const logs: Log[] =
    data && data.success ? (data.data.logs as unknown as Log[]) : [];

  return (
    <Card className="rounded-2xl border bg-card shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <span className="relative inline-flex size-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-success/60 opacity-75" />
            <span className="relative size-1.5 rounded-full bg-success" />
          </span>
          <Activity className="size-4 text-primary" />
          Live activity
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3">
        {isLoading ? (
          <div className="space-y-3 px-3 py-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-7 rounded-full" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            ))}
          </div>
        ) : failed ? (
          <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
            Couldn’t load activity right now — it’ll refresh automatically in a moment.
          </p>
        ) : logs.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
            No recent activity yet — it’ll show up here as your team works.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {logs.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
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
                    <span className="text-muted-foreground">{pretty(l.action)}</span>{" "}
                    <span className="text-foreground/80">
                      {l.entityType.toLowerCase()}
                    </span>
                  </p>
                </div>
                <span className="numeric shrink-0 text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(l.createdAt), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
