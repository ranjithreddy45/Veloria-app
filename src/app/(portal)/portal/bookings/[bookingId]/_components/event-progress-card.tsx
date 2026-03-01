"use client";

import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock } from "lucide-react";

interface EventProgressCardProps {
  overallProgress: number;
  hasExecutionPlan: boolean;
}

export function EventProgressCard({ overallProgress, hasExecutionPlan }: EventProgressCardProps) {
  // Determine color based on progress
  const colorClass = overallProgress >= 80
    ? "text-emerald-600"
    : overallProgress >= 50
    ? "text-indigo-600"
    : "text-amber-600";

  const bgClass = overallProgress >= 80
    ? "bg-emerald-600"
    : overallProgress >= 50
    ? "bg-indigo-600"
    : "bg-amber-600";

  const label = overallProgress >= 100
    ? "Everything is ready!"
    : overallProgress >= 80
    ? "Almost there!"
    : overallProgress >= 50
    ? "Making great progress"
    : overallProgress > 0
    ? "Preparations underway"
    : "Preparations starting soon";

  return (
    <Card className="border-zinc-200/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {overallProgress >= 100 ? (
            <CheckCircle2 className="size-4 text-emerald-500" />
          ) : (
            <Clock className="size-4 text-indigo-500" />
          )}
          Event Preparation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Large Progress Number */}
          <div className="flex flex-col items-center">
            <span className={`text-4xl font-bold tabular-nums ${colorClass}`}>
              {overallProgress}%
            </span>
            <span className="mt-1 text-xs text-zinc-500">Complete</span>
          </div>

          {/* Progress Bar and Label */}
          <div className="flex-1 space-y-2">
            <Progress
              value={overallProgress}
              className={`h-3 [&>div]:${bgClass}`}
            />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {label}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
