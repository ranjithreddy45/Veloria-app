import { Images } from "lucide-react";
import { BackButton, NavLink } from "../../../../_components/nav-transition";
import { SaveButton } from "../../../../_components/shortlist";
import { Photo } from "../../../../_components/ui";
import { PhotoCarousel } from "../../_components/photo-carousel";

// ============================================================
// The hall's photo header.
//
// With real photos: one swipeable photo per screen on a phone — the same
// carousel the browse cards use, so a hall looks the same wherever it appears —
// and, once there are five and the column is wide enough to hold them, the
// large photo plus four smaller ones beside it. "Show all photos" opens the
// full gallery.
//
// With none: ONE labelled illustration and a plain line saying so (the carousel
// draws it from the hall's id, the same picture the browse card shows). No
// strip, no "show all", no count: detail shots of somewhere else would read as
// this hall's interiors. See _components/stock.ts for the rule.
// ============================================================

export interface HeaderPhoto {
  id: string;
  url: string;
  title: string | null;
}

/** How many real photos it takes before the wide layout is worth switching to. */
const GRID_MIN = 5;

// Keyboard focus needs no class here: globals.css paints a 2px --ring
// (#6d1b52) outline on every a / button / [tabindex] with !important, so the
// carousel earns a visible ring from its tabIndex alone, and nothing local
// could override it anyway.

export function PhotoHeader({
  venueId,
  venueName,
  photos,
  photosHref,
  backHref,
}: {
  venueId: string;
  venueName: string;
  /** Real, published photos of this hall — empty renders the labelled illustration. */
  photos: readonly HeaderPhoto[];
  photosHref: string;
  backHref: string;
}) {
  const lead = photos.slice(0, GRID_MIN);
  const grid = lead.length >= GRID_MIN;

  return (
    <header className="relative">
      <PhotoCarousel
        photos={photos.map((p) => ({ url: p.url, title: p.title }))}
        name={venueName}
        seed={venueId}
        eager
        badgeClassName="bottom-9 left-4"
        className={`aspect-[4/3] w-full${grid ? " sm:hidden" : ""}`}
      />

      {/* Wider column: the large photo with four beside it. */}
      {grid && (
        <div className="hidden h-[360px] gap-2 px-5 pt-[calc(var(--sat)+0.75rem)] sm:grid sm:grid-cols-4 sm:grid-rows-2">
          {lead.map((p, i) => (
            <Photo
              key={p.id}
              src={p.url}
              alt={p.title ?? venueName}
              className={
                i === 0
                  ? "col-span-2 row-span-2 h-full w-full rounded-l-[20px]"
                  : `h-full w-full ${i === 2 ? "rounded-tr-[20px]" : i === 4 ? "rounded-br-[20px]" : ""}`
              }
            />
          ))}
        </div>
      )}

      <BackButton href={backHref} light className="absolute left-4 top-[calc(var(--sat)+0.75rem)]" />
      <SaveButton venueId={venueId} className="absolute right-4 top-[calc(var(--sat)+0.75rem)]" />

      {photos.length > 1 && (
        <NavLink
          href={photosHref}
          kind="push"
          className="absolute bottom-9 right-4 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-black/[.08] bg-white/[.94] px-4 py-2 text-detail font-semibold text-[#1d1d1f] shadow-sm backdrop-blur"
        >
          <Images className="size-4" aria-hidden /> Show all photos
        </NavLink>
      )}
    </header>
  );
}
