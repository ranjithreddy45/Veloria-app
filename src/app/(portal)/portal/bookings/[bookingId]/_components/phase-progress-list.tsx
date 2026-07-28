"use client";

import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PhaseData {
  phaseName: string;
  phaseType: string;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
}

interface PhaseProgressListProps {
  phases: PhaseData[];
}

// Phase type to emoji mapping
const PHASE_ICONS: Record<string, string> = {
  PRE_EVENT: "\ud83d\udccb",
  SETUP: "\ud83d\udd27",
  GUEST_ARRIVAL: "\ud83d\udeaa",
  LIVE_EVENT: "\ud83c\udf89",
  WRAP_UP: "\ud83e\uddf9",
  HANDOVER: "\ud83e\udd1d",
};

const PHASE_LABELS: Record<string, string> = {
  PRE_EVENT: "Pre-Event",
  SETUP: "Setup",
  GUEST_ARRIVAL: "Guest Arrival",
  LIVE_EVENT: "Live Event",
  WRAP_UP: "Wrap Up",
  HANDOVER: "Handover",
};

export function PhaseProgressList({ phases }: PhaseProgressListProps) {
  if (phases.length === 0) return null;

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">
          Preparation Phases
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {phases.map((phase) => {
            const icon = PHASE_ICONS[phase.phaseType] || "\u2699\ufe0f";
            const label = PHASE_LABELS[phase.phaseType] || phase.phaseName;
            const progressColor =
              phase.progressPercent >= 100
                ? "bg-success"
                : phase.progressPercent >= 50
                ? "bg-primary"
                : "bg-warning";

            return (
              <div key={phase.phaseType} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{icon}</span>
                    <span className="text-sm font-medium text-muted-foreground">
                      {label}
                    </span>
                  </div>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {phase.progressPercent}%
                  </span>
                </div>
                <Progress
                  value={phase.progressPercent}
                  className={`h-2 [&>div]:${progressColor}`}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
