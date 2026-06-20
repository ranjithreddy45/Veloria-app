"use client";

import { StatTile } from "@/components/ui/stat-tile";
import { Users, UserCheck, UserPlus, Plane, Building2 } from "lucide-react";

// Headcount summary strip above the directory. Pure presentation — the numbers
// come straight from getEmployeeStats (total / active / onboarding / onLeave /
// entityCount). The Active tile carries an "active %" progress ring derived
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

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 animate-stagger-1">
      <StatTile
        label="Total employees"
        value={total}
        accent="violet"
        icon={<Users className="size-4" />}
        sub="across the group"
      />
      <StatTile
        label="Active"
        value={active}
        accent="emerald"
        icon={<UserCheck className="size-4" />}
        pct={activePct}
        sub={`${active} of ${total}`}
      />
      <StatTile
        label="Onboarding"
        value={onboarding}
        accent="cyan"
        icon={<UserPlus className="size-4" />}
        sub={onboarding ? "joining soon" : "none in progress"}
      />
      <StatTile
        label="On leave"
        value={onLeave}
        accent="amber"
        icon={<Plane className="size-4" />}
        sub={onLeave ? "away today" : "all present"}
      />
      <StatTile
        label="Legal entities"
        value={entityCount}
        accent="indigo"
        icon={<Building2 className="size-4" />}
        sub="in the group"
      />
    </div>
  );
}
