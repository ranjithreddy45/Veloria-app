"use client";

import { NavLink } from "../../../../_components/nav-transition";

// ============================================================
// The booking control: the price and the way in to the reserve flow.
//
// Left/top: the hall's "from" price (the team's pricing engine, via
// hallPriceText) or "Price on request", plus the date picked on the calendar
// once there is one. Then: the way into the existing reserve flow.
//
// Below 1024px it is the sticky bar across the foot of the screen. At 1024px
// and up a bar pinned to the bottom of a laptop window reads as broken, so
// the same figures and the same wording become a card that sits beside the
// content and follows it down the page. Both read one priceLine(), so the two
// can never word the same hall differently.
//
// Neither ever says a date is free, taken or held. They carry the chosen date
// into /app/book, and that flow — the one that talks to the availability and
// hold actions — is what decides.
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

export interface BookingProps {
  venueId: string;
  venueName: string;
  /** "₹1.50 L" from hallPriceText, or null when the hall has no usable price. */
  priceAmount: string | null;
  perGuest: string | null;
  dateISO: string | null;
}

/** The one wording, so the bar and the card can never say different things. */
function lines(props: BookingProps): { sub: string } {
  const date = pickedDateLabel(props.dateISO);
  return { sub: date ?? props.perGuest ?? "Final price depends on your date and guests" };
}

function Price({ priceAmount }: { priceAmount: string | null }) {
  if (!priceAmount) return <div className="text-copy font-semibold text-[#6d1b52]">Price on request</div>;
  return (
    <div className="numeric text-copy font-semibold text-[#6d1b52]">
      from {priceAmount} <span className="text-meta font-medium text-[#636368]">/ slot</span>
    </div>
  );
}

function ReserveLink({ venueId, venueName, dateISO, className }: Pick<BookingProps, "venueId" | "venueName" | "dateISO"> & { className: string }) {
  const date = pickedDateLabel(dateISO);
  return (
    <NavLink
      href={reserveHref(venueId, dateISO)}
      kind="push"
      aria-label={date ? `Reserve ${date} at ${venueName}` : `Reserve a date at ${venueName}`}
      className={className}
    >
      Reserve
    </NavLink>
  );
}

/**
 * The sticky bar. Phone and tablet only — `vg-col` keeps it exactly as wide as
 * the content column it belongs to, and `vg-gutter` lines its price up with
 * the text above it.
 */
export function BookingBar(props: BookingProps) {
  const { sub } = lines(props);
  return (
    <div className="vg-glass vg-col vg-gutter fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 pb-[calc(var(--sab)+12px)] pt-3 lg:hidden">
      <div className="min-w-0 flex-1">
        <Price priceAmount={props.priceAmount} />
        <div className="truncate text-meta text-[#6e6e73]">{sub}</div>
      </div>
      <ReserveLink
        venueId={props.venueId}
        venueName={props.venueName}
        dateISO={props.dateISO}
        className="vg-primary vg-press shrink-0 rounded-[14px] px-5 py-[15px] text-body font-semibold"
      />
    </div>
  );
}

/** The laptop card: the same figures, beside the content, following it down. */
export function BookingCard(props: BookingProps) {
  const { sub } = lines(props);
  return (
    <aside
      aria-label={`Reserve ${props.venueName}`}
      className="vg-card hidden rounded-2xl p-5 lg:sticky lg:top-6 lg:block"
    >
      <Price priceAmount={props.priceAmount} />
      <p className="mt-1 text-detail leading-[1.45] text-[#636368]">{sub}</p>
      <ReserveLink
        venueId={props.venueId}
        venueName={props.venueName}
        dateISO={props.dateISO}
        className="vg-primary vg-press mt-4 flex w-full items-center justify-center rounded-[14px] px-5 py-[15px] text-body font-semibold"
      />
    </aside>
  );
}

/** Both presentations. Exactly one is ever visible — and ever in the a11y tree. */
export function BookingPanel(props: BookingProps) {
  return (
    <>
      <BookingBar {...props} />
      <BookingCard {...props} />
    </>
  );
}
