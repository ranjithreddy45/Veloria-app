"use client";

import * as React from "react";
import { AvailabilityMonth } from "./availability-month";
import { BookingBar } from "./booking-bar";

// ============================================================
// "Check a date" and the sticky bar are one thing: the calendar owns the
// month and the picking, and the date it lands on is what the bar carries
// into the reserve flow. Holding that one piece of state here keeps a single
// bar on the screen — the calendar renders its own only when it is used
// without this wrapper.
// ============================================================

export function HallBooking({
  venueId,
  venueName,
  priceAmount,
  perGuest,
}: {
  venueId: string;
  venueName: string;
  priceAmount: string | null;
  perGuest: string | null;
}) {
  const [dateISO, setDateISO] = React.useState<string | null>(null);

  return (
    <>
      <AvailabilityMonth
        venueId={venueId}
        venueName={venueName}
        priceLabel={priceAmount ? `from ${priceAmount}` : null}
        title="Check a date"
        onPick={setDateISO}
      />
      <BookingBar venueId={venueId} venueName={venueName} priceAmount={priceAmount} perGuest={perGuest} dateISO={dateISO} />
    </>
  );
}
