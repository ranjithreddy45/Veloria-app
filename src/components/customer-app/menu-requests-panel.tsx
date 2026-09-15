import { getMenuRequestsForBooking, acceptMenuRequest, declineMenuRequest } from "@/actions/menu-request-review.actions";
import { MenuRequestsReview } from "./menu-requests-review";

// ============================================================
// Team panel: a booking's customer menu requests (MenuSelectionRequest), with
// accept (writes BookingMenu + BookingMenuSelection) and decline (note to the
// customer). SERVER component: mount it on a server-rendered booking page,
//   <MenuRequestsPanel bookingId={booking.id} />
// It renders nothing for users who can't read booking menus. The review UI gets
// its server actions as props, so no client bundle imports notify/prisma code.
// ============================================================

export async function MenuRequestsPanel({ bookingId, hideWhenEmpty = false }: { bookingId: string; hideWhenEmpty?: boolean }) {
  const res = await getMenuRequestsForBooking(bookingId);
  if (!res.success) return null;
  if (hideWhenEmpty && res.data.requests.length === 0) return null;
  // Remount the client view whenever a request or the menu changes, so a refresh shows fresh state.
  const key = `${res.data.requests.map((r) => `${r.id}:${r.status}`).join("|")}#${res.data.currentMenu?.updatedAt ?? ""}`;
  return <MenuRequestsReview key={key} data={res.data} acceptAction={acceptMenuRequest} declineAction={declineMenuRequest} />;
}
