"use client";

import { Card } from "@/components/ui/card";
import { Donut } from "@/components/ui/donut";
import { cn } from "@/lib/utils";
import { Users, UserCheck, UserPlus, Plane, Building2 } from "lucide-react";

interface Stat {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
  valueClass?: string;
}

// Compact headcount summary strip above the directory. Pure presentation — the
// numbers come straight from getEmployeeStats (total / active / onboarding /
// onLeave / entityCount). The leading card carries an "active %" donut derived
// from active ÷ total.
export function HeadcountStrip({
  total,
  active,
  onboarding,
  onLeave,
  entityCount,
}: {
  total: number;
  active: number;
  onboarding: number;
  onLeave: number;
  entityCount: number;
}) {
  const activePct = total > 0 ? Math.round((active / total) * 100) : 0;

  const stats: Stat[] = [
    { label: "Total employees", value: String(total), icon: <Users className="size-4" />, accent: true },
    {
      label: "Active",
      value: String(active),
      icon: <UserCheck className="size-4" />,
      valueClass: active ? "text-emerald-600 dark:text-emerald-400" : undefined,
    },
    { label: "Onboarding", value: String(onboarding), icon: <UserPlus className="size-4" />, valueClass: onboarding ? "text-sky-600 dark:text-sky-400" : undefined },
    { label: "On leave", value: String(onLeave), icon: <Plane className="size-4" />, valueClass: onLeave ? "text-amber-600 dark:text-amber-400" : undefined },
    { label: "Legal entities", value: String(entityCount), icon: <Building2 className="size-4" /> },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {/* Active-% donut — leads the strip, spans wider so the ring breathes. */}
      <Card className="col-span-2 gap-0 py-4 shadow-card sm:col-span-1">
        <div className="flex items-center gap-3 px-4">
          <Donut
            value={activePct}
            size={52}
            thickness={6}
            colorClass="text-emerald-500"
            ariaLabel={`${activePct}% of employees active`}
          />
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted-foreground">Active rate</div>
            <div className="text-[11px] text-muted-foreground/80 tabular-nums">
              {active} of {total}
            </div>
          </div>
        </div>
      </Card>

      {stats.map((s) => (
        <Card key={s.label} className="gap-0 py-4 shadow-card">
          <div className="flex items-center justify-between px-4">
            <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
            <span className={cn("text-muted-foreground/70", s.accent && "text-primary")}>{s.icon}</span>
          </div>
          <div className="px-4 pt-1.5">
            <span className={cn("text-2xl font-semibold tabular-nums tracking-tight", s.valueClass)}>
              {s.value}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
