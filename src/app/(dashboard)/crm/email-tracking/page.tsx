import type { Metadata } from "next";
import { MailOpenIcon } from "lucide-react";
import { getTrackingStats, getTrackingEvents, getTopEngagedContacts } from "@/actions/email-tracking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
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
      <PageHeader
        aura
        icon={MailOpenIcon}
        accent="blue"
        eyebrow="CRM"
        title="Email Insights"
        description="Track email opens, clicks, and engagement across all your communications."
        help={<PageHelp id="email-insights" />}
      />

      <TrackingDashboard
        initialStats={stats}
        initialEvents={events}
        initialTopContacts={topContacts}
      />
    </div>
  );
}
