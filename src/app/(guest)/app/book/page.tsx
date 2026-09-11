import { Suspense } from "react";
import { getStorefrontVenues } from "@/actions/storefront.actions";
import { getPublicHoldTerms } from "@/actions/public-hold.actions";
import { getGuestUser } from "@/lib/guest-session";
import { ReserveStepper } from "./_components/reserve-stepper";

export const metadata = { title: "Reserve a date — Veloria Grand" };
export const dynamic = "force-dynamic";

export default async function BookPage({ searchParams }: { searchParams: Promise<{ venueId?: string; occasion?: string; date?: string }> }) {
  const sp = await searchParams;
  const [venues, terms, user] = await Promise.all([getStorefrontVenues(), getPublicHoldTerms(), getGuestUser()]);
  return (
    <Suspense fallback={<div className="px-5 pt-[calc(var(--sat)+1.25rem)] text-body text-[#6e6e73]">Loading…</div>}>
      <ReserveStepper
        venues={venues.map((v) => ({ id: v.id, name: v.name, capacity: v.capacity, pricePerSlot: v.pricePerSlot }))}
        terms={terms}
        initial={{ venueId: sp.venueId ?? "", occasion: sp.occasion ?? "", date: sp.date ?? "" }}
        prefill={{ name: user?.name ?? "", email: user?.email ?? "" }}
      />
    </Suspense>
  );
}
