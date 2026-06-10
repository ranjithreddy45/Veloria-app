import type { Metadata } from "next";
import { auth } from "@/../auth";
import { redirect } from "next/navigation";
import { getNotifications } from "@/actions/notification.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { NotificationList } from "./_components/notification-list";

export const metadata: Metadata = { title: "Notifications" };

// ============================================================
// Notifications Page (Server Component)
// ============================================================

export default async function NotificationsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const { notifications, total } = await getNotifications(session.user.id, {
    limit: 50,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        help={<PageHelp id="notifications" />}
        description={`You have ${total} notification${total !== 1 ? "s" : ""}`}
      />
      <NotificationList
        initialNotifications={notifications}
        userId={session.user.id}
        total={total}
      />
    </div>
  );
}
