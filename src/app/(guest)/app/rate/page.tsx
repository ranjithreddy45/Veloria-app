import { requireGuest } from "@/lib/guest-session";
import { getGuestEvent } from "@/actions/guest-host.actions";
import { Screen, ScreenHeader, EmptyNote } from "../../_components/ui";
import { RateForm } from "./_components/rate-form";

export const dynamic = "force-dynamic";

export default async function RatePage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const user = await requireGuest("/app/rate");
  const { b } = await searchParams;
  const ev = await getGuestEvent(b);
  const past = ev ? new Date(ev.booking.date).getTime() < Date.now() : false;
  return (
    <Screen className="gap-[18px]">
      <ScreenHeader title="After your event" backHref="/app/account" />
      {!ev ? <EmptyNote>No booking linked yet.</EmptyNote>
        : !past ? <EmptyNote>Your event is still ahead. This opens the day after {ev.booking.eventName}.</EmptyNote>
        : <RateForm bookingId={ev.booking.id} firstName={(user.name ?? "").split(" ")[0] || null} />}
    </Screen>
  );
}
