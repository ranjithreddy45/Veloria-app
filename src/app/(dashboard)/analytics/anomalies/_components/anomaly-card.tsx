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
  CRITICAL: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
};

const SEVERITY_CARD_BORDER: Record<string, string> = {
  CRITICAL: "border-l-4 border-l-red-500",
  HIGH: "border-l-4 border-l-orange-500",
  MEDIUM: "border-l-4 border-l-yellow-500",
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
    <Card className={cardBorder}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-muted p-2">
              <IconComponent className="size-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold leading-none">{anomaly.title}</h3>
                <Badge variant="outline" className={severityStyle}>
                  {anomaly.severity}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {typeLabel}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
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
          <div className="flex flex-wrap gap-4 rounded-md bg-muted/50 p-3 text-sm">
            {anomaly.expectedValue !== null && (
              <div>
                <span className="text-muted-foreground">Expected: </span>
                <span className="font-medium">
                  {formatMetricValue(anomaly.metric, anomaly.expectedValue)}
                </span>
              </div>
            )}
            {anomaly.actualValue !== null && (
              <div>
                <span className="text-muted-foreground">Actual: </span>
                <span className="font-medium">
                  {formatMetricValue(anomaly.metric, anomaly.actualValue)}
                </span>
              </div>
            )}
            {anomaly.deviationPercent !== null && (
              <div>
                <span className="text-muted-foreground">Deviation: </span>
                <span
                  className={`font-medium ${
                    anomaly.deviationPercent < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
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
