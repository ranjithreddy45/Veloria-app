"use client";

import { Phone, Clock, Users, CheckCircle } from "lucide-react";

import { cn } from "@/lib/utils";

interface AgentStat {
  totalCalls: number;
  avgCallDuration: number;
  totalCallDuration: number;
  totalCommunications: number;
  assignedLeads: number;
  completedTasks: number;
}

interface Props {
  stats: AgentStat;
}

export function AgentMetricsCards({ stats }: Props) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const cards = [
    {
      title: "Total Calls",
      value: stats.totalCalls.toString(),
      icon: Phone,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      title: "Avg Call Duration",
      value: formatDuration(stats.avgCallDuration),
      icon: Clock,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-950/30",
    },
    {
      title: "Assigned Leads",
      value: stats.assignedLeads.toString(),
      icon: Users,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      title: "Completed Tasks",
      value: stats.completedTasks.toString(),
      icon: CheckCircle,
      color: "text-success",
      bg: "bg-success/10",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-2xl border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {card.title}
            </p>
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-xl",
                card.bg
              )}
            >
              <card.icon className={cn("size-4", card.color)} />
            </span>
          </div>
          <div className="numeric mt-3 text-[26px] font-semibold leading-none">
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}
