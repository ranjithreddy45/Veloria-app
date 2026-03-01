"use client";

import * as React from "react";
import {
  UserIcon,
  CalendarIcon,
  IndianRupeeIcon,
  TargetIcon,
  CheckCircle2Icon,
  ClockIcon,
  StarIcon,
  TrendingUpIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR } from "@/lib/utils";
import {
  getIndividualMetrics,
  type IndividualMetrics,
} from "@/actions/performance.actions";

// ============================================================
// Props
// ============================================================

interface IndividualPerformanceProps {
  teamMembers: { id: string; name: string | null; role: string }[];
}

// ============================================================
// Trend indicator
// ============================================================

function TrendIndicator({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0) {
    return (
      <span className="text-xs text-zinc-400 dark:text-zinc-500">--</span>
    );
  }

  return (
    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
      {value.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

// ============================================================
// Individual Performance Component
// ============================================================

export function IndividualPerformance({
  teamMembers,
}: IndividualPerformanceProps) {
  const [selectedUserId, setSelectedUserId] = React.useState<string>("");
  const [metrics, setMetrics] = React.useState<IndividualMetrics | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!selectedUserId) {
      setMetrics(null);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        const result = await getIndividualMetrics(selectedUserId);
        if (!cancelled && result.success) {
          setMetrics(result.data);
        }
      } catch {
        // Keep null on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [selectedUserId]);

  const selectedMember = teamMembers.find((m) => m.id === selectedUserId);

  return (
    <div className="space-y-6">
      {/* Member selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="size-5 text-indigo-500" />
            Individual Performance
          </CardTitle>
          <CardDescription>
            Select a team member to view their detailed performance metrics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="Select a team member..." />
            </SelectTrigger>
            <SelectContent>
              {teamMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name ?? "Unknown"} ({formatRole(member.role)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="size-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !metrics && selectedUserId === "" && (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center">
              <UserIcon className="mx-auto size-10 text-zinc-300 dark:text-zinc-600" />
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                Select a team member above to view their performance.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics display */}
      {!loading && metrics && selectedMember && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
              {getInitials(selectedMember.name ?? "U")}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {selectedMember.name}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {formatRole(selectedMember.role)}
              </p>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={
                <CalendarIcon className="size-4 text-blue-500" />
              }
              label="Bookings Managed"
              value={metrics.bookingsManaged.toLocaleString("en-IN")}
              detail={<TrendIndicator value={metrics.bookingsManaged} suffix=" total" />}
            />
            <MetricCard
              icon={
                <IndianRupeeIcon className="size-4 text-emerald-500" />
              }
              label="Revenue Generated"
              value={formatINR(metrics.revenueGenerated)}
              detail={
                <TrendIndicator
                  value={
                    metrics.bookingsManaged > 0
                      ? Math.round(
                          metrics.revenueGenerated / metrics.bookingsManaged
                        )
                      : 0
                  }
                  suffix=" avg/booking"
                />
              }
            />
            <MetricCard
              icon={
                <TargetIcon className="size-4 text-indigo-500" />
              }
              label="Leads Assigned"
              value={metrics.leadsAssigned.toLocaleString("en-IN")}
              detail={
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {metrics.leadsConverted.toLocaleString("en-IN")} converted
                </span>
              }
            />
            <MetricCard
              icon={
                <TrendingUpIcon className="size-4 text-amber-500" />
              }
              label="Conversion Rate"
              value={`${metrics.conversionRate}%`}
              detail={
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full transition-all ${
                      metrics.conversionRate >= 60
                        ? "bg-emerald-500"
                        : metrics.conversionRate >= 30
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${metrics.conversionRate}%` }}
                  />
                </div>
              }
            />
            <MetricCard
              icon={
                <ClockIcon className="size-4 text-orange-500" />
              }
              label="Avg Response Time"
              value={
                metrics.avgResponseTime > 0
                  ? `${metrics.avgResponseTime}h`
                  : "--"
              }
              detail={
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {metrics.avgResponseTime > 0
                    ? metrics.avgResponseTime <= 24
                      ? "Within 24 hours"
                      : `${Math.round(metrics.avgResponseTime / 24)} days`
                    : "No data"}
                </span>
              }
            />
            <MetricCard
              icon={
                <CheckCircle2Icon className="size-4 text-green-500" />
              }
              label="Tasks Completed"
              value={metrics.tasksCompleted.toLocaleString("en-IN")}
              detail={<TrendIndicator value={metrics.tasksCompleted} suffix=" done" />}
            />
            <MetricCard
              icon={<StarIcon className="size-4 text-yellow-500" />}
              label="Average Rating"
              value={metrics.rating > 0 ? metrics.rating.toFixed(1) : "--"}
              detail={
                metrics.rating > 0 ? (
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <StarIcon
                        key={i}
                        className={`size-3 ${
                          i < Math.round(metrics.rating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "fill-muted text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    No reviews yet
                  </span>
                )
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MetricCard helper
// ============================================================

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {label}
          </span>
        </div>
        <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {value}
        </div>
        {detail && <div className="mt-1">{detail}</div>}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Helpers
// ============================================================

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
