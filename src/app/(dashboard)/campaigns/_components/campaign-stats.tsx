"use client";

import {
  MailIcon,
  EyeIcon,
  MousePointerClickIcon,
  PercentIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ============================================================
// Campaign Stats Props
// ============================================================

interface CampaignStatsProps {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
}

// ============================================================
// CampaignStats Component
// ============================================================

export function CampaignStats({
  totalSent,
  totalOpened,
  totalClicked,
}: CampaignStatsProps) {
  const openRate =
    totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0.0";
  const clickRate =
    totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : "0.0";

  const stats = [
    {
      title: "Total Sent",
      value: totalSent.toLocaleString("en-IN"),
      icon: MailIcon,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Opened",
      value: totalOpened.toLocaleString("en-IN"),
      icon: EyeIcon,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Clicked",
      value: totalClicked.toLocaleString("en-IN"),
      icon: MousePointerClickIcon,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "Open Rate",
      value: `${openRate}%`,
      icon: PercentIcon,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`rounded-md p-2 ${stat.bg}`}>
              <stat.icon className={`size-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
