"use client";

import { NavLink } from "../../../../_components/nav-transition";

// ============================================================
// The sticky booking bar.
//
// Left: the hall's "from" price (the team's pricing engine, via
// hallPriceText) or "Price on request", plus the date picked on the calendar
// once there is one. Right: the way into the existing reserve flow.
//
// The bar never says a date is free, taken or held. It carries the chosen
// date into /app/book, and that flow — the one that talks to the availability
// and hold actions — is what decides.
// ============================================================

/** "Fri, 3 Oct" for a YYYY-MM-DD picked on the calendar; null when it is not a date. */
export function pickedDateLabel(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function reserveHref(venueId: string, dateISO: string | null | undefined): string {
  const q = new URLSearchParams({ venueId });
  if (dateISO) q.set("date", dateISO);
  return `/app/book?${q.toString()}`;
}

export function BookingBar({
  venueId,
  venueName,
  priceAmount,
  perGuest,
  dateISO,
}: {
  venueId: string;
  venueName: string;
  /** "₹1.50 L" from hallPriceText, or null when the hall has no usable price. */
  priceAmount: string | null;
  perGuest: string | null;
  dateISO: string | null;
}) {
  const date = pickedDateLabel(dateISO);

  return (
    <div className="vg-glass fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center gap-3 px-5 pb-[calc(var(--sab)+12px)] pt-3">
      <div className="min-w-0 flex-1">
        {priceAmount ? (
          <div className="numeric text-copy font-semibold text-[#6d1b52]">
            from {priceAmount} <span className="text-meta font-medium text-[#8a8a8e]">/ slot</span>
          </div>
        ) : (
          <div className="text-copy font-semibold text-[#6d1b52]">Price on request</div>
        )}
        <div className="truncate text-meta text-[#6e6e73]">{date ?? perGuest ?? "Final price depends on your date and guests"}</div>
      </div>
      <NavLink
        href={reserveHref(venueId, dateISO)}
        kind="push"
        aria-label={date ? `Reserve ${date} at ${venueName}` : `Reserve a date at ${venueName}`}
        className="vg-primary vg-press shrink-0 rounded-[14px] px-5 py-[15px] text-body font-semibold"
      >
        Reserve
      </NavLink>
    </div>
  );
}
