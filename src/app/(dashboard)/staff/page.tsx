import type { Metadata } from "next";
import Link from "next/link";
import { BanknoteIcon } from "lucide-react";

import { getStaffProfiles, getStaffSchedule } from "@/actions/staff.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StaffSchedule } from "./_components/staff-schedule";
import { StaffProfileCard } from "./_components/staff-profile-card";

export const metadata: Metadata = { title: "Staff Scheduling" };

// ============================================================
// Staff Scheduling Page
// ============================================================

export default async function StaffPage() {
  const [profilesResult, scheduleResult] = await Promise.all([
    getStaffProfiles(),
    getStaffSchedule(),
  ]);

  const profiles = profilesResult.success ? profilesResult.data : [];
  const shifts = scheduleResult.success ? scheduleResult.data : [];

  // Build a lightweight list for the schedule component dropdown
  const staffProfilesForSchedule = profiles.map((p) => ({
    id: p.id,
    user: p.user,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Scheduling"
        help={<PageHelp id="staff" />}
        description="Manage staff profiles, shifts, and schedules."
      >
        <Button variant="outline" asChild>
          <Link href="/staff/payroll">
            <BanknoteIcon className="mr-2 size-4" />
            Payroll
          </Link>
        </Button>
      </PageHeader>

      <Tabs defaultValue="schedule" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="profiles">Staff Profiles</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <StaffSchedule
            shifts={shifts}
            staffProfiles={staffProfilesForSchedule}
          />
        </TabsContent>

        <TabsContent value="profiles">
          {profiles.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <h3 className="text-lg font-semibold">No staff profiles</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Staff profiles are created automatically when shifts are
                assigned to users.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profiles.map((profile) => (
                <StaffProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
