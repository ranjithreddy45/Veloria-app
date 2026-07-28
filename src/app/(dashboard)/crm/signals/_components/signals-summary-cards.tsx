"use client";

import * as React from "react";
import {
  UserPlusIcon,
  TrendingUpIcon,
  IndianRupeeIcon,
  CheckCircleIcon,
  Loader2Icon,
} from "lucide-react";

import {
  getSalesSignalsSummary,
  type SalesSignalsSummary,
} from "@/actions/sales-signals.actions";
import { Card, CardContent } from "@/components/ui/card";

export function SignalsSummaryCards() {
  const [data, setData] = React.useState<SalesSignalsSummary | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getSalesSignalsSummary().then((res) => {
      if (res.success) setData(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center py-8">
        <Loader2Icon className="mr-2 size-5 animate-spin" /> Loading summary...
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    {
      label: "New Leads Today",
      value: data.newLeadsToday,
      icon: UserPlusIcon,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      valueColor: "text-blue-700",
    },
    {
      label: "Deals Moved",
      value: data.dealsMoved,
      icon: TrendingUpIcon,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      valueColor: "text-purple-700",
    },
    {
      label: "Payments Received",
      value: data.paymentsReceived,
      icon: IndianRupeeIcon,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      valueColor: "text-green-700",
    },
    {
      label: "Tasks Completed",
      value: data.tasksCompleted,
      icon: CheckCircleIcon,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      valueColor: "text-emerald-700",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div
                className={`flex size-10 items-center justify-center rounded-lg ${c.iconBg}`}
              >
                <c.icon className={`size-5 ${c.iconColor}`} />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">{c.label}</p>
                <p className={`text-2xl font-bold ${c.valueColor}`}>
                  {c.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
