import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import {
  getTeamPerformance,
  getVenuePerformance,
  getLeaderboard,
  getTeamMembers,
} from "@/actions/performance.actions";
import { PerformanceDashboard } from "./_components/performance-dashboard";

export const metadata: Metadata = { title: "Performance" };

// ============================================================
// Performance Dashboard Page
// ============================================================

export default async function PerformancePage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  if (!hasPermission(session.user.role as string, "performance:read")) {
    redirect("/not-authorized");
  }

  const [teamResult, venueResult, leaderboardResult, membersResult] =
    await Promise.all([
      getTeamPerformance(),
      getVenuePerformance(),
      getLeaderboard({ metric: "revenue", period: "month" }),
      getTeamMembers(),
    ]);

  const teamData = teamResult.success ? teamResult.data : [];
  const venueData = venueResult.success ? venueResult.data : [];
  const leaderboardData = leaderboardResult.success
    ? leaderboardResult.data
    : [];
  const teamMembers = membersResult.success ? membersResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="Operations · Insights"
        title="Performance"
        help={<PageHelp id="performance" />}
        description="Track team performance, venue metrics, and leaderboards across your operations."
      />
      <PerformanceDashboard
        initialTeamData={teamData}
        initialVenueData={venueData}
        initialLeaderboard={leaderboardData}
        teamMembers={teamMembers}
      />
    </div>
  );
}
