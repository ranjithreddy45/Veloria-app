"use client";

import { cn } from "@/lib/utils";
import {
  ArrowRightIcon,
  UserPlusIcon,
  PhoneIcon,
  FileTextIcon,
  CalendarCheckIcon,
  CheckCircle2Icon,
} from "lucide-react";

interface PipelineStage {
  label: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface ReferralPipelineProps {
  stats: {
    total: number;
    pending: number;
    contacted: number;
    converted: number;
    expired: number;
    leadCreated?: number;
    bookingConfirmed?: number;
  };
}

export function ReferralPipeline({ stats }: ReferralPipelineProps) {
  const stages: PipelineStage[] = [
    {
      label: "Pending",
      count: stats.pending,
      icon: <UserPlusIcon className="size-4" />,
      color: "text-zinc-700 dark:text-zinc-300",
      bgColor: "bg-zinc-100 dark:bg-zinc-800",
    },
    {
      label: "Contacted",
      count: stats.contacted,
      icon: <PhoneIcon className="size-4" />,
      color: "text-blue-700 dark:text-blue-300",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "Lead Created",
      count: stats.leadCreated ?? 0,
      icon: <FileTextIcon className="size-4" />,
      color: "text-indigo-700 dark:text-indigo-300",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
    },
    {
      label: "Booking",
      count: stats.bookingConfirmed ?? 0,
      icon: <CalendarCheckIcon className="size-4" />,
      color: "text-violet-700 dark:text-violet-300",
      bgColor: "bg-violet-50 dark:bg-violet-950/30",
    },
    {
      label: "Converted",
      count: stats.converted,
      icon: <CheckCircle2Icon className="size-4" />,
      color: "text-emerald-700 dark:text-emerald-300",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    },
  ];

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
      {stages.map((stage, index) => (
        <div key={stage.label} className="flex items-center gap-0">
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-3 min-w-[120px]",
              stage.bgColor
            )}
          >
            <div className={cn("shrink-0", stage.color)}>{stage.icon}</div>
            <div>
              <p className={cn("text-xs font-medium", stage.color)}>
                {stage.label}
              </p>
              <p className={cn("text-lg font-bold", stage.color)}>
                {stage.count}
              </p>
            </div>
          </div>
          {index < stages.length - 1 && (
            <ArrowRightIcon className="size-4 text-muted-foreground mx-1 hidden sm:block shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}
