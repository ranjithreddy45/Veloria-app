import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getNotificationPreferences } from "@/actions/notification-settings.actions";
import { NotificationSettings } from "./_components/notification-settings";

export const metadata: Metadata = { title: "Notification Settings" };

// ============================================================
// Notification Settings Page
// ============================================================

export default async function NotificationSettingsPage() {
  const result = await getNotificationPreferences();

  const preferences = result.success ? result.data!.preferences : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Settings"
        description="Configure how you receive notifications for each event type. Toggle email and SMS channels per notification."
      />
      <NotificationSettings initialPreferences={preferences} />
    </div>
  );
}
