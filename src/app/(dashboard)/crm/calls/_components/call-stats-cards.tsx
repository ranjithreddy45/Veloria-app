"use client";

import { StatTile } from "@/components/ui/stat-tile";
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

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Total calls"
        value={analytics.totalCalls}
        accent="blue"
        icon={<Phone className="size-4" />}
        sub={`${analytics.callsToday} today`}
      />
      <StatTile
        label="Avg duration"
        value={formatDuration(analytics.avgDuration)}
        accent="gold"
        icon={<Clock className="size-4" />}
        sub="per connected call"
      />
      <StatTile
        label="Inbound"
        value={inbound}
        accent="emerald"
        icon={<PhoneIncoming className="size-4" />}
        sub="calls received"
      />
      <StatTile
        label="Outbound"
        value={outbound}
        accent="amber"
        icon={<PhoneOutgoing className="size-4" />}
        sub="calls made"
      />
    </div>
  );
}
