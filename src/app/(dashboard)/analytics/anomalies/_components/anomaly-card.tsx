"use client";

import * as React from "react";
import {
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
  CalendarX2Icon,
  ClockIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  EyeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { acknowledgeAnomaly, resolveAnomaly } from "@/actions/anomaly.actions";
import { formatINR } from "@/lib/utils";

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

interface AnomalyCardProps {
  anomaly: AnomalyAlert;
  onUpdate: (updated: AnomalyAlert) => void;
}

// ============================================================
// Severity & Type Mappings
// ============================================================

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300",
  HIGH: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
  LOW: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
};

const SEVERITY_CARD_BORDER: Record<string, string> = {
  CRITICAL: "border-l-4 border-l-rose-500",
  HIGH: "border-l-4 border-l-orange-500",
  MEDIUM: "border-l-4 border-l-amber-500",
  LOW: "border-l-4 border-l-emerald-500",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  REVENUE_DROP: TrendingDownIcon,
  REVENUE_SPIKE: TrendingUpIcon,
  LEAD_VOLUME_CHANGE: UsersIcon,
  BOOKING_CANCELLATION_CLUSTER: CalendarX2Icon,
  PAYMENT_DELAY: ClockIcon,
  CONVERSION_RATE_DROP: BarChart3Icon,
};

const TYPE_LABELS: Record<string, string> = {
  REVENUE_DROP: "Revenue Drop",
  REVENUE_SPIKE: "Revenue Spike",
  LEAD_VOLUME_CHANGE: "Lead Volume Change",
  BOOKING_CANCELLATION_CLUSTER: "Cancellation Cluster",
  PAYMENT_DELAY: "Payment Delay",
  CONVERSION_RATE_DROP: "Conversion Rate Drop",
};

// ============================================================
// Helpers
// ============================================================

function getStatus(anomaly: AnomalyAlert): "Active" | "Acknowledged" | "Resolved" {
  if (anomaly.resolvedAt) return "Resolved";
  if (anomaly.acknowledgedAt) return "Acknowledged";
  return "Active";
}

function formatMetricValue(metric: string | null, value: number | null): string {
  if (value === null) return "--";
  if (metric?.includes("revenue") || metric?.includes("amount")) {
    return formatINR(value);
  }
  if (metric?.includes("rate")) {
    return `${value}%`;
  }
  return value.toLocaleString("en-IN");
}

// ============================================================
// Component
// ============================================================

export function AnomalyCard({ anomaly, onUpdate }: AnomalyCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [acknowledging, setAcknowledging] = React.useState(false);
  const [resolving, setResolving] = React.useState(false);

  const IconComponent = TYPE_ICONS[anomaly.type] ?? BarChart3Icon;
  const status = getStatus(anomaly);
  const severityStyle = SEVERITY_STYLES[anomaly.severity] ?? SEVERITY_STYLES.MEDIUM;
  const cardBorder = SEVERITY_CARD_BORDER[anomaly.severity] ?? "";
  const typeLabel = TYPE_LABELS[anomaly.type] ?? anomaly.type;

  const descriptionLines = anomaly.description.split("\n\n");
  const mainDescription = descriptionLines[0];
  const aiRecommendation = descriptionLines.find((l) =>
    l.startsWith("AI Recommendation:")
  );
  const isLongDescription = anomaly.description.length > 200;

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    try {
      const result = await acknowledgeAnomaly(anomaly.id);
      if (result.success) {
        toast.success("Anomaly acknowledged");
        onUpdate(result.data as unknown as AnomalyAlert);
      } else {
        toast.error(result.error ?? "Failed to acknowledge");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setAcknowledging(false);
    }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      const result = await resolveAnomaly(anomaly.id);
      if (result.success) {
        toast.success("Anomaly resolved");
        onUpdate(result.data as unknown as AnomalyAlert);
      } else {
        toast.error(result.error ?? "Failed to resolve");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setResolving(false);
    }
  };

  return (
    <Card className={`rounded-2xl border bg-card shadow-card transition-shadow hover:shadow-card-hover ${cardBorder}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-muted p-2">
              <IconComponent className="size-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[14.5px] font-semibold leading-none tracking-[-0.01em]">
                  {anomaly.title}
                </h3>
                <Badge
                  variant="outline"
                  className={`text-[11px] font-medium ${severityStyle}`}
                >
                  {anomaly.severity}
                </Badge>
                <Badge variant="secondary" className="text-[11px] font-medium">
                  {typeLabel}
                </Badge>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Detected{" "}
                {formatDistanceToNow(new Date(anomaly.detectedAt), {
                  addSuffix: true,
                })}
                {status === "Acknowledged" && anomaly.acknowledgedBy && (
                  <>
                    {" "}
                    &middot; Acknowledged by{" "}
                    {anomaly.acknowledgedBy.name ?? anomaly.acknowledgedBy.email}
                  </>
                )}
                {status === "Resolved" && (
                  <>
                    {" "}
                    &middot; Resolved{" "}
                    {anomaly.resolvedAt &&
                      formatDistanceToNow(new Date(anomaly.resolvedAt), {
                        addSuffix: true,
                      })}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <Badge
            variant={
              status === "Active"
                ? "destructive"
                : status === "Acknowledged"
                  ? "default"
                  : "secondary"
            }
          >
            {status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        <div className="text-sm text-muted-foreground">
          <p>{isLongDescription && !expanded ? `${mainDescription.slice(0, 200)}...` : mainDescription}</p>
          {expanded && aiRecommendation && (
            <p className="mt-2 rounded-md bg-blue-50 dark:bg-blue-950/50 p-3 text-blue-800 dark:text-blue-300 text-sm">
              {aiRecommendation}
            </p>
          )}
          {isLongDescription && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 h-auto p-0 text-xs"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUpIcon className="mr-1 size-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDownIcon className="mr-1 size-3" />
                  Show more
                </>
              )}
            </Button>
          )}
        </div>

        {/* Metric Info */}
        {(anomaly.expectedValue !== null || anomaly.actualValue !== null) && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl bg-muted/50 p-3.5 text-[13px]">
            {anomaly.expectedValue !== null && (
              <div>
                <span className="text-muted-foreground">Expected </span>
                <span className="numeric font-medium">
                  {formatMetricValue(anomaly.metric, anomaly.expectedValue)}
                </span>
              </div>
            )}
            {anomaly.actualValue !== null && (
              <div>
                <span className="text-muted-foreground">Actual </span>
                <span className="numeric font-medium">
                  {formatMetricValue(anomaly.metric, anomaly.actualValue)}
                </span>
              </div>
            )}
            {anomaly.deviationPercent !== null && (
              <div>
                <span className="text-muted-foreground">Deviation </span>
                <span
                  className={`numeric font-medium ${
                    anomaly.deviationPercent < 0
                      ? "text-destructive"
                      : "text-success"
                  }`}
                >
                  {anomaly.deviationPercent > 0 ? "+" : ""}
                  {anomaly.deviationPercent}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {status !== "Resolved" && (
          <div className="flex items-center gap-2">
            {status === "Active" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAcknowledge}
                disabled={acknowledging}
              >
                {acknowledging ? (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                ) : (
                  <EyeIcon className="mr-2 size-4" />
                )}
                Acknowledge
              </Button>
            )}
            {(status === "Active" || status === "Acknowledged") && (
              <Button
                variant="default"
                size="sm"
                onClick={handleResolve}
                disabled={resolving}
              >
                {resolving ? (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                ) : (
                  <CheckCircle2Icon className="mr-2 size-4" />
                )}
                Resolve
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
