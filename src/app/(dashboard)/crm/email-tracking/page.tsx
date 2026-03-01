import type { Metadata } from "next";
import { getTrackingStats, getTrackingEvents, getTopEngagedContacts } from "@/actions/email-tracking.actions";
import { TrackingDashboard } from "./_components/tracking-dashboard";

export const metadata: Metadata = { title: "Email Insights" };

// ============================================================
// Email Tracking Dashboard Page (Server Component)
// ============================================================

export default async function EmailTrackingPage() {
  const [statsResult, eventsResult, topContactsResult] = await Promise.all([
    getTrackingStats(),
    getTrackingEvents(),
    getTopEngagedContacts(10),
  ]);

  const stats = statsResult.success ? statsResult.data : null;
  const events = eventsResult.success ? eventsResult.data : [];
  const topContacts = topContactsResult.success ? topContactsResult.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Email Insights
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track email opens, clicks, and engagement across all your
          communications.
        </p>
      </div>

      <TrackingDashboard
        initialStats={stats}
        initialEvents={events}
        initialTopContacts={topContacts}
      />
    </div>
  );
}
