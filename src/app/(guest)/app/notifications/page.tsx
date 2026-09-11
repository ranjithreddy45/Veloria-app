import { requireGuest } from "@/lib/guest-session";
import { getGuestNotifications } from "@/actions/guest-host.actions";
import { NotificationList } from "./_components/notification-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireGuest("/app/notifications");
  const items = await getGuestNotifications();
  return <NotificationList initial={items} />;
}
