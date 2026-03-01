"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  Calendar,
  Sparkles,
  Timer,
  Star,
  PartyPopper,
  CheckCircle2,
  XCircle,
  Clock,
  SkipForward,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { REMINDER_STAGE_LABELS, REMINDER_STATUS_COLORS } from "@/lib/constants";
import { getReminderStatus, retryFailedReminders } from "@/actions/reminder.actions";

interface ReminderScheduleProps {
  bookingId: string;
}

const STAGE_ICONS: Record<string, React.ReactNode> = {
  SAVE_THE_DATE: <Calendar className="size-4" />,
  EXCITEMENT_BUILDER: <Sparkles className="size-4" />,
  FINAL_COUNTDOWN: <Timer className="size-4" />,
  TOMORROW_REMINDER: <Star className="size-4" />,
  DAY_OF_WELCOME: <PartyPopper className="size-4" />,
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  REMINDER_SENT: <CheckCircle2 className="size-3.5 text-emerald-500" />,
  REMINDER_FAILED: <XCircle className="size-3.5 text-red-500" />,
  REMINDER_PENDING: <Clock className="size-3.5 text-zinc-400" />,
  REMINDER_SKIPPED: <SkipForward className="size-3.5 text-zinc-400" />,
};

interface StageStats {
  stage: string;
  total: number;
  sent: number;
  pending: number;
  failed: number;
  skipped: number;
}

export function ReminderSchedule({ bookingId }: ReminderScheduleProps) {
  const [isPending, startTransition] = useTransition();
  const [stages, setStages] = useState<StageStats[]>([]);
  const [overall, setOverall] = useState({ total: 0, sent: 0, pending: 0, failed: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const result = await getReminderStatus(bookingId);
      if (result.success && result.data) {
        setStages(result.data.stages);
        setOverall(result.data.overall);
      }
      setLoaded(true);
    }
    load();
  }, [bookingId]);

  function handleRetry(stage?: string) {
    startTransition(async () => {
      const result = await retryFailedReminders(bookingId, stage);
      if (result.success) {
        toast.success(`${result.data?.retriedCount || 0} reminders queued for retry`);
        // Reload
        const refresh = await getReminderStatus(bookingId);
        if (refresh.success && refresh.data) {
          setStages(refresh.data.stages);
          setOverall(refresh.data.overall);
        }
      } else {
        toast.error(result.error || "Failed to retry");
      }
    });
  }

  if (!loaded) return null;
  if (overall.total === 0) return null;

  return (
    <Card className="border-zinc-200/80 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Reminder Campaign
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>{overall.sent} sent</span>
            <span>·</span>
            <span>{overall.pending} pending</span>
            {overall.failed > 0 && (
              <>
                <span>·</span>
                <span className="text-red-500">{overall.failed} failed</span>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 5-Stage Pipeline */}
        <div className="space-y-3">
          {stages.map((stage, idx) => {
            const icon = STAGE_ICONS[stage.stage];
            const label = REMINDER_STAGE_LABELS[stage.stage] || stage.stage;
            const statusLabel =
              stage.sent === stage.total && stage.total > 0
                ? "REMINDER_SENT"
                : stage.failed > 0
                ? "REMINDER_FAILED"
                : stage.skipped === stage.total && stage.total > 0
                ? "REMINDER_SKIPPED"
                : "REMINDER_PENDING";
            const statusColor = REMINDER_STATUS_COLORS[statusLabel] || "";

            return (
              <div key={stage.stage} className="flex items-center gap-3">
                {/* Stage Icon */}
                <div
                  className={`flex size-8 items-center justify-center rounded-full border ${
                    statusLabel === "REMINDER_SENT"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/30"
                      : statusLabel === "REMINDER_FAILED"
                      ? "border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950/30"
                      : "border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
                  }`}
                >
                  {icon}
                </div>

                {/* Connector line */}
                {idx < stages.length - 1 && (
                  <div className="absolute ml-4 mt-10 h-3 w-px bg-zinc-200 dark:bg-zinc-700" />
                )}

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {label}
                    </span>
                    {STATUS_ICONS[statusLabel]}
                  </div>
                  <p className="text-xs text-zinc-500">
                    {stage.sent}/{stage.total} sent
                    {stage.failed > 0 && (
                      <span className="text-red-500"> · {stage.failed} failed</span>
                    )}
                  </p>
                </div>

                {/* Retry failed */}
                {stage.failed > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={isPending}
                    onClick={() => handleRetry(stage.stage)}
                  >
                    {isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 size-3" />
                    )}
                    Retry
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
