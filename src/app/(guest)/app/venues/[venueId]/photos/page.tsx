import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontVenue } from "@/actions/storefront.actions";
import { getGuestPhotos } from "@/actions/guest-public.actions";
import { BackButton } from "../../../../_components/nav-transition";
import { EmptyNote, GhostButton, Photo, Screen } from "../../../../_components/ui";
import { visitHref } from "../../_lib/links";

// Every published photo of one hall, with the caption the team gave it.
// Real photos only — when there are none this screen says so rather than
// filling the page with pictures of somewhere else.

export const revalidate = 60;

type Params = Promise<{ venueId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { venueId } = await params;
  const venue = await getStorefrontVenue(venueId);
  return { title: venue ? `Photos of ${venue.name} — Veloria Grand` : "Photos — Veloria Grand" };
}

export default async function VenuePhotosPage({ params }: { params: Params }) {
  const { venueId } = await params;
  const venue = await getStorefrontVenue(venueId);
  if (!venue) notFound();
  const photos = await getGuestPhotos({ venueId: venue.id, limit: 80 });
  const hallHref = `/app/venues/${venue.id}`;

  return (
    <Screen flush className="vg-gutter gap-4 pb-8 pt-[calc(var(--sat)+0.5rem)]">
      {/* A real h1 — ScreenHeader's title is a styled div. */}
      <div className="flex items-center gap-3">
        <BackButton href={hallHref} />
        <div className="min-w-0 flex-1">
          <h1 className="text-copy font-semibold">Photos</h1>
          <div className="text-meta text-[#6e6e73]">{venue.name}</div>
        </div>
      </div>

      {photos.length === 0 ? (
        <>
          <EmptyNote>We haven&apos;t published photos of {venue.name} yet.</EmptyNote>
          <p className="max-w-[70ch] text-meta leading-[1.5] text-[#636368]">
            Our team adds them here as soon as they are shot. Until then, the surest way to see the hall is to walk it.
          </p>
          <GhostButton href={visitHref({ kind: "SITE_VISIT", venueId: venue.id })} className="w-full sm:max-w-xs">
            Book a site visit
          </GhostButton>
        </>
      ) : (
        <>
          <p className="-mt-1 max-w-[70ch] text-meta leading-[1.5] text-[#636368]">
            Photographed at {venue.name} and published by our team.
          </p>
          {/* One photo per row on a phone; a wider column carries two or three,
              so a 4:3 picture never grows to the height of the window. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((p) => (
              <figure key={p.id}>
                <Photo src={p.url} alt={p.title ?? `${venue.name} photo`} className="aspect-[4/3] w-full rounded-[20px]" />
                {p.title && <figcaption className="mt-2 px-0.5 text-detail leading-[1.45] text-[#6e6e73]">{p.title}</figcaption>}
              </figure>
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}
