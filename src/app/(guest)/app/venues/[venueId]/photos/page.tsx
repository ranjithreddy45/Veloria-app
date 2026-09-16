import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontVenue } from "@/actions/storefront.actions";
import { getGuestPhotos } from "@/actions/guest-public.actions";
import { EmptyNote, GhostButton, Photo, Screen, ScreenHeader } from "../../../../_components/ui";
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
    <Screen className="gap-4 pb-8">
      <ScreenHeader title="Photos" sub={venue.name} backHref={hallHref} />

      {photos.length === 0 ? (
        <>
          <EmptyNote>We haven&apos;t published photos of {venue.name} yet.</EmptyNote>
          <p className="text-meta leading-[1.5] text-[#8a8a8e]">
            Our team adds them here as soon as they are shot. Until then, the surest way to see the hall is to walk it.
          </p>
          <GhostButton href={visitHref({ kind: "SITE_VISIT", venueId: venue.id })} className="w-full">
            Book a site visit
          </GhostButton>
        </>
      ) : (
        <>
          <p className="-mt-1 text-meta leading-[1.5] text-[#8a8a8e]">
            Photographed at {venue.name} and published by our team.
          </p>
          <div className="flex flex-col gap-4">
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
