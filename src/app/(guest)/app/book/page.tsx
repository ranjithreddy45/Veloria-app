import { Suspense } from "react";
import { getStorefrontVenues } from "@/actions/storefront.actions";
import { getGuestHallPrices } from "@/actions/guest-public.actions";
import { getAppHoldTerms, getPublicHoldTerms } from "@/actions/public-hold.actions";
import { policyPath } from "@/lib/public/policies";
import { getGuestUser } from "@/lib/guest-session";
import { ReserveStepper } from "./_components/reserve-stepper";

export const metadata = { title: "Reserve a date — Veloria Grand" };
export const dynamic = "force-dynamic";

export default async function BookPage({ searchParams }: { searchParams: Promise<{ venueId?: string; occasion?: string; date?: string }> }) {
  const sp = await searchParams;
  const [venues, terms, published, user] = await Promise.all([getStorefrontVenues(), getPublicHoldTerms(), getAppHoldTerms(), getGuestUser()]);
  // Hall prices from the team's price engine (the same "from" figures as the
  // hall pages and the staff simulator), never the raw Venue.pricePerSlot.
  const prices = await getGuestHallPrices(venues.map((v) => v.id));
  // The PUBLISHED cancellation/refund policy and booking terms, each linked to
  // its public page. The customer accepts exactly these (or the honest notice
  // when none is published) before a hold is placed; the acceptance is stored
  // on the booking.
  const holdTerms = published.map((d) => ({ ...d, href: policyPath(d.key) }));
  return (
    <Suspense fallback={<div className="px-5 pt-[calc(var(--sat)+1.25rem)] text-body text-[#6e6e73]">Loading…</div>}>
      <ReserveStepper
        venues={venues.map((v) => ({ id: v.id, name: v.name, capacity: v.capacity }))}
        prices={prices}
        terms={terms}
        holdTerms={holdTerms}
        initial={{ venueId: sp.venueId ?? "", occasion: sp.occasion ?? "", date: sp.date ?? "" }}
        prefill={{ name: user?.name ?? "", email: user?.email ?? "" }}
      />
    </Suspense>
  );
}
