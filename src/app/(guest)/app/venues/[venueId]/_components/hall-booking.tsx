"use client";

import * as React from "react";
import { AvailabilityMonth } from "./availability-month";
import { BookingPanel } from "./booking-bar";

// ============================================================
// "Check a date" and the booking control are one thing: the calendar owns the
// month and the picking, and the date it lands on is what the control carries
// into the reserve flow. Holding that one piece of state here keeps a single
// control on the screen — the calendar renders its own only when it is used
// without this wrapper.
//
// It also owns the hall page's shape, because the control's position is the
// shape. Below 1024px everything is one column and the control is the sticky
// bar across the foot. At 1024px and up the page splits: the hall's own
// sections (`before`, the calendar, `after` — server-rendered, passed straight
// through) run down the left, and the control becomes a card in the right
// column that follows them down. `lg:items-start` is what lets it: the card's
// grid area is the full height of the row, so `sticky` has somewhere to
// travel.
// ============================================================

export function HallBooking({
  venueId,
  venueName,
  priceAmount,
  perGuest,
  before,
  after,
}: {
  venueId: string;
  venueName: string;
  priceAmount: string | null;
  perGuest: string | null;
  /** The hall's sections above the calendar (name, description, amenities). */
  before?: React.ReactNode;
  /** Everything below it (directions, media, reviews, the price note). */
  after?: React.ReactNode;
}) {
  const [dateISO, setDateISO] = React.useState<string | null>(null);

  return (
    <div className="vg-split lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
      <div className="flex min-w-0 flex-col gap-[22px]">
        {before}
        <AvailabilityMonth
          venueId={venueId}
          venueName={venueName}
          priceLabel={priceAmount ? `from ${priceAmount}` : null}
          title="Check a date"
          onPick={setDateISO}
        />
        {after}
      </div>
      <BookingPanel venueId={venueId} venueName={venueName} priceAmount={priceAmount} perGuest={perGuest} dateISO={dateISO} />
    </div>
  );
}
