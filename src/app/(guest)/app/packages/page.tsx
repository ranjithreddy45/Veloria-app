import { requireGuest } from "@/lib/guest-session";
import { getGuestEvent, getGuestPackages } from "@/actions/guest-host.actions";
import { Screen, ScreenHeader, EmptyNote } from "../../_components/ui";
import { PackagePicker } from "./_components/package-picker";

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  await requireGuest("/app/packages");
  const ev = await getGuestEvent();
  const packages = await getGuestPackages(ev?.booking.venueId);
  return (
    <Screen className="gap-4">
      <ScreenHeader title="Packages & partners" backHref={ev ? "/app/event" : "/app"} />
      <p className="-mt-1.5 text-detail leading-[1.5] text-[#6e6e73]">Curated partners who know our halls. Add to your booking, or bring your own — no obligation.</p>
      {packages.length === 0 ? <EmptyNote>Partner packages will be listed here once the team publishes them for your hall.</EmptyNote> : <PackagePicker packages={packages} bookingId={ev?.booking.id ?? null} />}
    </Screen>
  );
}
