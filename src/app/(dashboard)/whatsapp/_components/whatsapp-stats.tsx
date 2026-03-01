"use client";

import { Send, CheckCheck, Eye, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { WhatsAppStatsData } from "@/actions/whatsapp.actions";

// ============================================================
// WhatsApp Stats Cards
// ============================================================

interface WhatsAppStatsProps {
  stats: WhatsAppStatsData | null;
}

export function WhatsAppStats({ stats }: WhatsAppStatsProps) {
  const cards = [
    {
      label: "Sent",
      value: stats?.sent ?? 0,
      icon: Send,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      label: "Delivered",
      value: stats?.delivered ?? 0,
      suffix: stats?.deliveryRate ? `${stats.deliveryRate}%` : undefined,
      icon: CheckCheck,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
    },
    {
      label: "Read",
      value: stats?.read ?? 0,
      suffix: stats?.readRate ? `${stats.readRate}%` : undefined,
      icon: Eye,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      label: "Failed",
      value: stats?.failed ?? 0,
      icon: XCircle,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/40",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${card.bg}`}
              >
                <Icon className={`size-5 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-lg font-bold">{card.value}</p>
                  {card.suffix && (
                    <span className="text-xs text-muted-foreground">
                      ({card.suffix})
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
