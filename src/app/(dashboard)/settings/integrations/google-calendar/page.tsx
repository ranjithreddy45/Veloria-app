import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { GoogleCalendarConfig } from "./_components/google-calendar-config";
import { CalendarSyncStatus } from "./_components/calendar-sync-status";

export const metadata: Metadata = { title: "Google Calendar Integration" };

// ============================================================
// Google Calendar Integration Settings Page
// ============================================================

export default function GoogleCalendarPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Google Calendar"
        description="Sync your bookings with Google Calendar for seamless scheduling."
      />

      <GoogleCalendarConfig />
      <CalendarSyncStatus />
    </div>
  );
}
