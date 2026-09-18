import { requireGuest } from "@/lib/guest-session";
import { getHostGuestList } from "@/actions/portal-guest.actions";
import { Screen, ScreenHeader, EmptyNote } from "../../../_components/ui";
import { GuestListClient } from "./_components/guest-list";

export const dynamic = "force-dynamic";

export default async function GuestsPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  await requireGuest(typeof b === "string" && b ? `/app/event/guests?b=${encodeURIComponent(b)}` : "/app/event/guests");
  // The host, a co-host or viewer the host shared with, or a team preview — one access rule.
  const data = await getHostGuestList(typeof b === "string" ? b : undefined);
  if (!data) {
    return (
      <Screen className="gap-4">
        <ScreenHeader title="Guest list" backHref="/app/event" />
        <EmptyNote>No booking linked yet.</EmptyNote>
      </Screen>
    );
  }
  return <GuestListClient initial={data} />;
}
