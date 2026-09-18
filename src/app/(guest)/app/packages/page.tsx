import { getHostScope } from "@/lib/guest/host-scope";
import { requestFromConcierge } from "@/actions/guest-host.actions";
import { getStorefrontVenues } from "@/actions/storefront.actions";
import { getPublicPackageCatalog } from "@/actions/guest-packages.actions";
import { Screen, ScreenHeader, Chip } from "../../_components/ui";
import { PackagePicker } from "./_components/package-picker";

export const metadata = { title: "Packages & partners — Veloria Grand" };
export const dynamic = "force-dynamic";

// PUBLIC: anyone can browse the team's packages and prices. Requesting one needs
// the booking's own signed-in customer (requestFromConcierge, kind "PACKAGES");
// invited collaborators and staff previews can browse but not request.
export default async function PackagesPage({ searchParams }: { searchParams: Promise<{ hall?: string; b?: string }> }) {
  const { hall, b } = await searchParams;
  const [scope, venues] = await Promise.all([getHostScope(b), getStorefrontVenues()]);
  const booking = scope?.booking ?? null;
  const hostOnly = !!(booking && scope?.collaboratorRoles?.[booking.id]);

  // ?hall=<id> picks a hall, ?hall=all shows every hall; otherwise the booking's own hall.
  const explicit = hall && venues.some((v) => v.id === hall) ? hall : null;
  const hallId = hall === "all" ? null : explicit ?? booking?.venueId ?? null;
  const hallName = hallId ? venues.find((v) => v.id === hallId)?.name ?? null : null;
  const catalog = await getPublicPackageCatalog(hallId);

  const qs = (h: string) => `/app/packages?${new URLSearchParams({ hall: h, ...(b ? { b } : {}) }).toString()}`;
  const next = `/app/packages${b ? `?b=${encodeURIComponent(b)}` : ""}`;

  return (
    <Screen className="gap-4">
      <ScreenHeader title="Packages & partners" backHref={booking ? `/app/event?b=${encodeURIComponent(booking.id)}` : "/app"} />
      <p className="-mt-1.5 text-detail leading-[1.5] text-[#6e6e73]">
        Veloria&apos;s own catering and partners who know our halls, at the rates our team quotes. Add to your booking, or bring your own — no obligation.
      </p>
      {venues.length > 1 && (
        <div className="vg-scroll-x vg-bleed gap-1.5">
          <Chip href={qs("all")} active={!hallId}>All halls</Chip>
          {venues.map((v) => (
            <Chip key={v.id} href={qs(v.id)} active={hallId === v.id}>{v.name}</Chip>
          ))}
        </div>
      )}
      <PackagePicker
        catering={catalog.catering}
        groups={catalog.groups}
        hallName={hallName}
        initialGuests={booking?.guestCount ?? null}
        booking={booking ? { id: booking.id } : null}
        signedIn={!!scope}
        preview={scope?.preview ?? false}
        hostOnly={hostOnly}
        signInHref={`/app/welcome?next=${encodeURIComponent(next)}`}
        requestAction={requestFromConcierge}
      />
    </Screen>
  );
}
