"use client";

import * as React from "react";
import {
  AlertTriangleIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  CheckCircle2Icon,
  FilterIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AnomalyStats } from "@/actions/anomaly.actions";
import { AnomalyCard } from "./anomaly-card";

// ============================================================
// Types
// ============================================================

interface AnomalyAlert {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  entityType: string | null;
  entityId: string | null;
  metric: string | null;
  expectedValue: number | null;
  actualValue: number | null;
  deviationPercent: number | null;
  detectedAt: string;
  acknowledgedAt: string | null;
  acknowledgedById: string | null;
  acknowledgedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  resolvedAt: string | null;
  isActive: boolean;
}

interface AnomalyDashboardProps {
  anomalies: AnomalyAlert[];
  stats: AnomalyStats | null;
}

// ============================================================
// Constants
// ============================================================

const ANOMALY_TYPES = [
  { value: "ALL", label: "All Types" },
  { value: "REVENUE_DROP", label: "Revenue Drop" },
  { value: "REVENUE_SPIKE", label: "Revenue Spike" },
  { value: "LEAD_VOLUME_CHANGE", label: "Lead Volume Change" },
  { value: "BOOKING_CANCELLATION_CLUSTER", label: "Cancellation Cluster" },
  { value: "PAYMENT_DELAY", label: "Payment Delay" },
  { value: "CONVERSION_RATE_DROP", label: "Conversion Rate Drop" },
];

// ============================================================
// Component
// ============================================================

export function AnomalyDashboard({ anomalies, stats }: AnomalyDashboardProps) {
  const [severityFilter, setSeverityFilter] = React.useState("ALL");
  const [typeFilter, setTypeFilter] = React.useState("ALL");
  const [alertList, setAlertList] = React.useState(anomalies);

  // Update list when anomalies prop changes
  React.useEffect(() => {
    setAlertList(anomalies);
  }, [anomalies]);

  // Filter anomalies
  const filteredAnomalies = React.useMemo(() => {
    return alertList.filter((a) => {
      if (severityFilter !== "ALL" && a.severity !== severityFilter) return false;
      if (typeFilter !== "ALL" && a.type !== typeFilter) return false;
      return true;
    });
  }, [alertList, severityFilter, typeFilter]);

  // Update a single alert in local state after acknowledge/resolve
  const handleAlertUpdate = React.useCallback(
    (updatedAlert: AnomalyAlert) => {
      setAlertList((prev) =>
        prev.map((a) => (a.id === updatedAlert.id ? updatedAlert : a))
      );
    },
    []
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total alerts"
          value={stats?.total ?? 0}
          accent="indigo"
          icon={<AlertTriangleIcon className="size-4" />}
          sub="All-time anomalies detected"
        />
        <StatTile
          label="Active"
          value={stats?.active ?? 0}
          accent="red"
          icon={<ShieldAlertIcon className="size-4" />}
          sub="Require attention"
        />
        <StatTile
          label="Acknowledged"
          value={stats?.acknowledged ?? 0}
          accent="amber"
          icon={<ShieldCheckIcon className="size-4" />}
          sub="Being investigated"
        />
        <StatTile
          label="Resolved"
          value={stats?.resolved ?? 0}
          accent="emerald"
          icon={<CheckCircle2Icon className="size-4" />}
          sub="Successfully addressed"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={severityFilter}
          onValueChange={setSeverityFilter}
          className="w-full sm:w-auto"
        >
          <TabsList>
            <TabsTrigger value="ALL">All</TabsTrigger>
            <TabsTrigger value="CRITICAL" className="text-rose-600 dark:text-rose-400">
              Critical
              {stats?.bySeverity.CRITICAL
                ? ` (${stats.bySeverity.CRITICAL})`
                : ""}
            </TabsTrigger>
            <TabsTrigger value="HIGH" className="text-orange-600 dark:text-orange-400">
              High
              {stats?.bySeverity.HIGH ? ` (${stats.bySeverity.HIGH})` : ""}
            </TabsTrigger>
            <TabsTrigger value="MEDIUM" className="text-amber-600 dark:text-amber-400">
              Medium
              {stats?.bySeverity.MEDIUM
                ? ` (${stats.bySeverity.MEDIUM})`
                : ""}
            </TabsTrigger>
            <TabsTrigger value="LOW" className="text-emerald-600 dark:text-emerald-400">
              Low
              {stats?.bySeverity.LOW ? ` (${stats.bySeverity.LOW})` : ""}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <FilterIcon className="size-4 text-muted-foreground" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              {ANOMALY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Alert List */}
      {filteredAnomalies.length === 0 ? (
        <Card className="rounded-2xl border bg-card shadow-card">
          <CardContent>
            <EmptyState
              icon={<ShieldCheckIcon />}
              tone="success"
              title={
                alertList.length === 0
                  ? "All clear — no anomalies"
                  : "Nothing matches these filters"
              }
              description={
                alertList.length === 0
                  ? "The detection engine runs periodically and will flag unusual movement in revenue, leads, cancellations and payments here."
                  : "Try widening the severity or type filter to see more alerts."
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAnomalies.map((anomaly) => (
            <AnomalyCard
              key={anomaly.id}
              anomaly={anomaly}
              onUpdate={handleAlertUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
