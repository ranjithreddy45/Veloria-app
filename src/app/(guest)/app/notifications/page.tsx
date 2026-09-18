import { requireGuest } from "@/lib/guest-session";
import { getMyNotifications } from "@/actions/guest-concierge.actions";
import { NotificationList } from "./_components/notification-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireGuest("/app/notifications");
  const { items, now } = await getMyNotifications();
  return <NotificationList initial={items} now={now} />;
}
