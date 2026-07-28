import {
  CheckCircle2Icon,
  AlertCircleIcon,
  RocketIcon,
  ShieldAlertIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { OperationReadiness } from "@/lib/ops/state-machine";

// ============================================================
// Readiness Panel — overall % ready bar + per-gate checklist,
// driven by computeOperationReadiness(). Pure presentation.
// ============================================================

export function ReadinessPanel({
  readiness,
}: {
  readiness: OperationReadiness;
}) {
  const { gates, readyCount, totalCount, readyPct, canGoLive } = readiness;

  const blocking = gates.filter((g) => g.required && !g.ready).length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {canGoLive ? (
              <RocketIcon className="size-5 text-success" />
            ) : (
              <ShieldAlertIcon className="size-5 text-warning" />
            )}
            Operations Readiness
          </CardTitle>

          {canGoLive ? (
            <Badge className="w-fit border-success/20 bg-success/10 text-success hover:bg-success/10">
              Ready to go live
            </Badge>
          ) : (
            <Badge className="w-fit border-warning/20 bg-warning/10 text-warning hover:bg-warning/10">
              {blocking} {blocking === 1 ? "gate" : "gates"} blocking
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Overall progress */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">
              {readyCount} of {totalCount} checks passing
            </span>
            <span
              className={cn(
                "text-lg font-semibold tabular-nums",
                canGoLive ? "text-success" : "text-warning"
              )}
            >
              {readyPct}%
            </span>
          </div>
          <Progress
            value={readyPct}
            className={cn(
              "h-2.5",
              canGoLive ? "[&>*]:bg-success" : "[&>*]:bg-warning"
            )}
          />
        </div>

        {/* Per-gate checklist */}
        <ul className="divide-y">
          {gates.map((gate) => (
            <li
              key={gate.key}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                {gate.ready ? (
                  <CheckCircle2Icon className="size-4 shrink-0 text-success" />
                ) : (
                  <AlertCircleIcon
                    className={cn(
                      "size-4 shrink-0",
                      gate.required ? "text-warning" : "text-muted-foreground"
                    )}
                  />
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">
                    {gate.label}
                    {gate.required && (
                      <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                        required
                      </span>
                    )}
                  </span>
                  {gate.detail && (
                    <span className="text-muted-foreground text-xs">
                      {gate.detail}
                    </span>
                  )}
                </div>
              </div>

              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 text-xs",
                  gate.ready
                    ? "border-success/20 bg-success/10 text-success"
                    : gate.required
                      ? "border-warning/20 bg-warning/10 text-warning"
                      : "text-muted-foreground"
                )}
              >
                {gate.ready ? "Ready" : "Pending"}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
