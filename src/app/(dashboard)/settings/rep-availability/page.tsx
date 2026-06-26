import type { Metadata } from "next";

import { getTeamAvailability, getMyAvailability } from "@/actions/rep-availability.actions";
import { PageHeader } from "@/components/layout/page-header";
import { AvailabilityBoard } from "./_components/availability-board";

export const metadata: Metadata = { title: "Rep Availability" };

// ============================================================
// Rep Availability & Routing Board — INTERNAL (ROUTE_PERMISSIONS leads:read).
// ------------------------------------------------------------
// Shows every rep's ONLINE/BUSY/AWAY/OFFLINE status, open-lead load vs capacity,
// event-type skills, and languages — the signal that powers smart inbound
// routing for known contacts. Admins can override a rep's status/skills; any rep
// can self-toggle their own ONLINE/AWAY. No public data is rendered here.
// ============================================================

export default async function RepAvailabilityPage() {
  const [board, mine] = await Promise.all([
    getTeamAvailability(),
    getMyAvailability(),
  ]);

  const rows = board.success ? board.data : [];
  const myStatus = mine.success ? mine.data.status : "OFFLINE";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rep Availability & Routing"
        description="Set your status so inbound enquiries route to the right available rep. Admins can adjust any rep's status, skills, and capacity."
      />
      {!board.success ? (
        <p className="text-sm text-muted-foreground">
          {board.error || "Unable to load the availability board."}
        </p>
      ) : (
        <AvailabilityBoard rows={rows} myStatus={myStatus} />
      )}
    </div>
  );
}
