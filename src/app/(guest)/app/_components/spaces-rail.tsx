import { ArrowRight } from "lucide-react";
import type { GuestHallFeedItem } from "@/actions/guest-public.actions";
import { NavLink } from "../../_components/nav-transition";
import { HallCard } from "../venues/_components/hall-card";
import { RAIL_LIMIT, orderHallsForRail, seeAllLabel } from "./home-browse";

// ============================================================
// The spaces rail — the first thing the home screen shows.
//
// The same card the feed uses (HallCard, rail variant), fed by the same
// action (getGuestHallFeed), so a hall's photo, price, capacity and rating
// read identically here and on /app/venues. Nothing is added on the way: a
// hall with no photo carries a labelled illustration, one with no price reads
// "Price on request" — the card's own rules, not the rail's.
//
// The rail ends on a card into the full feed, counting the halls that really
// exist (totalPublished), never the handful shown here.
// ============================================================

export function SpacesRail({
  halls,
  mostBookedId,
  total,
}: {
  halls: readonly GuestHallFeedItem[];
  /** The hall the team books most often, from getGuestMostBookedVenueId; it leads the rail. */
  mostBookedId: string | null;
  /** Every published hall — what "See all N spaces" counts. */
  total: number;
}) {
  const shown = orderHallsForRail(halls, mostBookedId).slice(0, RAIL_LIMIT);
  if (shown.length === 0) return null;

  return (
    <ul className="vg-scroll-x vg-bleed snap-x snap-mandatory scroll-px-5 list-none pb-1.5">
      {shown.map((hall, i) => (
        // The card carries its own rail width; the item only has to snap.
        <li key={hall.id} className="flex shrink-0 snap-start">
          <HallCard hall={hall} variant="rail" eager={i === 0} />
        </li>
      ))}
      <li className="flex w-[148px] shrink-0 snap-start">
        <NavLink
          href="/app/venues"
          kind="push"
          className="vg-press flex w-full flex-col items-start justify-end gap-2.5 rounded-[18px] border border-dashed border-[#6d1b52]/30 bg-[#f7eef2] p-4 text-[#6d1b52] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d1b52]"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-white/85">
            <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden />
          </span>
          <span className="text-body font-semibold leading-[1.3]">{seeAllLabel(total)}</span>
        </NavLink>
      </li>
    </ul>
  );
}
