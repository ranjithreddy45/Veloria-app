"use client";

import * as React from "react";
import {
  ArrowUpDown,
  TrendingUpIcon,
  UsersIcon,
  IndianRupeeIcon,
  TargetIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import type { TeamMemberPerformance } from "@/actions/performance.actions";

// ============================================================
// Props
// ============================================================

interface TeamPerformanceTableProps {
  data: TeamMemberPerformance[];
}

// ============================================================
// Role badge color mapping
// ============================================================

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  ADMIN:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  SALES_EXEC:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  SALES_HEAD:
    "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  EVENT_COORDINATOR:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  FINANCE:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  STAFF:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

function formatRole(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

// ============================================================
// Sort types
// ============================================================

type SortKey = keyof Pick<
  TeamMemberPerformance,
  "revenueGenerated" | "bookingsWon" | "leadsConverted" | "conversionRate" | "avgDealSize"
>;

// ============================================================
// Team Performance Table Component
// ============================================================

export function TeamPerformanceTable({ data }: TeamPerformanceTableProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>("revenueGenerated");
  const [sortAsc, setSortAsc] = React.useState(false);

  const sorted = React.useMemo(() => {
    return [...data].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortAsc ? diff : -diff;
    });
  }, [data, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  // Compute max revenue for mini bar widths
  const maxRevenue = Math.max(...data.map((d) => d.revenueGenerated), 1);

  // Summary stats
  const totalRevenue = data.reduce((s, d) => s + d.revenueGenerated, 0);
  const totalBookings = data.reduce((s, d) => s + d.bookingsWon, 0);
  const totalLeadsConverted = data.reduce((s, d) => s + d.leadsConverted, 0);
  const avgConversion =
    data.length > 0
      ? Math.round(
          data.reduce((s, d) => s + d.conversionRate, 0) / data.length
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IndianRupeeIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Across {data.length} team members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Bookings
            </CardTitle>
            <UsersIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalBookings.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-muted-foreground">
              Bookings managed by team
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Leads Converted
            </CardTitle>
            <TrendingUpIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalLeadsConverted.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-muted-foreground">
              Won deals in period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Conversion Rate
            </CardTitle>
            <TargetIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgConversion}%</div>
            <p className="text-xs text-muted-foreground">
              Team average
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Performance</CardTitle>
          <CardDescription>
            Performance metrics for each team member. Click column headers to
            sort.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                    Member
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                    Role
                  </th>
                  <th className="px-3 py-3 text-right">
                    <SortButton
                      active={sortKey === "revenueGenerated"}
                      asc={sortAsc}
                      onClick={() => handleSort("revenueGenerated")}
                    >
                      Revenue
                    </SortButton>
                  </th>
                  <th className="hidden px-3 py-3 text-right sm:table-cell">
                    <SortButton
                      active={sortKey === "bookingsWon"}
                      asc={sortAsc}
                      onClick={() => handleSort("bookingsWon")}
                    >
                      Bookings
                    </SortButton>
                  </th>
                  <th className="hidden px-3 py-3 text-right md:table-cell">
                    <SortButton
                      active={sortKey === "leadsConverted"}
                      asc={sortAsc}
                      onClick={() => handleSort("leadsConverted")}
                    >
                      Leads Won
                    </SortButton>
                  </th>
                  <th className="hidden px-3 py-3 text-right lg:table-cell">
                    <SortButton
                      active={sortKey === "avgDealSize"}
                      asc={sortAsc}
                      onClick={() => handleSort("avgDealSize")}
                    >
                      Avg Deal
                    </SortButton>
                  </th>
                  <th className="px-3 py-3 text-right">
                    <SortButton
                      active={sortKey === "conversionRate"}
                      asc={sortAsc}
                      onClick={() => handleSort("conversionRate")}
                    >
                      Conversion
                    </SortButton>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-12 text-center text-muted-foreground"
                    >
                      No team performance data available.
                    </td>
                  </tr>
                ) : (
                  sorted.map((member) => (
                    <tr
                      key={member.userId}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          {/* Initials avatar */}
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                            {getInitials(member.userName)}
                          </div>
                          <span className="font-medium text-foreground">
                            {member.userName}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant="secondary"
                          className={
                            ROLE_COLORS[member.role] ?? ROLE_COLORS.STAFF
                          }
                        >
                          {formatRole(member.role)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-semibold text-foreground">
                            {formatINR(member.revenueGenerated)}
                          </span>
                          {/* Mini bar */}
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-all"
                              style={{
                                width: `${(member.revenueGenerated / maxRevenue) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-3 py-3 text-right sm:table-cell">
                        <span className="font-medium text-muted-foreground">
                          {member.bookingsWon.toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="hidden px-3 py-3 text-right md:table-cell">
                        <span className="font-medium text-muted-foreground">
                          {member.leadsConverted.toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="hidden px-3 py-3 text-right lg:table-cell">
                        <span className="font-medium text-muted-foreground">
                          {formatINR(member.avgDealSize)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <ConversionBadge rate={member.conversionRate} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function SortButton({
  children,
  active,
  asc,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  asc: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-mr-2 h-auto gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      onClick={onClick}
    >
      {children}
      <ArrowUpDown
        className={`size-3 ${active ? "text-indigo-500" : "text-zinc-300 dark:text-zinc-600"}`}
      />
      {active && (
        <span className="sr-only">{asc ? "ascending" : "descending"}</span>
      )}
    </Button>
  );
}

function ConversionBadge({ rate }: { rate: number }) {
  const color =
    rate >= 60
      ? "bg-success/15 text-success"
      : rate >= 30
        ? "bg-warning/15 text-warning"
        : "bg-muted text-muted-foreground";

  return (
    <Badge variant="secondary" className={color}>
      {rate}%
    </Badge>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name[0] ?? "?").toUpperCase();
}
