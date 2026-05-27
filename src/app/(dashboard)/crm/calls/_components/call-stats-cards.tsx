"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, PhoneIncoming, PhoneOutgoing, Clock } from "lucide-react";

interface CallStatsProps {
  analytics: {
    totalCalls: number;
    avgDuration: number;
    inboundCalls?: number;
    outboundCalls?: number;
    callsToday: number;
    callsByDirection?: { direction: string; count: number }[];
  };
}

export function CallStatsCards({ analytics }: CallStatsProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const inbound =
    analytics.inboundCalls ??
    analytics.callsByDirection?.find((d) => d.direction === "INBOUND")?.count ??
    0;
  const outbound =
    analytics.outboundCalls ??
    analytics.callsByDirection?.find((d) => d.direction === "OUTBOUND")?.count ??
    0;

  const stats = [
    {
      title: "Total Calls",
      value: analytics.totalCalls.toLocaleString(),
      icon: Phone,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      title: "Avg Duration",
      value: formatDuration(analytics.avgDuration),
      icon: Clock,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-950/30",
    },
    {
      title: "Inbound",
      value: inbound.toLocaleString(),
      icon: PhoneIncoming,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      title: "Outbound",
      value: outbound.toLocaleString(),
      icon: PhoneOutgoing,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/30",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${stat.bg}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
