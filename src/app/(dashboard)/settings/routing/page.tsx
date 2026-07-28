import type { Metadata } from "next";
import { RouteIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  getTeamAvailability,
  getRoutingDecisions,
  type TeamAvailabilityRow,
  type RoutingDecisionData,
} from "@/actions/rep-availability.actions";
import { RoutingBoard } from "./_components/routing-board";

export const metadata: Metadata = { title: "Smart Routing" };

// Internal gated page — /settings is already gated at settings:read via
// middleware ROUTE_PERMISSIONS, so /settings/routing inherits it. The actions
// it calls additionally gate (leads:assign / leads:read), so a settings:read
// user without those sees an empty/permission state rather than leaked data.
export default async function RoutingSettingsPage() {
  const [teamRes, decisionsRes] = await Promise.all([
    getTeamAvailability(),
    getRoutingDecisions(),
  ]);

  const team: TeamAvailabilityRow[] = teamRes.success ? teamRes.data : [];
  const decisions: RoutingDecisionData[] = decisionsRes.success
    ? decisionsRes.data
    : [];

  const teamError = teamRes.success ? null : teamRes.error;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings · Automation"
        icon={RouteIcon}
        accent="teal"
        title="Smart Routing"
        description="Workload- and skill-aware lead routing. Reps set their own availability and skills; SMART assignment rules send each lead to the available, lightest-loaded, best-matched rep."
      />

      <RoutingBoard
        initialTeam={team}
        initialDecisions={decisions}
        teamError={teamError}
      />
    </div>
  );
}
