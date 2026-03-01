"use client";

import * as React from "react";
import {
  AlertTriangleIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  CheckCircle2Icon,
  FilterIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <AlertTriangleIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
            <p className="text-xs text-muted-foreground">All time anomalies detected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <ShieldAlertIcon className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats?.active ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acknowledged</CardTitle>
            <ShieldCheckIcon className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              {stats?.acknowledged ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Being investigated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle2Icon className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {stats?.resolved ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Successfully addressed
            </p>
          </CardContent>
        </Card>
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
            <TabsTrigger value="CRITICAL" className="text-red-600">
              Critical
              {stats?.bySeverity.CRITICAL
                ? ` (${stats.bySeverity.CRITICAL})`
                : ""}
            </TabsTrigger>
            <TabsTrigger value="HIGH" className="text-orange-600">
              High
              {stats?.bySeverity.HIGH ? ` (${stats.bySeverity.HIGH})` : ""}
            </TabsTrigger>
            <TabsTrigger value="MEDIUM" className="text-yellow-600">
              Medium
              {stats?.bySeverity.MEDIUM
                ? ` (${stats.bySeverity.MEDIUM})`
                : ""}
            </TabsTrigger>
            <TabsTrigger value="LOW" className="text-emerald-600">
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
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldCheckIcon className="size-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No Anomalies Found</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
              {alertList.length === 0
                ? "No anomalies have been detected yet. The detection engine runs periodically to monitor your business metrics."
                : "No anomalies match the current filters. Try adjusting the severity or type filters."}
            </p>
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
