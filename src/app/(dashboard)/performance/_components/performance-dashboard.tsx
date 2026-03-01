"use client";

import * as React from "react";
import { UsersIcon, BuildingIcon, TrophyIcon, UserIcon } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type TeamMemberPerformance,
  type VenuePerformanceData,
  type LeaderboardEntry,
} from "@/actions/performance.actions";
import { TeamPerformanceTable } from "./team-performance-table";
import { VenuePerformanceGrid } from "./venue-performance-grid";
import { Leaderboard } from "./leaderboard";
import { IndividualPerformance } from "./individual-performance";

// ============================================================
// Props
// ============================================================

interface PerformanceDashboardProps {
  initialTeamData: TeamMemberPerformance[];
  initialVenueData: VenuePerformanceData[];
  initialLeaderboard: LeaderboardEntry[];
  teamMembers: { id: string; name: string | null; role: string }[];
}

// ============================================================
// Performance Dashboard
// ============================================================

export function PerformanceDashboard({
  initialTeamData,
  initialVenueData,
  initialLeaderboard,
  teamMembers,
}: PerformanceDashboardProps) {
  return (
    <Tabs defaultValue="team" className="space-y-6">
      <TabsList>
        <TabsTrigger value="team" className="gap-1.5">
          <UsersIcon className="size-4" />
          Team
        </TabsTrigger>
        <TabsTrigger value="venues" className="gap-1.5">
          <BuildingIcon className="size-4" />
          Venues
        </TabsTrigger>
        <TabsTrigger value="leaderboard" className="gap-1.5">
          <TrophyIcon className="size-4" />
          Leaderboard
        </TabsTrigger>
        <TabsTrigger value="individual" className="gap-1.5">
          <UserIcon className="size-4" />
          Individual
        </TabsTrigger>
      </TabsList>

      <TabsContent value="team">
        <TeamPerformanceTable data={initialTeamData} />
      </TabsContent>

      <TabsContent value="venues">
        <VenuePerformanceGrid data={initialVenueData} />
      </TabsContent>

      <TabsContent value="leaderboard">
        <Leaderboard initialData={initialLeaderboard} />
      </TabsContent>

      <TabsContent value="individual">
        <IndividualPerformance teamMembers={teamMembers} />
      </TabsContent>
    </Tabs>
  );
}
