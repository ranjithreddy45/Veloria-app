import { requireGuest } from "@/lib/guest-session";
import { getGuestEvent, getGuestGuestList } from "@/actions/guest-host.actions";
import { Screen, ScreenHeader, EmptyNote } from "../../../_components/ui";
import { GuestListClient } from "./_components/guest-list";

export const dynamic = "force-dynamic";

export default async function GuestsPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  await requireGuest("/app/event/guests");
  const { b } = await searchParams;
  const ev = await getGuestEvent(b);
  const data = ev ? await getGuestGuestList(ev.booking.id) : null;
  if (!ev || !data) return <Screen className="gap-4"><ScreenHeader title="Guest list" backHref="/app/event" /><EmptyNote>No booking linked yet.</EmptyNote></Screen>;
  return <GuestListClient bookingId={ev.booking.id} initial={data} />;
}
