"use client";

import * as React from "react";
import { TrophyIcon, MedalIcon, AwardIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR } from "@/lib/utils";
import {
  getLeaderboard,
  type LeaderboardEntry,
} from "@/actions/performance.actions";

// ============================================================
// Props
// ============================================================

interface LeaderboardProps {
  initialData: LeaderboardEntry[];
}

// ============================================================
// Types
// ============================================================

type Metric = "revenue" | "bookings" | "leads";
type Period = "month" | "quarter" | "year";

const METRIC_LABELS: Record<Metric, string> = {
  revenue: "Revenue",
  bookings: "Bookings",
  leads: "Leads Won",
};

const PERIOD_LABELS: Record<Period, string> = {
  month: "This Month",
  quarter: "This Quarter",
  year: "This Year",
};

// ============================================================
// Badge / Rank helpers
// ============================================================

function getRankBadge(rank: number) {
  switch (rank) {
    case 1:
      return (
        <div className="flex size-8 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
          <TrophyIcon className="size-4 text-yellow-600 dark:text-yellow-400" />
        </div>
      );
    case 2:
      return (
        <div className="flex size-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
          <MedalIcon className="size-4 text-zinc-600 dark:text-zinc-300" />
        </div>
      );
    case 3:
      return (
        <div className="flex size-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <AwardIcon className="size-4 text-amber-700 dark:text-amber-400" />
        </div>
      );
    default:
      return (
        <div className="flex size-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            {rank}
          </span>
        </div>
      );
  }
}

function getRankHighlightClass(rank: number): string {
  switch (rank) {
    case 1:
      return "bg-yellow-50/50 dark:bg-yellow-900/10 border-l-2 border-l-yellow-400";
    case 2:
      return "bg-zinc-50/50 dark:bg-zinc-800/30 border-l-2 border-l-zinc-400";
    case 3:
      return "bg-amber-50/50 dark:bg-amber-900/10 border-l-2 border-l-amber-400";
    default:
      return "";
  }
}

function formatMetricValue(value: number, metric: Metric): string {
  if (metric === "revenue") return formatINR(value);
  return value.toLocaleString("en-IN");
}

function formatRole(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name[0] ?? "?").toUpperCase();
}

// ============================================================
// Leaderboard Component
// ============================================================

export function Leaderboard({ initialData }: LeaderboardProps) {
  const [metric, setMetric] = React.useState<Metric>("revenue");
  const [period, setPeriod] = React.useState<Period>("month");
  const [data, setData] = React.useState<LeaderboardEntry[]>(initialData);
  const [loading, setLoading] = React.useState(false);

  // Fetch leaderboard when metric or period changes
  React.useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        const result = await getLeaderboard({ metric, period });
        if (!cancelled && result.success) {
          setData(result.data);
        }
      } catch {
        // Keep existing data on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [metric, period]);

  const maxValue = Math.max(...data.map((d) => d.metricValue), 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrophyIcon className="size-5 text-yellow-500" />
              Leaderboard
            </CardTitle>
            <CardDescription>
              Top performers ranked by {METRIC_LABELS[metric].toLowerCase()} for{" "}
              {PERIOD_LABELS[period].toLowerCase()}.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={metric}
              onValueChange={(v) => setMetric(v as Metric)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="bookings">Bookings</SelectItem>
                <SelectItem value="leads">Leads Won</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as Period)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="size-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <TrophyIcon className="mx-auto size-10 text-zinc-300 dark:text-zinc-600" />
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                No leaderboard data for this period.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((entry, index) => {
              const rank = index + 1;
              const barWidth =
                maxValue > 0 ? (entry.metricValue / maxValue) * 100 : 0;

              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-4 rounded-lg px-4 py-3 transition-colors ${getRankHighlightClass(rank)}`}
                >
                  {/* Rank badge */}
                  {getRankBadge(rank)}

                  {/* Avatar + Name */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                      {getInitials(entry.userName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {entry.userName}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {formatRole(entry.role)}
                      </p>
                    </div>
                  </div>

                  {/* Metric bar + value */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden h-2 w-24 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 sm:block">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="min-w-[90px] text-right text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {formatMetricValue(entry.metricValue, metric)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
